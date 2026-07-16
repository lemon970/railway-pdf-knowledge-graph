from __future__ import annotations

from dataclasses import dataclass

from backend.app.models import QuestionQuery, QueryIntent


@dataclass(frozen=True)
class PreparedQuery:
    cypher: str
    parameters: dict[str, str]


_COMMON_RETURN = """
RETURN DISTINCT
    subject.entity_id AS subject_id,
    subject.name AS subject_name,
    subject.entity_type AS subject_type,
    answer.entity_id AS answer_id,
    answer.name AS answer_name,
    answer.entity_type AS answer_type,
    type(relation) AS relation_type,
    startNode(relation).entity_id AS relation_source_id,
    endNode(relation).entity_id AS relation_target_id,
    relation.pdf_page AS pdf_page,
    relation.printed_page AS printed_page,
    relation.source_text AS source_text
""".strip()


_QUERY_TEMPLATES = {
    QueryIntent.COMPONENT_ASSOCIATION: f"""
MATCH (subject:Component)
WHERE toLower(subject.name) CONTAINS toLower($subject)
MATCH (subject)-[relation:PART_OF]-(answer:Component)
{_COMMON_RETURN}
ORDER BY answer.name
""".strip(),
    QueryIntent.DEFECT_ACTION: f"""
MATCH (subject:Entity)
WHERE toLower(subject.name) CONTAINS toLower($subject)
  AND (subject:Component OR subject:Defect)
MATCH (subject)-[:HAS_DEFECT*0..1]->(cause:Entity)
MATCH (cause)-[relation:REQUIRES_ACTION]->(answer:Action)
{_COMMON_RETURN}
ORDER BY answer.name
""".strip(),
    QueryIntent.LIMIT_STANDARD: f"""
MATCH (subject:Entity)
WHERE toLower(subject.name) CONTAINS toLower($subject)
  AND (subject:Component OR subject:Action OR subject:Procedure)
MATCH (subject)-[relation:HAS_STANDARD]->(answer:Standard)
{_COMMON_RETURN}
ORDER BY answer.name
""".strip(),
    QueryIntent.PROCEDURE_STEPS: f"""
MATCH (subject:Procedure)
WHERE toLower(subject.name) CONTAINS toLower($subject)
MATCH (subject)-[relation:NEXT_STEP]->(answer:Procedure)
{_COMMON_RETURN}
ORDER BY answer.name
""".strip(),
}


def build_query(request: QuestionQuery) -> PreparedQuery:
    return PreparedQuery(
        cypher=_QUERY_TEMPLATES[request.intent],
        parameters={"subject": request.subject},
    )
