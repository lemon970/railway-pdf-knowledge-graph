from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase, Neo4jDriver
from neo4j.exceptions import Neo4jError


ROOT = Path(__file__).parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.validation.validate_csv import (  # noqa: E402
    ENTITY_PREFIXES,
    RELATION_TYPES,
    validate_files,
)


SCRIPT_DIR = Path(__file__).parent
DEFAULT_ENTITIES = ROOT / "data" / "import" / "entities.csv"
DEFAULT_RELATIONS = ROOT / "data" / "import" / "relations.csv"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [
            {key: (value or "").strip() for key, value in row.items()}
            for row in csv.DictReader(handle)
            if any((value or "").strip() for value in row.values())
        ]


def read_cypher(path: Path) -> list[str]:
    return [statement.strip() for statement in path.read_text(encoding="utf-8").split(";") if statement.strip()]


def run_cypher_file(driver: Neo4jDriver, database: str, path: Path) -> None:
    with driver.session(database=database) as session:
        for statement in read_cypher(path):
            session.run(statement).consume()


def clear_graph(driver: Neo4jDriver, database: str) -> None:
    run_cypher_file(driver, database, SCRIPT_DIR / "clear_graph.cypher")


def create_constraints(driver: Neo4jDriver, database: str) -> None:
    run_cypher_file(driver, database, SCRIPT_DIR / "init_constraints.cypher")


def import_entities(
    driver: Neo4jDriver,
    database: str,
    entities: list[dict[str, str]],
) -> None:
    allowed_labels = set(ENTITY_PREFIXES)
    with driver.session(database=database) as session:
        for entity in entities:
            label = entity["entity_type"]
            if label not in allowed_labels:
                raise ValueError(f"Unsupported entity label: {label}")
            query = (
                f"MERGE (entity:Entity:{label} {{entity_id: $entity_id}}) "
                "SET entity.name = $name, "
                "entity.entity_type = $entity_type, "
                "entity.description = $description, "
                "entity.pdf_page = $pdf_page, "
                "entity.printed_page = $printed_page, "
                "entity.source_text = $source_text, "
                "entity.reviewer = $reviewer, "
                "entity.status = $status"
            )
            parameters = dict(entity)
            parameters["pdf_page"] = int(entity["pdf_page"])
            parameters["printed_page"] = int(entity["printed_page"])
            session.run(query, **parameters).consume()


def import_relations(
    driver: Neo4jDriver,
    database: str,
    relations: list[dict[str, str]],
) -> None:
    with driver.session(database=database) as session:
        for item in relations:
            relation_type = item["relation_type"]
            if relation_type not in RELATION_TYPES:
                raise ValueError(f"Unsupported relationship type: {relation_type}")
            query = (
                "MATCH (source:Entity {entity_id: $source_id}) "
                "MATCH (target:Entity {entity_id: $target_id}) "
                f"MERGE (source)-[relation:{relation_type} "
                "{relation_id: $relation_id}]->(target) "
                "SET relation.relation_type = $relation_type, "
                "relation.pdf_page = $pdf_page, "
                "relation.printed_page = $printed_page, "
                "relation.source_text = $source_text, "
                "relation.reviewer = $reviewer, "
                "relation.status = $status"
            )
            parameters = dict(item)
            parameters["pdf_page"] = int(item["pdf_page"])
            parameters["printed_page"] = int(item["printed_page"])
            session.run(query, **parameters).consume()


def graph_counts(driver: Neo4jDriver, database: str) -> tuple[int, int]:
    with driver.session(database=database) as session:
        record = session.run(
            "MATCH (entity:Entity) "
            "OPTIONAL MATCH ()-[relation]->() "
            "WHERE relation.relation_id IS NOT NULL "
            "RETURN count(DISTINCT entity) AS nodes, "
            "count(DISTINCT relation) AS relationships"
        ).single(strict=True)
        return record["nodes"], record["relationships"]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import reviewed CSV data into Neo4j.")
    parser.add_argument("--entities", type=Path, default=DEFAULT_ENTITIES)
    parser.add_argument("--relations", type=Path, default=DEFAULT_RELATIONS)
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete project Entity nodes and exit without importing",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    load_dotenv(ROOT / ".env", override=True)

    required = ("NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        print(f"Missing configuration: {', '.join(missing)}", file=sys.stderr)
        return 1

    database = os.getenv("NEO4J_DATABASE", "neo4j")
    driver = GraphDatabase.driver(
        os.environ["NEO4J_URI"],
        auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]),
    )

    try:
        driver.verify_connectivity()
        if args.clear:
            clear_graph(driver, database)
            nodes, relationships = graph_counts(driver, database)
            print(f"Graph cleared: nodes={nodes}, relationships={relationships}")
            return 0

        errors = validate_files(args.entities, args.relations)
        if errors:
            for error in errors:
                print(error)
            print(f"Import stopped: CSV validation failed with {len(errors)} error(s).")
            return 1

        entities = read_csv(args.entities)
        relations = read_csv(args.relations)
        create_constraints(driver, database)
        import_entities(driver, database, entities)
        import_relations(driver, database, relations)
        nodes, relationships = graph_counts(driver, database)
        print(f"Import completed: nodes={nodes}, relationships={relationships}")
        return 0
    except (Neo4jError, OSError, ValueError) as error:
        print(f"Import failed: {error}", file=sys.stderr)
        return 1
    finally:
        driver.close()


if __name__ == "__main__":
    raise SystemExit(main())
