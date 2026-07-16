from fastapi.testclient import TestClient
from neo4j.exceptions import ServiceUnavailable

from backend.app.main import create_app


class FakeRepository:
    def __init__(
        self,
        *,
        available: bool = True,
        query_rows: list[dict[str, object]] | None = None,
        graph_rows: list[dict[str, object]] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.available = available
        self.query_rows = query_rows or []
        self.graph_rows = graph_rows or []
        self.error = error

    def is_available(self) -> bool:
        return self.available

    def execute(self, _prepared_query):
        if self.error:
            raise self.error
        return self.query_rows

    def fetch_neighborhood(self, _entity_id: str):
        if self.error:
            raise self.error
        return self.graph_rows


def question_row() -> dict[str, object]:
    return {
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


def graph_row() -> dict[str, object]:
    return {
        "center_id": "C002",
        "center_name": "车轮（含轮盘）",
        "center_type": "Component",
        "center_description": "轮对中的车轮部件",
        "center_pdf_page": 6,
        "center_printed_page": 29,
        "center_source_text": "4.3.1.1 车轮（含轮盘）",
        "neighbor_id": "D001",
        "neighbor_name": "车轮直径小于Φ800mm",
        "neighbor_type": "Defect",
        "neighbor_description": "车轮直径低于整体更换界限",
        "neighbor_pdf_page": 6,
        "neighbor_printed_page": 29,
        "neighbor_source_text": "车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
        "relation_id": "R002",
        "relation_type": "HAS_DEFECT",
        "relation_source_id": "C002",
        "relation_target_id": "D001",
        "relation_pdf_page": 6,
        "relation_printed_page": 29,
        "relation_source_text": "车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
    }


def test_health_reports_connected_database() -> None:
    with TestClient(create_app(FakeRepository())) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_health_reports_database_unavailable() -> None:
    with TestClient(create_app(FakeRepository(available=False))) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}


def test_question_endpoint_returns_answer_and_evidence() -> None:
    repository = FakeRepository(query_rows=[question_row()])
    with TestClient(create_app(repository)) as client:
        response = client.post(
            "/api/questions",
            json={
                "intent": "defect_action",
                "subject": "车轮直径小于Φ800mm",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["found"] is True
    assert body["entities"][1]["entity_id"] == "A001"
    assert body["evidence"][0]["pdf_page"] == 6


def test_question_endpoint_returns_not_found_without_inventing_answer() -> None:
    with TestClient(create_app(FakeRepository())) as client:
        response = client.post(
            "/api/questions",
            json={"intent": "procedure_steps", "subject": "不存在的工序"},
        )

    assert response.status_code == 200
    assert response.json()["answer"] == "未找到证据"
    assert response.json()["evidence"] == []


def test_graph_endpoint_returns_nodes_and_edges() -> None:
    repository = FakeRepository(graph_rows=[graph_row()])
    with TestClient(create_app(repository)) as client:
        response = client.get("/api/graph/C002")

    assert response.status_code == 200
    body = response.json()
    assert body["center_id"] == "C002"
    assert len(body["nodes"]) == 2
    assert body["edges"][0]["relation_id"] == "R002"


def test_graph_endpoint_returns_structured_not_found_error() -> None:
    with TestClient(create_app(FakeRepository())) as client:
        response = client.get("/api/graph/C999")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "ENTITY_NOT_FOUND",
            "message": "未找到实体 C999",
        }
    }


def test_database_error_returns_generic_service_error() -> None:
    repository = FakeRepository(
        error=ServiceUnavailable("bolt://user:password@localhost is offline")
    )
    with TestClient(create_app(repository)) as client:
        response = client.post(
            "/api/questions",
            json={"intent": "limit_standard", "subject": "车轮"},
        )

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "DATABASE_UNAVAILABLE",
            "message": "图数据库暂时不可用",
        }
    }
    assert "password" not in response.text
