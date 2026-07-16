import os
import subprocess
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv
from neo4j import GraphDatabase

from backend.app.models import QuestionQuery, QueryIntent
from backend.app.query_templates import build_query


ROOT = Path(__file__).parents[2]
IMPORT_SCRIPT = ROOT / "scripts" / "import" / "import_graph.py"

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def driver():
    load_dotenv(ROOT / ".env", override=True)
    import_result = subprocess.run(
        [sys.executable, str(IMPORT_SCRIPT)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert import_result.returncode == 0, import_result.stdout + import_result.stderr

    neo4j_driver = GraphDatabase.driver(
        os.environ["NEO4J_URI"],
        auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]),
    )
    neo4j_driver.verify_connectivity()
    yield neo4j_driver
    neo4j_driver.close()


@pytest.mark.parametrize("intent", list(QueryIntent))
def test_each_template_is_valid_neo4j_cypher(driver, intent: QueryIntent) -> None:
    prepared = build_query(QuestionQuery(intent=intent, subject="验证模板"))

    with driver.session(database=os.getenv("NEO4J_DATABASE", "neo4j")) as session:
        session.run(
            f"EXPLAIN {prepared.cypher}",
            **prepared.parameters,
        ).consume()


@pytest.mark.parametrize(
    ("intent", "subject", "answer_id", "relation_type"),
    [
        (QueryIntent.COMPONENT_ASSOCIATION, "车轮（含轮盘）", "C001", "PART_OF"),
        (QueryIntent.DEFECT_ACTION, "车轮直径小于Φ800mm", "A001", "REQUIRES_ACTION"),
        (QueryIntent.LIMIT_STANDARD, "车轮（含轮盘）", "S001", "HAS_STANDARD"),
    ],
)
def test_minimum_sample_returns_answer_and_evidence(
    driver,
    intent: QueryIntent,
    subject: str,
    answer_id: str,
    relation_type: str,
) -> None:
    prepared = build_query(QuestionQuery(intent=intent, subject=subject))

    with driver.session(database=os.getenv("NEO4J_DATABASE", "neo4j")) as session:
        record = session.run(prepared.cypher, **prepared.parameters).single(strict=True)

    assert record["answer_id"] == answer_id
    assert record["relation_type"] == relation_type
    assert record["pdf_page"] == 6
    assert record["printed_page"] == 29
    assert record["source_text"]
