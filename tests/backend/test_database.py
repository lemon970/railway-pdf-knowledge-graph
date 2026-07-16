from neo4j.exceptions import ServiceUnavailable

from backend.app.database import Neo4jRepository
from backend.app.query_templates import PreparedQuery


class FakeRecord:
    def __init__(self, data: dict[str, object]) -> None:
        self._data = data

    def data(self) -> dict[str, object]:
        return self._data


class FakeSession:
    def __init__(self, records: list[dict[str, object]]) -> None:
        self.records = records
        self.query = ""
        self.parameters: dict[str, object] = {}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def run(self, query: str, **parameters: object):
        self.query = query
        self.parameters = parameters
        return [FakeRecord(record) for record in self.records]


class FakeDriver:
    def __init__(
        self,
        records: list[dict[str, object]] | None = None,
        health_error: Exception | None = None,
    ) -> None:
        self.fake_session = FakeSession(records or [])
        self.database = ""
        self.health_error = health_error
        self.closed = False

    def session(self, *, database: str):
        self.database = database
        return self.fake_session

    def verify_connectivity(self) -> None:
        if self.health_error:
            raise self.health_error

    def close(self) -> None:
        self.closed = True


def test_execute_uses_configured_database_and_parameters() -> None:
    driver = FakeDriver([{"answer_id": "A001"}])
    repository = Neo4jRepository(driver=driver, database="railway")
    prepared = PreparedQuery(
        cypher="MATCH (n {name: $subject}) RETURN n",
        parameters={"subject": "车轮"},
    )

    rows = repository.execute(prepared)

    assert rows == [{"answer_id": "A001"}]
    assert driver.database == "railway"
    assert driver.fake_session.query == prepared.cypher
    assert driver.fake_session.parameters == {"subject": "车轮"}


def test_health_check_reports_connection_state_without_raising() -> None:
    assert Neo4jRepository(driver=FakeDriver(), database="neo4j").is_available()
    assert not Neo4jRepository(
        driver=FakeDriver(health_error=ServiceUnavailable("offline")),
        database="neo4j",
    ).is_available()


def test_close_closes_driver() -> None:
    driver = FakeDriver()

    Neo4jRepository(driver=driver, database="neo4j").close()

    assert driver.closed is True


def test_neighborhood_query_uses_entity_id_as_parameter() -> None:
    driver = FakeDriver([{"center_id": "C001"}])
    repository = Neo4jRepository(driver=driver, database="neo4j")

    rows = repository.fetch_neighborhood("C001")

    assert rows == [{"center_id": "C001"}]
    assert "$entity_id" in driver.fake_session.query
    assert "C001" not in driver.fake_session.query
    assert driver.fake_session.parameters == {"entity_id": "C001"}

