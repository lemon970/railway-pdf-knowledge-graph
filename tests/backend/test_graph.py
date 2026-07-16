from backend.app.services.graph import GraphService


class FakeRepository:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self.rows = rows
        self.entity_id = ""

    def fetch_neighborhood(self, entity_id: str) -> list[dict[str, object]]:
        self.entity_id = entity_id
        return self.rows


def neighborhood_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
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
    row.update(overrides)
    return row


def test_neighborhood_builds_nodes_and_directed_edges() -> None:
    repository = FakeRepository([neighborhood_row()])

    graph = GraphService(repository).get_neighborhood("C002")

    assert graph is not None
    assert graph.center_id == "C002"
    assert [node.entity_id for node in graph.nodes] == ["C002", "D001"]
    assert graph.edges[0].model_dump() == {
        "relation_id": "R002",
        "relation_type": "HAS_DEFECT",
        "source_id": "C002",
        "target_id": "D001",
        "pdf_page": 6,
        "printed_page": 29,
        "source_text": "车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",
    }
    assert repository.entity_id == "C002"


def test_neighborhood_deduplicates_center_and_edges() -> None:
    row = neighborhood_row()

    graph = GraphService(FakeRepository([row, dict(row)])).get_neighborhood("C002")

    assert graph is not None
    assert len(graph.nodes) == 2
    assert len(graph.edges) == 1


def test_neighborhood_returns_isolated_center_without_edge() -> None:
    graph = GraphService(
        FakeRepository(
            [
                neighborhood_row(
                    neighbor_id=None,
                    relation_id=None,
                )
            ]
        )
    ).get_neighborhood("C002")

    assert graph is not None
    assert [node.entity_id for node in graph.nodes] == ["C002"]
    assert graph.edges == []


def test_neighborhood_returns_none_for_unknown_entity() -> None:
    graph = GraphService(FakeRepository([])).get_neighborhood("C999")

    assert graph is None
