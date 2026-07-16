from backend.app.models import QuestionQuery, QueryIntent
from backend.app.services.qa import QAService


class FakeRepository:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self.rows = rows
        self.prepared_query = None

    def execute(self, prepared_query):
        self.prepared_query = prepared_query
        return self.rows


def sample_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "subject_id": "D001",
        "subject_name": "车轮直径小于Φ800mm",
        "subject_type": "Defect",
        "answer_id": "A001",
        "answer_name": "整体更换车轮（含轮盘）",
        "answer_type": "Action",
        "relation_type": "REQUIRES_ACTION",
        "relation_source_id": "D001",
        "relation_target_id": "A001",
        "pdf_page": 6,
        "printed_page": 29,
        "source_text": "车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
    }
    row.update(overrides)
    return row


def test_answer_builds_entities_relation_and_evidence_from_query_rows() -> None:
    repository = FakeRepository([sample_row()])
    service = QAService(repository)
    query = QuestionQuery(
        intent=QueryIntent.DEFECT_ACTION,
        subject="车轮直径小于Φ800mm",
    )

    answer = service.answer(query)

    assert answer.found is True
    assert answer.answer == "车轮直径小于Φ800mm需要的处理措施：整体更换车轮（含轮盘）"
    assert [entity.entity_id for entity in answer.entities] == ["D001", "A001"]
    assert answer.relations[0].model_dump() == {
        "relation_type": "REQUIRES_ACTION",
        "source_id": "D001",
        "target_id": "A001",
    }
    assert answer.evidence[0].model_dump() == {
        "pdf_page": 6,
        "printed_page": 29,
        "source_text": "车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
    }
    assert repository.prepared_query.parameters == {
        "subject": "车轮直径小于Φ800mm"
    }


def test_answer_deduplicates_repeated_entities_and_evidence() -> None:
    repeated = sample_row()
    repository = FakeRepository([repeated, dict(repeated)])

    answer = QAService(repository).answer(
        QuestionQuery(intent=QueryIntent.DEFECT_ACTION, subject="车轮")
    )

    assert len(answer.entities) == 2
    assert len(answer.relations) == 1
    assert len(answer.evidence) == 1


def test_answer_keeps_database_relationship_direction_for_undirected_lookup() -> None:
    repository = FakeRepository(
        [
            sample_row(
                subject_id="C001",
                subject_name="轮对",
                subject_type="Component",
                answer_id="C002",
                answer_name="车轮（含轮盘）",
                answer_type="Component",
                relation_type="PART_OF",
                relation_source_id="C002",
                relation_target_id="C001",
            )
        ]
    )

    answer = QAService(repository).answer(
        QuestionQuery(intent=QueryIntent.COMPONENT_ASSOCIATION, subject="轮对")
    )

    assert answer.relations[0].source_id == "C002"
    assert answer.relations[0].target_id == "C001"


def test_answer_returns_not_found_contract_for_empty_result() -> None:
    repository = FakeRepository([])
    query = QuestionQuery(
        intent=QueryIntent.PROCEDURE_STEPS,
        subject="不存在的工序",
    )

    answer = QAService(repository).answer(query)

    assert answer == answer.not_found(query)
