from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


ENTITY_FIELDS = (
    "entity_id",
    "name",
    "entity_type",
    "description",
    "pdf_page",
    "printed_page",
    "source_text",
    "reviewer",
    "status",
)

RELATION_FIELDS = (
    "relation_id",
    "source_id",
    "relation_type",
    "target_id",
    "pdf_page",
    "printed_page",
    "source_text",
    "reviewer",
    "status",
)

ENTITY_PREFIXES = {
    "Component": "C",
    "Defect": "D",
    "Action": "A",
    "Standard": "S",
    "Procedure": "P",
}

RELATION_TYPES = {
    "PART_OF",
    "HAS_DEFECT",
    "REQUIRES_ACTION",
    "HAS_STANDARD",
    "NEXT_STEP",
}

RELATION_SIGNATURES = {
    "PART_OF": ({"Component"}, {"Component"}),
    "HAS_DEFECT": ({"Component"}, {"Defect"}),
    "REQUIRES_ACTION": ({"Component", "Defect"}, {"Action"}),
    "HAS_STANDARD": ({"Component", "Action", "Procedure"}, {"Standard"}),
    "NEXT_STEP": ({"Procedure"}, {"Procedure"}),
}

SUBMISSION_RANGES = {
    "member-c": (100, 199),
    "member-d": (200, 299),
}

STATUSES = {"draft", "reviewed", "approved"}
ENTITY_ID_PATTERN = re.compile(r"^[CDASP]\d{3}$")
RELATION_ID_PATTERN = re.compile(r"^R\d{3}$")


def _location(path: Path, row_number: int) -> str:
    return f"{path.name}:{row_number}"


def _read_rows(
    path: Path,
    expected_fields: tuple[str, ...],
    errors: list[str],
) -> list[tuple[int, dict[str, str]]]:
    try:
        handle = path.open(encoding="utf-8-sig", newline="")
    except OSError as error:
        errors.append(f"{path.name}: cannot open file: {error}")
        return []

    with handle:
        reader = csv.DictReader(handle)
        actual_fields = tuple(reader.fieldnames or ())
        if actual_fields != expected_fields:
            errors.append(
                f"{path.name}:1: invalid header; expected {','.join(expected_fields)}"
            )

        rows: list[tuple[int, dict[str, str]]] = []
        for row_number, raw_row in enumerate(reader, start=2):
            row = {
                field: (raw_row.get(field) or "").strip()
                for field in expected_fields
            }
            if any(row.values()):
                rows.append((row_number, row))
        return rows


def _validate_common_fields(
    path: Path,
    row_number: int,
    row: dict[str, str],
    errors: list[str],
) -> None:
    location = _location(path, row_number)
    for field in ("pdf_page", "printed_page"):
        value = row[field]
        if not value:
            errors.append(f"{location}: {field} is required")
        elif not value.isdigit() or int(value) < 1:
            errors.append(f"{location}: {field} must be a positive integer")

    for field in ("source_text", "reviewer"):
        if not row[field]:
            errors.append(f"{location}: {field} is required")

    status = row["status"]
    if status not in STATUSES:
        errors.append(f"{location}: invalid status {status or '<empty>'}")


def _validate_entities(
    path: Path,
    rows: list[tuple[int, dict[str, str]]],
    errors: list[str],
) -> dict[str, str]:
    entity_types: dict[str, str] = {}

    for row_number, row in rows:
        location = _location(path, row_number)
        entity_id = row["entity_id"]
        entity_type = row["entity_type"]

        if not ENTITY_ID_PATTERN.fullmatch(entity_id):
            errors.append(f"{location}: invalid entity_id {entity_id or '<empty>'}")
        if entity_id in entity_types:
            errors.append(f"{location}: duplicate entity_id {entity_id}")
        entity_types[entity_id] = entity_type

        expected_prefix = ENTITY_PREFIXES.get(entity_type)
        if expected_prefix is None:
            errors.append(f"{location}: invalid entity_type {entity_type or '<empty>'}")
        elif entity_id and not entity_id.startswith(expected_prefix):
            errors.append(
                f"{location}: entity_id {entity_id} must use prefix {expected_prefix} "
                f"for {entity_type}"
            )

        for field in ("name", "description"):
            if not row[field]:
                errors.append(f"{location}: {field} is required")

        _validate_common_fields(path, row_number, row, errors)

    return entity_types


