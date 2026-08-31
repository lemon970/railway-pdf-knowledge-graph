from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from scripts.evaluation.run_evaluation import (
    ApiResponse,
    EvaluationQuestion,
    EvaluationUnavailable,
    EvaluationResult,
    evaluate_answer,
    load_questions,
    run_evaluation,
    write_results,
)


ROOT = Path(__file__).parents[2]


def test_load_questions_requires_reviewed_rows(tmp_path: Path) -> None:
    path = tmp_path / "questions.csv"
    path.write_text(
        "question_id,category,question,expected_answer,evidence_page,status\n"
        "Q001,defect_action,怎么处理,整体更换车轮（含轮盘）,6,draft\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="reviewed"):
        load_questions(path)


def test_current_question_bank_covers_all_intents_with_at_least_two_questions() -> None:
    questions = load_questions(ROOT / "data/evaluation/questions.csv")

    assert len(questions) >= 10
    for category in {
        "component_association",
        "defect_action",
        "limit_standard",
        "procedure_steps",
    }:
        assert sum(question.category == category for question in questions) >= 2


def test_evaluate_answer_checks_intent_answer_and_evidence_page() -> None:
    question = {
        "question_id": "Q001",
        "category": "defect_action",
        "question": "车轮直径小于Φ800mm怎么处理？",
        "expected_answer": "整体更换车轮（含轮盘）",
        "evidence_page": "6",
        "status": "reviewed",
    }

    result = evaluate_answer(
        question,
        {
            "intent": "defect_action",
            "subject": "车轮直径小于Φ800mm",
            "found": True,
            "answer": "车轮直径小于Φ800mm需要的处理措施：整体更换车轮（含轮盘）",
            "evidence": [
                {
                    "pdf_page": 6,
                    "printed_page": 29,
                    "source_text": "车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
                }
            ],
        },
    )

    assert result.passed is True
    assert result.error_reason == ""


def test_evaluate_answer_writes_expected_page_as_csv_text() -> None:
    question = EvaluationQuestion(
        question_id="Q001",
        category="limit_standard",
        question="车轮的限度标准是多少？",
        expected_answer="车轮直径下限Φ800mm",
        evidence_page=(6,),
        status="reviewed",
    )

    result = evaluate_answer(
        question,
        {
            "intent": "limit_standard",
            "subject": "车轮",
            "found": True,
            "answer": "车轮对应的限度标准：车轮直径下限Φ800mm",
            "evidence": [{"pdf_page": 6}],
        },
    )

    assert result.expected_evidence_page == "6"


def test_evaluate_answer_reports_wrong_page_and_missing_evidence() -> None:
    question = {
        "question_id": "Q001",
        "category": "limit_standard",
        "question": "车轮的限度标准是多少？",
        "expected_answer": "车轮直径下限Φ800mm",
        "evidence_page": "6",
        "status": "reviewed",
    }

    result = evaluate_answer(
        question,
        {
            "intent": "limit_standard",
            "subject": "车轮",
            "found": True,
            "answer": "车轮对应的限度标准：车轮直径下限Φ800mm",
            "evidence": [
                {
                    "pdf_page": 7,
                    "printed_page": 30,
                    "source_text": "错误页码的证据",
                }
            ],
        },
    )

    assert result.passed is False
    assert "证据页码不匹配" in result.error_reason


def test_not_found_answer_is_valid_without_evidence() -> None:
    question = {
        "question_id": "Q404",
        "category": "procedure_steps",
        "question": "不存在的工序下一步是什么？",
        "expected_answer": "未找到证据",
        "evidence_page": "",
        "status": "reviewed",
    }

    result = evaluate_answer(
        question,
        {
            "intent": "procedure_steps",
            "subject": "不存在的工序",
            "found": False,
            "answer": "未找到证据",
            "evidence": [],
        },
    )

    assert result.passed is True


def test_unavailable_error_is_a_distinct_nonzero_condition() -> None:
    assert issubclass(EvaluationUnavailable, RuntimeError)


def test_run_evaluation_stops_before_questions_when_health_is_unavailable(
    tmp_path: Path,
) -> None:
    calls: list[str] = []

    def unavailable_request(url: str, **_kwargs: object) -> ApiResponse:
        calls.append(url)
        return ApiResponse(503, {"status": "degraded", "database": "unavailable"})

    with pytest.raises(EvaluationUnavailable, match="健康检查失败"):
        run_evaluation(
            ROOT / "data/evaluation/questions.csv",
            requester=unavailable_request,
            output_path=tmp_path / "results.csv",
        )

    assert len(calls) == 1


def test_write_results_keeps_evidence_as_readable_json(tmp_path: Path) -> None:
    path = tmp_path / "results.csv"
    write_results(
        path,
        [
            EvaluationResult(
                question_id="Q001",
                predicted_intent="defect_action",
                predicted_subject="车轮直径小于Φ800mm",
                predicted_answer="整体更换车轮（含轮盘）",
                predicted_found=True,
                predicted_evidence=[{"pdf_page": 6, "source_text": "原文"}],
                expected_answer="整体更换车轮（含轮盘）",
                expected_evidence_page="6",
                passed=True,
                error_reason="",
            )
        ],
    )

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        row = next(csv.DictReader(handle))
    assert row["question_id"] == "Q001"
    assert json.loads(row["predicted_evidence"])[0]["pdf_page"] == 6
    assert row["passed"] == "True"
