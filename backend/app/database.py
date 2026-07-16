from __future__ import annotations

from neo4j import GraphDatabase, Neo4jDriver
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from backend.app.query_templates import PreparedQuery
from backend.app.settings import Settings


_NEIGHBORHOOD_QUERY = """
MATCH (center:Entity {entity_id: $entity_id})
OPTIONAL MATCH (center)-[relation]-(neighbor:Entity)
WHERE relation.relation_id IS NOT NULL
RETURN
    center.entity_id AS center_id,
    center.name AS center_name,
    center.entity_type AS center_type,
    center.description AS center_description,
    center.pdf_page AS center_pdf_page,
    center.printed_page AS center_printed_page,
    center.source_text AS center_source_text,
    neighbor.entity_id AS neighbor_id,
    neighbor.name AS neighbor_name,
    neighbor.entity_type AS neighbor_type,
    neighbor.description AS neighbor_description,
    neighbor.pdf_page AS neighbor_pdf_page,
    neighbor.printed_page AS neighbor_printed_page,
    neighbor.source_text AS neighbor_source_text,
    relation.relation_id AS relation_id,
    type(relation) AS relation_type,
    startNode(relation).entity_id AS relation_source_id,
    endNode(relation).entity_id AS relation_target_id,
    relation.pdf_page AS relation_pdf_page,
    relation.printed_page AS relation_printed_page,
    relation.source_text AS relation_source_text
ORDER BY relation.relation_id
""".strip()


class Neo4jRepository:
    def __init__(self, driver: Neo4jDriver, database: str) -> None:
        self.driver = driver
        self.database = database

    @classmethod
    def from_settings(cls, settings: Settings) -> Neo4jRepository:
        driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(
                settings.neo4j_username,
                settings.neo4j_password.get_secret_value(),
            ),
        )
        return cls(driver=driver, database=settings.neo4j_database)

    def is_available(self) -> bool:
        try:
            self.driver.verify_connectivity()
            return True
        except (Neo4jError, ServiceUnavailable, OSError):
            return False

    def execute(self, prepared_query: PreparedQuery) -> list[dict[str, object]]:
        return self._run(prepared_query.cypher, prepared_query.parameters)

    def fetch_neighborhood(self, entity_id: str) -> list[dict[str, object]]:
        return self._run(_NEIGHBORHOOD_QUERY, {"entity_id": entity_id})

    def _run(
        self,
        query: str,
        parameters: dict[str, str],
    ) -> list[dict[str, object]]:
        with self.driver.session(database=self.database) as session:
            return [record.data() for record in session.run(query, **parameters)]

    def close(self) -> None:
        self.driver.close()
