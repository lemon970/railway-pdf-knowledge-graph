from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_QUESTIONS = ROOT / "data" / "evaluation" / "questions.csv"
SUPPORTED_CATEGORIES = {
    "component_association",
    "defect_action",
    "limit_standard",
    "procedure_steps",
}
NOT_FOUND_TEXT = "未找到证据"
QUESTION_FIELDS = (
    "question_id",
    "category",
    "question",
    "expected_answer",
    "evidence_page",
    "status",
)
RESULT_FIELDS = (
    "question_id",
    "predicted_intent",
    "predicted_subject",
    "predicted_answer",
    "predicted_found",
    "predicted_evidence",
    "expected_answer",
    "expected_evidence_page",
    "passed",
    "error_reason",
)


class EvaluationUnavailable(RuntimeError):
    """服务或数据库不可用，评测没有可靠执行。"""


@dataclass(frozen=True)
class EvaluationQuestion:
    question_id: str
    category: str
    question: str
    expected_answer: str
    evidence_page: tuple[int, ...]
    status: str


@dataclass(frozen=True)
class EvaluationResult:
    question_id: str
    predicted_intent: str
    predicted_subject: str
    predicted_answer: str
    predicted_found: bool
    predicted_evidence: list[dict[str, Any]]
    expected_answer: str
    expected_evidence_page: str
    passed: bool
    error_reason: str

    def to_row(self) -> dict[str, object]:
        row = asdict(self)
        row["predicted_evidence"] = json.dumps(
            self.predicted_evidence,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        return row


@dataclass(frozen=True)
class ApiResponse:
    status_code: int
    payload: dict[str, Any]


def load_questions(path: Path) -> list[EvaluationQuestion]:
    """读取并校验评测题；未复核题目不能进入正式评测。"""
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = [field for field in QUESTION_FIELDS if field not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"评测题缺少字段：{', '.join(missing)}")

        questions: list[EvaluationQuestion] = []
        seen_ids: set[str] = set()
        for line_number, row in enumerate(reader, start=2):
            values = {field: (row.get(field) or "").strip() for field in QUESTION_FIELDS}
            if not values["question_id"] or values["question_id"] in seen_ids:
                raise ValueError(f"第 {line_number} 行 question_id 为空或重复")
            if values["category"] not in SUPPORTED_CATEGORIES:
                raise ValueError(f"第 {line_number} 行意图不受支持：{values['category']}")
            if not values["question"] or not values["expected_answer"]:
                raise ValueError(f"第 {line_number} 行问题和预期答案不能为空")
            if values["status"] != "reviewed":
                raise ValueError(f"第 {line_number} 行必须标记为 reviewed")

            pages = _parse_pages(values["evidence_page"], line_number)
            expects_found = values["expected_answer"] != NOT_FOUND_TEXT
            if expects_found and not pages:
                raise ValueError(f"第 {line_number} 行有答案题必须填写 evidence_page")

            seen_ids.add(values["question_id"])
            questions.append(
                EvaluationQuestion(
                    question_id=values["question_id"],
                    category=values["category"],
                    question=values["question"],
                    expected_answer=values["expected_answer"],
                    evidence_page=pages,
                    status=values["status"],
                )
            )

    if not questions:
        raise ValueError("评测题为空")
    return questions


def evaluate_answer(
    question: EvaluationQuestion | Mapping[str, str],
    payload: Mapping[str, Any],
) -> EvaluationResult:
    """按意图、答案、found 状态和证据页码判定单题结果。"""
    question_id = _question_value(question, "question_id")
    category = _question_value(question, "category")
    expected_answer = _question_value(question, "expected_answer")
    expected_pages = (
        question.evidence_page
        if isinstance(question, EvaluationQuestion)
        else _parse_pages(_question_value(question, "evidence_page"), 0)
    )
    expected_page_text = (
        _pages_to_text(question.evidence_page)
        if isinstance(question, EvaluationQuestion)
        else _question_value(question, "evidence_page")
    )
    predicted_intent = str(payload.get("intent") or "")
    predicted_subject = str(payload.get("subject") or "")
    predicted_answer = str(payload.get("answer") or "")
    predicted_found = payload.get("found") is True
    evidence_value = payload.get("evidence")
    predicted_evidence = evidence_value if isinstance(evidence_value, list) else []

    errors: list[str] = []
    if predicted_intent != category:
        errors.append(f"意图不匹配：预期 {category}，实际 {predicted_intent or '空值'}")

    expects_found = expected_answer != NOT_FOUND_TEXT
    if predicted_found != expects_found:
        errors.append(f"found 不匹配：预期 {expects_found}，实际 {predicted_found}")

    if expects_found:
        if expected_answer not in predicted_answer:
            errors.append("答案未包含预期文本")
        if not predicted_evidence:
            errors.append("有答案但缺少证据")
        actual_pages = _evidence_pages(predicted_evidence)
        if expected_pages and not set(expected_pages).intersection(actual_pages):
            errors.append(
                f"证据页码不匹配：预期 {expected_page_text}，实际 {','.join(map(str, sorted(actual_pages))) or '空值'}"
            )
    else:
        if predicted_answer != NOT_FOUND_TEXT:
            errors.append("无答案文本不一致")
        if predicted_evidence:
            errors.append("无答案不应返回证据")

    return EvaluationResult(
        question_id=question_id,
        predicted_intent=predicted_intent,
        predicted_subject=predicted_subject,
        predicted_answer=predicted_answer,
        predicted_found=predicted_found,
        predicted_evidence=predicted_evidence,
        expected_answer=expected_answer,
        expected_evidence_page=expected_page_text,
        passed=not errors,
        error_reason="；".join(errors),
    )


def request_json(
    url: str,
    *,
    payload: Mapping[str, Any] | None = None,
    timeout: float = 10,
) -> ApiResponse:
    body = None
    headers = {"Accept": "application/json"}
    method = "GET"
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            response_body = response.read().decode("utf-8")
            return ApiResponse(response.status, _decode_json(response_body))
    except HTTPError as error:
        response_body = error.read().decode("utf-8", errors="replace")
        return ApiResponse(error.code, _decode_json(response_body))
    except (URLError, TimeoutError, OSError) as error:
        raise EvaluationUnavailable(f"无法连接服务 {url}：{error}") from error


def run_evaluation(
    questions_path: Path = DEFAULT_QUESTIONS,
    *,
    base_url: str = "http://127.0.0.1:8000",
    timeout: float = 10,
    output_path: Path | None = None,
    requester: Callable[..., ApiResponse] = request_json,
) -> list[EvaluationResult]:
    questions = load_questions(questions_path)
    base_url = base_url.rstrip("/")

    health = requester(f"{base_url}/health", timeout=timeout)
    if health.status_code != 200 or health.payload.get("database") != "connected":
        raise EvaluationUnavailable(
            f"健康检查失败：HTTP {health.status_code}，"
            f"{health.payload.get('database', 'unknown')}"
        )

    results: list[EvaluationResult] = []
    for question in questions:
        response = requester(
            f"{base_url}/api/natural-questions",
            payload={"question": question.question},
            timeout=timeout,
        )
        if response.status_code >= 500:
            raise EvaluationUnavailable(
                f"第 {question.question_id} 题调用失败：HTTP {response.status_code}"
            )
        if response.status_code != 200:
            payload = response.payload
            result = EvaluationResult(
                question_id=question.question_id,
                predicted_intent=str(payload.get("error", {}).get("code", "HTTP_ERROR")),
                predicted_subject="",
                predicted_answer="",
                predicted_found=False,
                predicted_evidence=[],
                expected_answer=question.expected_answer,
                expected_evidence_page=_pages_to_text(question.evidence_page),
                passed=False,
                error_reason=f"HTTP {response.status_code}: {json.dumps(payload, ensure_ascii=False)}",
            )
        else:
            result = evaluate_answer(question, response.payload)
        results.append(result)

    if output_path is not None:
        write_results(output_path, results)
    return results


def write_results(path: Path, results: list[EvaluationResult]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=RESULT_FIELDS)
        writer.writeheader()
        for result in results:
            writer.writerow(result.to_row())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="运行铁路检修知识图谱自然语言问答评测")
    parser.add_argument("--base-url", default=os.getenv("EVALUATION_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--questions", type=Path, default=DEFAULT_QUESTIONS)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--timeout", type=float, default=10)
    args = parser.parse_args(argv)

    output_path = args.output or (
        ROOT
        / "output"
        / "evaluation"
        / f"results-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.csv"
    )
    try:
        results = run_evaluation(
            args.questions,
            base_url=args.base_url,
            timeout=args.timeout,
            output_path=output_path,
        )
    except (EvaluationUnavailable, OSError, ValueError) as error:
        print(f"评测未完成：{error}", file=sys.stderr)
        return 2

    passed = sum(result.passed for result in results)
    print(f"评测完成：{passed}/{len(results)} 通过")
    print(f"结果文件：{output_path}")
    for result in results:
        if not result.passed:
            print(f"{result.question_id}：{result.error_reason}", file=sys.stderr)
    return 0 if passed == len(results) else 1


def _question_value(question: EvaluationQuestion | Mapping[str, str], name: str) -> str:
    if isinstance(question, EvaluationQuestion):
        return str(getattr(question, name))
    return str(question.get(name, ""))


def _parse_pages(value: str, line_number: int) -> tuple[int, ...]:
    if not value:
        return ()
    try:
        pages = tuple(sorted({int(item) for item in re.split(r"[,;，、\s]+", value) if item}))
    except ValueError as error:
        location = f"第 {line_number} 行" if line_number else "评测题"
        raise ValueError(f"{location} evidence_page 必须是正整数") from error
    if any(page <= 0 for page in pages):
        location = f"第 {line_number} 行" if line_number else "评测题"
        raise ValueError(f"{location} evidence_page 必须大于 0")
    return pages


def _evidence_pages(evidence: list[object]) -> set[int]:
    pages: set[int] = set()
    for item in evidence:
        if isinstance(item, Mapping):
            try:
                pages.add(int(item["pdf_page"]))
            except (KeyError, TypeError, ValueError):
                continue
    return pages


def _pages_to_text(pages: tuple[int, ...]) -> str:
    return ",".join(str(page) for page in pages)


def _decode_json(value: str) -> dict[str, Any]:
    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        return {"raw": value}
    return payload if isinstance(payload, dict) else {"raw": payload}


if __name__ == "__main__":
    raise SystemExit(main())
