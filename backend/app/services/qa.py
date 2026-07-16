from __future__ import annotations

from typing import Protocol

from backend.app.models import (
    EntityReference,
    Evidence,
    QuestionAnswer,
    QuestionQuery,
    QueryIntent,
    RelationReference,
)
from backend.app.query_templates import PreparedQuery, build_query


class QueryRepository(Protocol):
    def execute(self, prepared_query: PreparedQuery) -> list[dict[str, object]]: ...


_ANSWER_LABELS = {
    QueryIntent.COMPONENT_ASSOCIATION: "关联的部件",
    QueryIntent.DEFECT_ACTION: "需要的处理措施",
    QueryIntent.LIMIT_STANDARD: "对应的限度标准",
    QueryIntent.PROCEDURE_STEPS: "的下一步骤",
}


class QAService:
    def __init__(self, repository: QueryRepository) -> None:
        self.repository = repository

    def answer(self, query: QuestionQuery) -> QuestionAnswer:
        rows = self.repository.execute(build_query(query))
        if not rows:
            return QuestionAnswer.not_found(query)

        entities: dict[str, EntityReference] = {}
        relations: dict[tuple[str, str, str], RelationReference] = {}
        evidence: dict[tuple[int, int, str], Evidence] = {}
        answer_names: list[str] = []

        for row in rows:
            subject = EntityReference(
                entity_id=str(row["subject_id"]),
                name=str(row["subject_name"]),
                entity_type=str(row["subject_type"]),
            )
            answer = EntityReference(
                entity_id=str(row["answer_id"]),
                name=str(row["answer_name"]),
                entity_type=str(row["answer_type"]),
            )
            entities.setdefault(subject.entity_id, subject)
            entities.setdefault(answer.entity_id, answer)
            if answer.name not in answer_names:
                answer_names.append(answer.name)

            relation = RelationReference(
                relation_type=str(row["relation_type"]),
                source_id=str(row["relation_source_id"]),
                target_id=str(row["relation_target_id"]),
            )
            relation_key = (
                relation.relation_type,
                relation.source_id,
                relation.target_id,
            )
            relations.setdefault(relation_key, relation)

            item = Evidence(
                pdf_page=int(row["pdf_page"]),
                printed_page=int(row["printed_page"]),
                source_text=str(row["source_text"]),
            )
            evidence_key = (item.pdf_page, item.printed_page, item.source_text)
            evidence.setdefault(evidence_key, item)

        label = _ANSWER_LABELS[query.intent]
        answer_text = f"{query.subject}{label}：{'；'.join(answer_names)}"
        return QuestionAnswer(
            intent=query.intent,
            subject=query.subject,
            found=True,
            answer=answer_text,
            focus_entity_id=str(rows[0]["subject_id"]),
            entities=list(entities.values()),
            relations=list(relations.values()),
            evidence=list(evidence.values()),
        )
