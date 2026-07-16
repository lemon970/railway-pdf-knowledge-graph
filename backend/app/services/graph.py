from __future__ import annotations

from typing import Protocol

from backend.app.models import GraphEdge, GraphNode, GraphResponse


class NeighborhoodRepository(Protocol):
    def fetch_neighborhood(self, entity_id: str) -> list[dict[str, object]]: ...


class GraphService:
    def __init__(self, repository: NeighborhoodRepository) -> None:
        self.repository = repository

    def get_neighborhood(self, entity_id: str) -> GraphResponse | None:
        rows = self.repository.fetch_neighborhood(entity_id)
        if not rows:
            return None

        nodes: dict[str, GraphNode] = {}
        edges: dict[str, GraphEdge] = {}
        for row in rows:
            center = self._node(row, "center")
            nodes.setdefault(center.entity_id, center)

            if row.get("neighbor_id"):
                neighbor = self._node(row, "neighbor")
                nodes.setdefault(neighbor.entity_id, neighbor)

            if row.get("relation_id"):
                edge = GraphEdge(
                    relation_id=str(row["relation_id"]),
                    relation_type=str(row["relation_type"]),
                    source_id=str(row["relation_source_id"]),
                    target_id=str(row["relation_target_id"]),
                    pdf_page=int(row["relation_pdf_page"]),
                    printed_page=int(row["relation_printed_page"]),
                    source_text=str(row["relation_source_text"]),
                )
                edges.setdefault(edge.relation_id, edge)

        return GraphResponse(
            center_id=str(rows[0]["center_id"]),
            nodes=list(nodes.values()),
            edges=list(edges.values()),
        )

    @staticmethod
    def _node(row: dict[str, object], prefix: str) -> GraphNode:
        return GraphNode(
            entity_id=str(row[f"{prefix}_id"]),
            name=str(row[f"{prefix}_name"]),
            entity_type=str(row[f"{prefix}_type"]),
            description=str(row[f"{prefix}_description"]),
            pdf_page=int(row[f"{prefix}_pdf_page"]),
            printed_page=int(row[f"{prefix}_printed_page"]),
            source_text=str(row[f"{prefix}_source_text"]),
        )
