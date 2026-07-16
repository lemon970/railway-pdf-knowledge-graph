import json

import httpx
import pytest

from backend.app.models import QueryIntent
from backend.app.services.ai_client import AIIntentClient
from backend.app.services.intent import IntentClientError


def response_payload(content: str) -> dict[str, object]:
    return {"choices": [{"message": {"content": content}}]}


def test_ai_client_parses_validated_intent_json() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer test-secret"
        body = json.loads(request.content)
        assert body["model"] == "test-model"
        assert body["temperature"] == 0
        assert "车轮限度是多少" in body["messages"][1]["content"]
        return httpx.Response(
            200,
            json=response_payload(
                '{"intent":"limit_standard","subject":"车轮"}'
            ),
        )

    http_client = httpx.Client(transport=httpx.MockTransport(handler))
    client = AIIntentClient(
        base_url="https://ai.example.test/v1",
        api_key="test-secret",
        model="test-model",
        http_client=http_client,
    )

    query = client.classify("车轮限度是多少？")

    assert query.intent == QueryIntent.LIMIT_STANDARD
    assert query.subject == "车轮"
    assert "test-secret" not in repr(client)


@pytest.mark.parametrize(
    "content",
    [
        "not json",
        '{"intent":"delete_graph","subject":"车轮"}',
        '{"intent":"limit_standard","subject":""}',
        '{"intent":"limit_standard","subject":"车轮","cypher":"MATCH (n)"}',
    ],
)
def test_ai_client_rejects_invalid_or_extra_model_output(content: str) -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(200, json=response_payload(content))
    )
    client = AIIntentClient(
        base_url="https://ai.example.test/v1",
        api_key="secret",
        model="test-model",
        http_client=httpx.Client(transport=transport),
    )

    with pytest.raises(IntentClientError):
        client.classify("任意问题")


def test_ai_client_wraps_http_errors_without_exposing_response() -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(500, text="internal-secret-detail")
    )
    client = AIIntentClient(
        base_url="https://ai.example.test/v1",
        api_key="secret",
        model="test-model",
        http_client=httpx.Client(transport=transport),
    )

    with pytest.raises(IntentClientError, match="AI intent mapping failed") as error:
        client.classify("任意问题")

    assert "internal-secret-detail" not in str(error.value)


def test_remote_ai_endpoint_requires_https() -> None:
    with pytest.raises(ValueError, match="HTTPS"):
        AIIntentClient(
            base_url="http://ai.example.test/v1",
            api_key="secret",
            model="test-model",
        )


def test_local_ai_endpoint_can_use_http() -> None:
    client = AIIntentClient(
        base_url="http://127.0.0.1:11434/v1",
        api_key="local-placeholder",
        model="local-model",
    )

    assert "local-placeholder" not in repr(client)
