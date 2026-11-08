"""Analyst: reads the whole profile once and writes a brief.

The brief is cached per profile and only rebuilt when the profile (or the
prompt version) changes, so it's paid for once, not every question round.
"""

import json

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.domain import DOMAIN_CONTEXT, PROMPT_VERSION
from app.agent.snapshot import profile_snapshot, snapshot_hash
from app.config import settings
from app.models import Profile, ProfileBrief
from app.services.llm import complete_json


class ItemBrief(BaseModel):
    item_id: str
    item_type: str = Field(description='What it really is, e.g. "REST API backend", "ML classifier", "non-tech: volunteering"')
    relevant_role: str | None = Field(description="Closest role from the role list, or null for non-tech")
    clear: list[str] = Field(description="What is already well described")
    vague: list[str] = Field(description="What a recruiter for this kind of item would want but is missing or vague")


class Brief(BaseModel):
    summary: str = Field(description="One or two sentences: who this person is, as a candidate")
    likely_roles: list[str] = Field(description="1-3 roles from the role list this profile fits best")
    strength: int = Field(ge=0, le=100, description="How ready the profile is for strong resumes")
    strength_reasons: list[str] = Field(min_length=1, max_length=3, description="Short reasons for the score")
    items: list[ItemBrief]
    patterns: list[str] = Field(description="Observations across items, e.g. 'three projects use MongoDB, none mention scale'")


ANALYST_PROMPT = f"""{DOMAIN_CONTEXT}

Your job: read the student's whole profile and write a brief about it.
- Judge each item for what kind of thing it is, and what a recruiter for that
  kind of item would want to know. List what is clear and what is vague.
- Facts with source "mcq" or "note" were given by the student; treat them as true.
- Strength: 80+ means most items have concrete scope, tech, scale and outcome.
- Patterns and notes must only cite what is actually in the facts. Never
  attribute a technology to an item that doesn't list it.
- Include every item_id exactly once. Education, certifications and awards
  usually need little; say so briefly."""


def build_brief(profile: Profile) -> tuple[Brief, str]:
    snapshot = profile_snapshot(profile)
    brief = complete_json(
        settings.model_extract, ANALYST_PROMPT, json.dumps(snapshot, default=str), Brief,
        reasoning_effort="medium",
    )
    # Drop anything about items that don't exist.
    known = {item["item_id"] for item in snapshot["items"]}
    brief.items = [i for i in brief.items if i.item_id in known]
    return brief, snapshot_hash(snapshot, PROMPT_VERSION)


def get_brief(db: Session, profile: Profile) -> Brief:
    """Cached brief, rebuilt only if the profile changed since last time."""
    db.refresh(profile)
    current_hash = snapshot_hash(profile_snapshot(profile), PROMPT_VERSION)
    cached = db.scalar(select(ProfileBrief).where(ProfileBrief.profile_id == profile.id))
    if cached and cached.profile_hash == current_hash:
        return Brief.model_validate(cached.brief)

    brief, new_hash = build_brief(profile)
    if not cached:
        cached = ProfileBrief(profile_id=profile.id)
        db.add(cached)
    cached.profile_hash = new_hash
    cached.prompt_version = PROMPT_VERSION
    cached.brief = brief.model_dump()
    db.commit()
    return brief
