import csv
import os
import subprocess
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv
from neo4j import GraphDatabase


ROOT = Path(__file__).parents[2]
IMPORT_SCRIPT = ROOT / "scripts" / "import" / "import_graph.py"

pytestmark = pytest.mark.integration


def run_import_command(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(IMPORT_SCRIPT), *arguments],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.fixture(scope="module")
def driver():
    load_dotenv(ROOT / ".env", override=True)
    neo4j_driver = GraphDatabase.driver(
        os.environ["NEO4J_URI"],
        auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]),
    )
    neo4j_driver.verify_connectivity()
    yield neo4j_driver
    neo4j_driver.close()


def graph_counts(driver) -> tuple[int, int]:
    with driver.session(database=os.getenv("NEO4J_DATABASE", "neo4j")) as session:
        record = session.run(
            "MATCH (n:Entity) "
            "OPTIONAL MATCH ()-[r]->() "
            "WHERE r.relation_id IS NOT NULL "
            "RETURN count(DISTINCT n) AS nodes, count(DISTINCT r) AS relationships"
        ).single(strict=True)
        return record["nodes"], record["relationships"]


def import_file_counts() -> tuple[int, int]:
    def count_rows(filename: str) -> int:
        with (ROOT / "data" / "import" / filename).open(
            encoding="utf-8-sig", newline=""
        ) as handle:
            return sum(1 for row in csv.DictReader(handle) if any(row.values()))

    return count_rows("entities.csv"), count_rows("relations.csv")


def test_clear_import_and_reimport_are_repeatable(driver) -> None:
    clear_result = run_import_command("--clear")
    assert clear_result.returncode == 0, clear_result.stdout + clear_result.stderr
    assert graph_counts(driver) == (0, 0)

    first_import = run_import_command()
    assert first_import.returncode == 0, first_import.stdout + first_import.stderr
    assert graph_counts(driver) == import_file_counts()

    second_import = run_import_command()
    assert second_import.returncode == 0, second_import.stdout + second_import.stderr
    assert graph_counts(driver) == import_file_counts()

    with driver.session(database=os.getenv("NEO4J_DATABASE", "neo4j")) as session:
        record = session.run(
            "MATCH (component:Component {entity_id: 'C002'})"
            "-[relation:HAS_DEFECT]->"
            "(defect:Defect {entity_id: 'D001'}) "
            "RETURN component.name AS component, defect.name AS defect, "
            "relation.pdf_page AS pdf_page, relation.printed_page AS printed_page"
        ).single(strict=True)

    assert record.data() == {
        "component": "车轮（含轮盘）",
        "defect": "车轮直径小于Φ800mm",
        "pdf_page": 6,
        "printed_page": 29,
    }
