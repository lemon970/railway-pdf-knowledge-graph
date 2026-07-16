from __future__ import annotations

import json
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field, SecretStr, ValidationError

from backend.app.models import QuestionQuery
from backend.app.services.intent import IntentClientError


class _Message(BaseModel):
    content: str


class _Choice(BaseModel):
    message: _Message


class _ChatCompletion(BaseModel):
    choices: list[_Choice] = Field(min_length=1)


_SYSTEM_PROMPT = """你只负责把铁路检修问题映射到受控查询参数。
只返回一个 JSON 对象，必须且只能包含 intent 和 subject。
intent 只能是 component_association、defect_action、limit_standard、procedure_steps 之一。
subject 使用问题中的铁路部件、缺陷、标准或工序名称。
不得输出 Cypher、解释、Markdown 或其他字段。"""


class AIIntentClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        http_client: httpx.Client | None = None,
    ) -> None:
        _validate_base_url(base_url)
        self._endpoint = f"{base_url.rstrip('/')}/chat/completions"
        self._api_key = SecretStr(api_key)
        self._model = model
        self._http_client = http_client or httpx.Client(timeout=15.0)
        self._owns_http_client = http_client is None

    def classify(self, question: str) -> QuestionQuery:
        try:
            response = self._http_client.post(
                self._endpoint,
                headers={
                    "Authorization": f"Bearer {self._api_key.get_secret_value()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": question},
                    ],
                },
            )
            response.raise_for_status()
            completion = _ChatCompletion.model_validate(response.json())
            payload = json.loads(completion.choices[0].message.content)
            return QuestionQuery.model_validate(payload)
        except (httpx.HTTPError, ValidationError, ValueError, TypeError, KeyError) as error:
            raise IntentClientError("AI intent mapping failed") from error

    def close(self) -> None:
        if self._owns_http_client:
            self._http_client.close()


def _validate_base_url(base_url: str) -> None:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("AI_BASE_URL must be an absolute HTTP(S) URL")
    if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Remote AI endpoints must use HTTPS")
