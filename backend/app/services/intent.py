from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from backend.app.models import QuestionQuery, QueryIntent


class IntentClient(Protocol):
    def classify(self, question: str) -> QuestionQuery: ...


class IntentClientError(Exception):
    """The optional AI client could not return a valid intent."""


class UnknownIntentError(ValueError):
    """The question cannot be mapped to a supported query intent."""


@dataclass(frozen=True)
class ParsedQuestion:
    query: QuestionQuery
    processing_method: str


@dataclass(frozen=True)
class _Rule:
    intent: QueryIntent
    triggers: tuple[str, ...]
    removable: tuple[str, ...]


_RULES = (
    _Rule(
        QueryIntent.PROCEDURE_STEPS,
        ("下一步", "后续步骤", "工序"),
        ("需要经过哪些工序", "经过哪些工序", "下一步", "后续步骤", "是什么", "有哪些", "工序"),
    ),
    _Rule(
        QueryIntent.DEFECT_ACTION,
        ("怎么处理", "如何处理", "处理措施", "缺陷"),
        ("时怎么处理", "时如何处理", "怎么处理", "如何处理", "处理措施", "缺陷", "是什么", "有哪些"),
    ),
    _Rule(
        QueryIntent.LIMIT_STANDARD,
        ("限度", "标准", "多少", "范围"),
        ("限度", "标准", "是多少", "多少", "范围", "是什么"),
    ),
    _Rule(
        QueryIntent.COMPONENT_ASSOCIATION,
        ("组成", "属于", "包含", "关联部件", "部件"),
        ("组成", "属于", "包含", "关联部件", "部件", "哪些", "是什么"),
    ),
)

_EDGE_FILLERS = ("请问", "一下", "由", "的", "有", "是")


class IntentService:
    def __init__(
        self,
        ai_client: IntentClient | None = None,
        ai_enabled: bool = False,
    ) -> None:
        self.ai_client = ai_client
        self.ai_enabled = ai_enabled

    def parse(self, question: str) -> ParsedQuestion:
        normalized = question.strip()
        if self.ai_enabled and self.ai_client is not None:
            try:
                return ParsedQuestion(
                    query=self.ai_client.classify(normalized),
                    processing_method="ai",
                )
            except IntentClientError:
                pass
        return self._parse_with_rules(normalized)

    def close(self) -> None:
        close = getattr(self.ai_client, "close", None)
        if callable(close):
            close()

    @staticmethod
    def _parse_with_rules(question: str) -> ParsedQuestion:
        for rule in _RULES:
            if not any(trigger in question for trigger in rule.triggers):
                continue
            subject = question
            for phrase in rule.removable:
                subject = subject.replace(phrase, "")
            subject = subject.strip(" \t\r\n，。！？?：:")
            subject = _strip_edge_fillers(subject)
            if not subject:
                raise UnknownIntentError("问题中缺少可查询的对象")
            return ParsedQuestion(
                query=QuestionQuery(intent=rule.intent, subject=subject),
                processing_method="rule",
            )
        raise UnknownIntentError("无法识别问题类型")


def _strip_edge_fillers(text: str) -> str:
    previous = None
    while text and text != previous:
        previous = text
        for filler in _EDGE_FILLERS:
            if text.startswith(filler):
                text = text.removeprefix(filler).strip()
            if text.endswith(filler):
                text = text.removesuffix(filler).strip()
    return text