def _validate_relations(
    path: Path,
    rows: list[tuple[int, dict[str, str]]],
    entity_types: dict[str, str],
    errors: list[str],
) -> None:
    relation_ids: set[str] = set()

    for row_number, row in rows:
        location = _location(path, row_number)
        relation_id = row["relation_id"]

        if not RELATION_ID_PATTERN.fullmatch(relation_id):
            errors.append(
                f"{location}: invalid relation_id {relation_id or '<empty>'}"
            )
        if relation_id in relation_ids:
            errors.append(f"{location}: duplicate relation_id {relation_id}")
        relation_ids.add(relation_id)

        relation_type = row["relation_type"]
        if relation_type not in RELATION_TYPES:
            errors.append(
                f"{location}: invalid relation_type {relation_type or '<empty>'}"
            )

        for field in ("source_id", "target_id"):
            value = row[field]
            if value not in entity_types:
                errors.append(
                    f"{location}: {field} {value or '<empty>'} does not exist"
                )

        signature = RELATION_SIGNATURES.get(relation_type)
        if (
            signature is not None
            and row["source_id"] in entity_types
            and row["target_id"] in entity_types
        ):
            allowed_sources, allowed_targets = signature
            source_type = entity_types[row["source_id"]]
            target_type = entity_types[row["target_id"]]
            if source_type not in allowed_sources or target_type not in allowed_targets:
                source_label = "/".join(sorted(allowed_sources))
                target_label = "/".join(sorted(allowed_targets))
                errors.append(
                    f"{location}: {relation_type} requires "
                    f"{source_label} -> {target_label}; got "
                    f"{source_type} -> {target_type}"
                )

        _validate_common_fields(path, row_number, row, errors)


def _validate_submission_policy(
    entities_path: Path,
    entity_rows: list[tuple[int, dict[str, str]]],
    relations_path: Path,
    relation_rows: list[tuple[int, dict[str, str]]],
    submission_role: str,
    errors: list[str],
) -> None:
    id_min, id_max = SUBMISSION_RANGES[submission_role]
    if not entity_rows:
        errors.append(f"{entities_path.name}: at least one entity is required")
    if not relation_rows:
        errors.append(f"{relations_path.name}: at least one relation is required")

    for path, rows, id_field in (
        (entities_path, entity_rows, "entity_id"),
        (relations_path, relation_rows, "relation_id"),
    ):
        for row_number, row in rows:
            location = _location(path, row_number)
            identifier = row[id_field]
            if re.fullmatch(r"[CDASPR]\d{3}", identifier):
                number = int(identifier[-3:])
                if not id_min <= number <= id_max:
                    errors.append(
                        f"{location}: {id_field} {identifier} is outside "
                        f"{submission_role} range {id_min}-{id_max}"
                    )
            if row["status"] != "draft":
                errors.append(
                    f"{location}: status must be draft for "
                    f"{submission_role} submission"
                )


def validate_files(
    entities_path: Path,
    relations_path: Path,
    *,
    submission_role: str | None = None,
) -> list[str]:
    errors: list[str] = []
    entity_rows = _read_rows(entities_path, ENTITY_FIELDS, errors)
    relation_rows = _read_rows(relations_path, RELATION_FIELDS, errors)
    entity_types = _validate_entities(entities_path, entity_rows, errors)
    _validate_relations(relations_path, relation_rows, entity_types, errors)
    if submission_role is not None:
        _validate_submission_policy(
            entities_path,
            entity_rows,
            relations_path,
            relation_rows,
            submission_role,
            errors,
        )
    return errors


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate graph import CSV files.")
    parser.add_argument(
        "--entities",
        type=Path,
        default=Path("data/import/entities.csv"),
        help="Path to entities CSV",
    )
    parser.add_argument(
        "--relations",
        type=Path,
        default=Path("data/import/relations.csv"),
        help="Path to relations CSV",
    )
    parser.add_argument(
        "--submission-role",
        choices=tuple(SUBMISSION_RANGES),
        help="Apply member-specific ID range, nonempty, and draft-status checks",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    errors = validate_files(
        args.entities,
        args.relations,
        submission_role=args.submission_role,
    )
    if errors:
        for error in errors:
            print(error)
        print(f"Validation failed with {len(errors)} error(s).")
        return 1

    print("CSV validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
