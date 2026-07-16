import re

import pytest
from pydantic import ValidationError

from backend.app.models import (
    EntityReference,
    Evidence,
    QuestionAnswer,
    QuestionQuery,
    QueryIntent,
    RelationReference,
)
from backend.app.query_templates import build_query


EXPECTED_RELATION_TYPE = {
    QueryIntent.COMPONENT_ASSOCIATION: "PART_OF",
    QueryIntent.DEFECT_ACTION: "REQUIRES_ACTION",
    QueryIntent.LIMIT_STANDARD: "HAS_STANDARD",
    QueryIntent.PROCEDURE_STEPS: "NEXT_STEP",
}

REQUIRED_RETURN_ALIASES = {
    "subject_id",
    "subject_name",
    "subject_type",
    "answer_id",
    "answer_name",
    "answer_type",
    "relation_type",
    "relation_source_id",
    "relation_target_id",
    "pdf_page",
    "printed_page",
    "source_text",
}


@pytest.mark.parametrize("intent", list(QueryIntent))
def test_each_intent_builds_a_parameterized_read_only_query(intent: QueryIntent) -> None:
    request = QuestionQuery(intent=intent, subject="车轮")

    prepared = build_query(request)

    assert prepared.parameters == {"subject": "车轮"}
    assert "$subject" in prepared.cypher
    assert "车轮" not in prepared.cypher
    assert EXPECTED_RELATION_TYPE[intent] in prepared.cypher
    assert not re.search(
        r"\b(CREATE|DELETE|DETACH|DROP|MERGE|REMOVE|SET)\b",
        prepared.cypher,
        flags=re.IGNORECASE,
    )
    for alias in REQUIRED_RETURN_ALIASES:
        assert f" AS {alias}" in prepared.cypher


def test_subject_text_cannot_be_injected_into_cypher() -> None:
    subject = "车轮' MATCH (n) DETACH DELETE n //"

    prepared = build_query(
        QuestionQuery(intent=QueryIntent.DEFECT_ACTION, subject=subject)
    )

    assert subject not in prepared.cypher
    assert prepared.parameters["subject"] == subject


def test_question_query_trims_subject_and_rejects_blank_values() -> None:
    request = QuestionQuery(
        intent=QueryIntent.LIMIT_STANDARD,
        subject="  车轮  ",
    )

    assert request.subject == "车轮"
    with pytest.raises(ValidationError):
        QuestionQuery(intent=QueryIntent.LIMIT_STANDARD, subject="   ")


def test_answer_with_knowledge_requires_source_evidence() -> None:
    with pytest.raises(ValidationError):
        QuestionAnswer(
            intent=QueryIntent.LIMIT_STANDARD,
            subject="车轮",
            found=True,
            answer="车轮直径下限为Φ800mm。",
            evidence=[],
        )


def test_answer_contract_keeps_entities_relations_and_evidence() -> None:
    answer = QuestionAnswer(
        intent=QueryIntent.DEFECT_ACTION,
        subject="车轮直径小于Φ800mm",
        found=True,
        answer="需要整体更换车轮（含轮盘）。",
        entities=[
            EntityReference(
                entity_id="A001",
                name="整体更换车轮（含轮盘）",
                entity_type="Action",
            )
        ],
        relations=[
            RelationReference(
                relation_type="REQUIRES_ACTION",
                source_id="D001",
                target_id="A001",
            )
        ],
        evidence=[
            Evidence(
                pdf_page=6,
                printed_page=29,
                source_text="车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
            )
        ],
    )

    assert answer.entities[0].entity_id == "A001"
    assert answer.relations[0].relation_type == "REQUIRES_ACTION"
    assert answer.evidence[0].pdf_page == 6


def test_not_found_answer_has_one_consistent_shape() -> None:
    request = QuestionQuery(
        intent=QueryIntent.PROCEDURE_STEPS,
        subject="不存在的工序",
    )

    answer = QuestionAnswer.not_found(request)

    assert answer.found is False
    assert answer.answer == "未找到证据"
    assert answer.entities == []
    assert answer.relations == []
    assert answer.evidence == []


def test_not_found_answer_rejects_result_payload() -> None:
    with pytest.raises(ValidationError):
        QuestionAnswer(
            intent=QueryIntent.LIMIT_STANDARD,
            subject="不存在的部件",
            found=False,
            answer="未找到证据",
            evidence=[
                Evidence(
                    pdf_page=6,
                    printed_page=29,
                    source_text="不应出现在未找到响应中的证据",
                )
            ],
        )


def test_evidence_keeps_both_page_numbers_and_source_text() -> None:
    evidence = Evidence(
        pdf_page=6,
        printed_page=29,
        source_text="车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
    )

    assert evidence.model_dump() == {
        "pdf_page": 6,
        "printed_page": 29,
        "source_text": "车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
    }
