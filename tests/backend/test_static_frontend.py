from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app


class FakeRepository:
    def is_available(self) -> bool:
        return True

    def execute(self, _prepared_query):
        return []

    def fetch_neighborhood(self, _entity_id: str):
        return []


def write_frontend_dist(dist_dir: Path) -> None:
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True)
    (dist_dir / "index.html").write_text(
        '<!doctype html><html lang="zh-CN"><body>铁路知识图谱</body></html>',
        encoding="utf-8",
    )
    (assets_dir / "app.js").write_text(
        'console.log("railway-app")',
        encoding="utf-8",
    )


def test_serves_built_index_and_assets_from_injected_dist(tmp_path: Path) -> None:
    dist_dir = tmp_path / "frontend" / "dist"
    write_frontend_dist(dist_dir)

    with TestClient(
        create_app(FakeRepository(), frontend_dist=dist_dir)
    ) as client:
        index_response = client.get("/")
        asset_response = client.get("/assets/app.js")

    assert index_response.status_code == 200
    assert index_response.headers["content-type"].startswith("text/html")
    assert "铁路知识图谱" in index_response.text
    assert asset_response.status_code == 200
    assert "railway-app" in asset_response.text


def test_reports_chinese_status_when_frontend_is_not_built(tmp_path: Path) -> None:
    missing_dist = tmp_path / "missing-dist"

    with TestClient(
        create_app(FakeRepository(), frontend_dist=missing_dist)
    ) as client:
        response = client.get("/")

    assert response.status_code == 503
    assert response.json() == {
        "status": "frontend_unavailable",
        "message": "前端尚未构建",
    }


def test_static_frontend_does_not_intercept_backend_routes(tmp_path: Path) -> None:
    dist_dir = tmp_path / "dist"
    write_frontend_dist(dist_dir)

    with TestClient(
        create_app(FakeRepository(), frontend_dist=dist_dir)
    ) as client:
        docs_response = client.get("/docs")
        openapi_response = client.get("/openapi.json")
        health_response = client.get("/health")
        api_response = client.post(
            "/api/questions",
            json={"intent": "procedure_steps", "subject": "不存在的工序"},
        )

    assert docs_response.status_code == 200
    assert openapi_response.status_code == 200
    assert health_response.status_code == 200
    assert health_response.json() == {"status": "ok", "database": "connected"}
    assert api_response.status_code == 200
    assert api_response.json()["answer"] == "未找到证据"


def test_does_not_add_spa_catch_all(tmp_path: Path) -> None:
    dist_dir = tmp_path / "dist"
    write_frontend_dist(dist_dir)

    with TestClient(
        create_app(FakeRepository(), frontend_dist=dist_dir)
    ) as client:
        response = client.get("/not-a-real-route")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
