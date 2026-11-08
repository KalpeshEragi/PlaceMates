import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict

ItemKind = Literal["experience", "project", "education", "research", "certification", "award", "other"]
FactSource = Literal["resume", "mcq", "note", "manual"]


class FactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    field: str
    value: object
    source: str
    confidence: float


class FactIn(BaseModel):
    field: str
    value: object
    source: FactSource = "manual"


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    kind: str
    title: str
    organization: str | None
    start_date: str | None
    end_date: str | None
    original_text: str | None
    facts: list[FactOut]


class ItemIn(BaseModel):
    kind: ItemKind
    title: str
    organization: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    source: str


class BasicsIn(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    headline: str | None = None
    summary: str | None = None
    links: list[str] = []


class ProfileOut(BasicsIn):
    model_config = ConfigDict(from_attributes=True)
    items: list[ItemOut]
    skills: list[SkillOut]


# ── What the extraction model must return ───────────────────


class ParsedItem(BaseModel):
    kind: ItemKind
    title: str
    organization: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    bullets: list[str] = []
    tech: list[str] = []


class ParsedResume(BaseModel):
    basics: BasicsIn
    skills: list[str] = []
    items: list[ParsedItem] = []
