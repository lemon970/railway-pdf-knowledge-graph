CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (entity:Entity)
REQUIRE entity.entity_id IS UNIQUE;

