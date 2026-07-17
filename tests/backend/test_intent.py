import pytest

from backend.app.models import QuestionQuery, QueryIntent
from backend.app.services.intent import (
    IntentClientError,
    IntentService,
    UnknownIntentError,
)


class FakeAIClient:
    def __init__(
        self,
        result: QuestionQuery | None = None,
        error: Exception | None = None,
    ) -> None:
        self.result = result
        self.error = error
        self.questions: list[str] = []

    def classify(self, question: str) -> QuestionQuery:
        self.questions.append(question)
        if self.error:
            raise self.error
        assert self.result is not None
        return self.result


@pytest.mark.parametrize(
    ("question", "intent", "subject"),
    [
        ("轮对由哪些部件组成？", QueryIntent.COMPONENT_ASSOCIATION, "轮对"),
        ("车轮直径小于Φ800mm怎么处理？", QueryIntent.DEFECT_ACTION, "车轮直径小于Φ800mm"),
        ("车轮直径小于Φ800mm时如何处理？", QueryIntent.DEFECT_ACTION, "车轮直径小于Φ800mm"),
        ("车轮的限度标准是多少？", QueryIntent.LIMIT_STANDARD, "车轮"),
        ("车轴探伤的下一步是什么？", QueryIntent.PROCEDURE_STEPS, "车轴探伤"),
        ("更换闸瓦需要经过哪些工序？", QueryIntent.PROCEDURE_STEPS, "更换闸瓦"),
    ],
)
def test_rule_parser_maps_supported_questions(
    question: str,
    intent: QueryIntent,
    subject: str,
) -> None:
    parsed = IntentService().parse(question)

    assert parsed.query.intent == intent
    assert parsed.query.subject == subject
    assert parsed.processing_method == "rule"


def test_enabled_ai_client_can_return_only_valid_query_contract() -> None:
    client = FakeAIClient(
        result=QuestionQuery(
            intent=QueryIntent.DEFECT_ACTION,
            subject="车轮直径小于Φ800mm",
        )
    )

    parsed = IntentService(ai_client=client, ai_enabled=True).parse("这要怎么办？")

    assert parsed.processing_method == "ai"
    assert parsed.query.intent == QueryIntent.DEFECT_ACTION
    assert client.questions == ["这要怎么办？"]


def test_ai_failure_falls_back_to_rule_parser() -> None:
    client = FakeAIClient(error=IntentClientError("invalid model response"))

    parsed = IntentService(ai_client=client, ai_enabled=True).parse(
        "车轮直径小于Φ800mm怎么处理？"
    )

    assert parsed.processing_method == "rule"
    assert parsed.query.intent == QueryIntent.DEFECT_ACTION


def test_unknown_question_is_rejected_instead_of_guessing() -> None:
    with pytest.raises(UnknownIntentError):
        IntentService().parse("今天的天气怎么样？")


def test_question_without_subject_is_rejected() -> None:
    with pytest.raises(UnknownIntentError):
        IntentService().parse("怎么处理？")
