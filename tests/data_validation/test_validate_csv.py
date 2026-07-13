import csv
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.validation.validate_csv import validate_files


ENTITY_FIELDS = [
    "entity_id",
    "name",
    "entity_type",
    "description",
    "pdf_page",
    "printed_page",
    "source_text",
    "reviewer",
    "status",
]

RELATION_FIELDS = [
    "relation_id",
    "source_id",
    "relation_type",
    "target_id",
    "pdf_page",
    "printed_page",
    "source_text",
    "reviewer",
    "status",
]


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


@pytest.fixture
def valid_files(tmp_path: Path) -> tuple[Path, Path]:
    entities = tmp_path / "entities.csv"
    relations = tmp_path / "relations.csv"
    write_csv(
        entities,
        ENTITY_FIELDS,
        [
            {
                "entity_id": "C001",
                "name": "轮对",
                "entity_type": "Component",
                "description": "检修对象",
                "pdf_page": "6",
                "printed_page": "29",
                "source_text": "4.3.1 轮对",
                "reviewer": "组长自检",
                "status": "reviewed",
            },
            {
                "entity_id": "D001",
                "name": "车轮直径小于限值",
                "entity_type": "Defect",
                "description": "直径缺陷",
                "pdf_page": "6",
                "printed_page": "29",
                "source_text": "车轮直径小于Φ800mm时整体更换。",
                "reviewer": "组长自检",
                "status": "reviewed",
            },
        ],
    )
    write_csv(
        relations,
        RELATION_FIELDS,
        [
            {
                "relation_id": "R001",
                "source_id": "C001",
                "relation_type": "HAS_DEFECT",
                "target_id": "D001",
                "pdf_page": "6",
                "printed_page": "29",
                "source_text": "车轮直径小于Φ800mm时整体更换。",
                "reviewer": "组长自检",
                "status": "reviewed",
            }
        ],
    )
    return entities, relations


def test_valid_files_have_no_errors(valid_files: tuple[Path, Path]) -> None:
    entities, relations = valid_files

    errors = validate_files(entities, relations)

    assert errors == []


def test_reports_invalid_entity_type_with_csv_row(
    valid_files: tuple[Path, Path],
) -> None:
    entities, relations = valid_files
    rows = list(csv.DictReader(entities.open(encoding="utf-8")))
    rows[0]["entity_type"] = "Unknown"
    write_csv(entities, ENTITY_FIELDS, rows)

    errors = validate_files(entities, relations)

    assert any("entities.csv:2" in error and "Unknown" in error for error in errors)


def test_reports_duplicate_ids_and_missing_relation_endpoint(
    valid_files: tuple[Path, Path],
) -> None:
    entities, relations = valid_files
    entity_rows = list(csv.DictReader(entities.open(encoding="utf-8")))
    entity_rows[1]["entity_id"] = "C001"
    write_csv(entities, ENTITY_FIELDS, entity_rows)
    relation_rows = list(csv.DictReader(relations.open(encoding="utf-8")))
    relation_rows[0]["target_id"] = "D999"
    write_csv(relations, RELATION_FIELDS, relation_rows)

    errors = validate_files(entities, relations)

    assert any("duplicate entity_id C001" in error for error in errors)
    assert any("target_id D999 does not exist" in error for error in errors)


def test_reports_invalid_status_and_missing_evidence(
    valid_files: tuple[Path, Path],
) -> None:
    entities, relations = valid_files
    rows = list(csv.DictReader(relations.open(encoding="utf-8")))
    rows[0]["status"] = "done"
    rows[0]["source_text"] = ""
    write_csv(relations, RELATION_FIELDS, rows)

    errors = validate_files(entities, relations)

    assert any("invalid status done" in error for error in errors)
    assert any("source_text is required" in error for error in errors)


def test_cli_returns_nonzero_for_invalid_data(
    valid_files: tuple[Path, Path],
) -> None:
    entities, relations = valid_files
    rows = list(csv.DictReader(relations.open(encoding="utf-8")))
    rows[0]["relation_type"] = "UNKNOWN_RELATION"
    write_csv(relations, RELATION_FIELDS, rows)

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.validation.validate_csv",
            "--entities",
            str(entities),
            "--relations",
            str(relations),
        ],
        cwd=Path(__file__).parents[2],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 1
    assert "UNKNOWN_RELATION" in result.stdout


def test_reports_entity_id_that_does_not_match_type(
    valid_files: tuple[Path, Path],
) -> None:
    entities, relations = valid_files
    rows = list(csv.DictReader(entities.open(encoding="utf-8")))
    rows[0]["entity_id"] = "D999"
    write_csv(entities, ENTITY_FIELDS, rows)

    errors = validate_files(entities, relations)

    assert any("must use prefix C for Component" in error for error in errors)


def test_reports_nonpositive_page_number(
    valid_files: tuple[Path, Path],
) -> None:
    entities, relations = valid_files
    rows = list(csv.DictReader(entities.open(encoding="utf-8")))
    rows[0]["pdf_page"] = "0"
    write_csv(entities, ENTITY_FIELDS, rows)

    errors = validate_files(entities, relations)

    assert any("pdf_page must be a positive integer" in error for error in errors)


def test_reports_invalid_csv_header(valid_files: tuple[Path, Path]) -> None:
    entities, relations = valid_files
    rows = list(csv.DictReader(entities.open(encoding="utf-8")))
    rows_without_status = [
        {field: row[field] for field in ENTITY_FIELDS[:-1]} for row in rows
    ]
    write_csv(entities, ENTITY_FIELDS[:-1], rows_without_status)

    errors = validate_files(entities, relations)

    assert any("entities.csv:1: invalid header" in error for error in errors)
