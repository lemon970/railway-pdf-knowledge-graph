from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class QueryIntent(str, Enum):
    COMPONENT_ASSOCIATION = "component_association"
    DEFECT_ACTION = "defect_action"
    LIMIT_STANDARD = "limit_standard"
    PROCEDURE_STEPS = "procedure_steps"


class QuestionQuery(BaseModel):
    intent: QueryIntent
    subject: str = Field(min_length=1, max_length=100)

    @field_validator("subject", mode="before")
    @classmethod
    def strip_subject(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class Evidence(BaseModel):
    pdf_page: int = Field(gt=0)
    printed_page: int = Field(gt=0)
    source_text: str = Field(min_length=1)


class EntityReference(BaseModel):
    entity_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    entity_type: Literal["Component", "Defect", "Action", "Standard", "Procedure"]


class RelationReference(BaseModel):
    relation_type: Literal[
        "PART_OF",
        "HAS_DEFECT",
        "REQUIRES_ACTION",
        "HAS_STANDARD",
        "NEXT_STEP",
    ]
    source_id: str = Field(min_length=1)
    target_id: str = Field(min_length=1)


class GraphNode(BaseModel):
    entity_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    entity_type: Literal["Component", "Defect", "Action", "Standard", "Procedure"]
    description: str
    pdf_page: int = Field(gt=0)
    printed_page: int = Field(gt=0)
    source_text: str = Field(min_length=1)


class GraphEdge(BaseModel):
    relation_id: str = Field(min_length=1)
    relation_type: Literal[
        "PART_OF",
        "HAS_DEFECT",
        "REQUIRES_ACTION",
        "HAS_STANDARD",
        "NEXT_STEP",
    ]
    source_id: str = Field(min_length=1)
    target_id: str = Field(min_length=1)
    pdf_page: int = Field(gt=0)
    printed_page: int = Field(gt=0)
    source_text: str = Field(min_length=1)


class GraphResponse(BaseModel):
    center_id: str = Field(min_length=1)
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["connected", "unavailable"]


class QuestionAnswer(BaseModel):
    intent: QueryIntent
    subject: str
    found: bool
    answer: str = Field(min_length=1)
    entities: list[EntityReference] = Field(default_factory=list)
    relations: list[RelationReference] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_evidence_for_found_answer(self) -> QuestionAnswer:
        if self.found and not self.evidence:
            raise ValueError("A found answer must include source evidence")
        if not self.found and self.answer != "未找到证据":
            raise ValueError("An answer without evidence must use the not-found message")
        if not self.found and (self.entities or self.relations or self.evidence):
            raise ValueError("A not-found answer cannot include result payload")
        return self

    @classmethod
    def not_found(cls, query: QuestionQuery) -> QuestionAnswer:
        return cls(
            intent=query.intent,
            subject=query.subject,
            found=False,
            answer="未找到证据",
        )
