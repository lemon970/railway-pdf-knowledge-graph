import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.database import Neo4jRepository
from backend.app.main import create_app
from backend.app.settings import Settings


ROOT = Path(__file__).parents[2]
IMPORT_SCRIPT = ROOT / "scripts" / "import" / "import_graph.py"

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def client():
    import_result = subprocess.run(
        [sys.executable, str(IMPORT_SCRIPT)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert import_result.returncode == 0, import_result.stdout + import_result.stderr

    repository = Neo4jRepository.from_settings(Settings())
    with TestClient(create_app(repository)) as test_client:
        yield test_client
    repository.close()


def test_real_health_endpoint_reports_connected_database(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["database"] == "connected"


def test_real_question_endpoint_returns_sample_answer(client: TestClient) -> None:
    response = client.post(
        "/api/questions",
        json={
            "intent": "defect_action",
            "subject": "车轮直径小于Φ800mm",
        },
    )

    assert response.status_code == 200
    assert response.json()["entities"][1]["entity_id"] == "A001"
    assert response.json()["evidence"][0]["pdf_page"] == 6


def test_real_natural_question_uses_rule_fallback(client: TestClient) -> None:
    response = client.post(
        "/api/natural-questions",
        json={"question": "车轮直径小于Φ800mm怎么处理？"},
    )

    assert response.status_code == 200
    assert response.json()["processing_method"] == "rule"
    assert response.json()["entities"][1]["entity_id"] == "A001"


def test_real_graph_endpoint_returns_sample_neighborhood(client: TestClient) -> None:
    response = client.get("/api/graph/C002")

    assert response.status_code == 200
    body = response.json()
    assert body["center_id"] == "C002"
    assert {node["entity_id"] for node in body["nodes"]} == {
        "C001",
        "C002",
        "D001",
        "A001",
        "S001",
    }
    assert {edge["relation_id"] for edge in body["edges"]} == {
        "R001",
        "R002",
        "R004",
        "R005",
    }
