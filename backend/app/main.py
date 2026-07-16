from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Protocol

from fastapi import FastAPI, Path, Request, Response, status
from fastapi.responses import JSONResponse
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from backend.app.database import Neo4jRepository
from backend.app.models import (
    GraphResponse,
    HealthResponse,
    NaturalQuestion,
    QuestionAnswer,
    QuestionQuery,
)
from backend.app.query_templates import PreparedQuery
from backend.app.services.graph import GraphService
from backend.app.services.ai_client import AIIntentClient
from backend.app.services.intent import IntentService, UnknownIntentError
from backend.app.services.qa import QAService
from backend.app.settings import Settings


class AppRepository(Protocol):
    def is_available(self) -> bool: ...

    def execute(self, prepared_query: PreparedQuery) -> list[dict[str, object]]: ...

    def fetch_neighborhood(self, entity_id: str) -> list[dict[str, object]]: ...

    def close(self) -> None: ...


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


def create_app(
    repository: AppRepository | None = None,
    intent_service: IntentService | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        managed_repository = repository
        owns_repository = managed_repository is None
        settings = None
        if managed_repository is None:
            settings = Settings()
            managed_repository = Neo4jRepository.from_settings(settings)
        managed_intent_service = intent_service
        owns_intent_service = managed_intent_service is None
        if managed_intent_service is None:
            managed_intent_service = (
                _intent_service_from_settings(settings)
                if settings is not None
                else IntentService()
            )
        app.state.repository = managed_repository
        app.state.intent_service = managed_intent_service
        try:
            yield
        finally:
            if owns_repository:
                managed_repository.close()
            if owns_intent_service:
                managed_intent_service.close()

    application = FastAPI(
        title="铁路检修知识图谱问答 API",
        version="0.1.0",
        lifespan=lifespan,
    )

    @application.exception_handler(AppError)
    async def handle_app_error(_request: Request, error: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                }
            },
        )

    def current_repository(request: Request) -> AppRepository:
        return request.app.state.repository

    def current_intent_service(request: Request) -> IntentService:
        return request.app.state.intent_service

    @application.get("/health", response_model=HealthResponse)
    def health(request: Request, response: Response) -> HealthResponse:
        if current_repository(request).is_available():
            return HealthResponse(status="ok", database="connected")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="degraded", database="unavailable")

    @application.post("/api/questions", response_model=QuestionAnswer)
    def answer_question(request: Request, query: QuestionQuery) -> QuestionAnswer:
        try:
            return QAService(current_repository(request)).answer(query)
        except (Neo4jError, ServiceUnavailable, OSError) as error:
            raise AppError(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "DATABASE_UNAVAILABLE",
                "图数据库暂时不可用",
            ) from error

    @application.post("/api/natural-questions", response_model=QuestionAnswer)
    def answer_natural_question(
        request: Request,
        question: NaturalQuestion,
    ) -> QuestionAnswer:
        try:
            parsed = current_intent_service(request).parse(question.question)
        except UnknownIntentError as error:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "UNKNOWN_INTENT",
                "暂不支持这类问题",
            ) from error
        try:
            answer = QAService(current_repository(request)).answer(parsed.query)
        except (Neo4jError, ServiceUnavailable, OSError) as error:
            raise AppError(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "DATABASE_UNAVAILABLE",
                "图数据库暂时不可用",
            ) from error
        return answer.model_copy(
            update={"processing_method": parsed.processing_method}
        )

    @application.get("/api/graph/{entity_id}", response_model=GraphResponse)
    def graph_neighborhood(
        request: Request,
        entity_id: Annotated[str, Path(pattern=r"^[CDASP]\d{3}$")],
    ) -> GraphResponse:
        try:
            graph = GraphService(current_repository(request)).get_neighborhood(entity_id)
        except (Neo4jError, ServiceUnavailable, OSError) as error:
            raise AppError(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "DATABASE_UNAVAILABLE",
                "图数据库暂时不可用",
            ) from error
        if graph is None:
            raise AppError(
                status.HTTP_404_NOT_FOUND,
                "ENTITY_NOT_FOUND",
                f"未找到实体 {entity_id}",
            )
        return graph

    return application


app = create_app()


def _intent_service_from_settings(settings: Settings) -> IntentService:
    if not settings.ai_enabled:
        return IntentService()
    api_key = settings.ai_api_key.get_secret_value()
    if not settings.ai_base_url or not api_key or not settings.ai_model:
        raise ValueError(
            "AI_ENABLED requires AI_BASE_URL, AI_API_KEY, and AI_MODEL"
        )
    return IntentService(
        ai_client=AIIntentClient(
            base_url=settings.ai_base_url,
            api_key=api_key,
            model=settings.ai_model,
        ),
        ai_enabled=True,
    )
