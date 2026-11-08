"""Analyst: reads the whole profile once and writes a brief.

The brief is cached per profile and only rebuilt when the profile (or the
prompt version) changes, so it's paid for once, not every question round.
"""

import json
import re
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import progress
from app.agent.domain import DOMAIN_CONTEXT, PROMPT_VERSION, RUBRICS
from app.agent.entities import entity_context, entity_hash
from app.agent.snapshot import profile_snapshot, snapshot_hash
from app.config import settings
from app.models import EntityState, Profile, ProfileBrief, TopicState
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


def get_brief(db: Session, profile: Profile, allow_stale: bool = False) -> Brief:
    """Cached brief, rebuilt only if the profile changed since last time.
    allow_stale: return any cached brief without rebuilding (cheap, for frequent UI refreshes)."""
    db.refresh(profile)
    cached = db.scalar(select(ProfileBrief).where(ProfileBrief.profile_id == profile.id))
    if cached and allow_stale:
        return Brief.model_validate(cached.brief)
    current_hash = snapshot_hash(profile_snapshot(profile), PROMPT_VERSION)
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


# ── Per-entity completeness assessment ───────────────────────────────


class Dimension(BaseModel):
    key: str = Field(description="Rubric key, or a new snake_case key specific to this entity")
    label: str
    state: Literal["COMPLETE", "PARTIAL", "MISSING", "NOT_APPLICABLE"]
    why: str = Field(description="One short, positive sentence on how adding it could help")
    priority: int = Field(ge=1, le=5, description="Value of collecting it for this entity")


class Assessment(BaseModel):
    understanding: str = Field(description="1-2 friendly sentences: what is already clear about this entity")
    dimensions: list[Dimension]


ASSESS_PROMPT = f"""{DOMAIN_CONTEXT}

Your job: assess ONE profile entity for information completeness.
- Read its existing facts first. Anything already explained is COMPLETE; never ask for it again.
- From the rubric, keep only dimensions RELEVANT to this specific entity (a web app, a
  multi-agent system and an ML study need different things). Mark irrelevant ones NOT_APPLICABLE
  or leave them out. You may add up to 3 entity-specific dimensions with new snake_case keys
  (e.g. agent_communication, model_baselines).
- state: COMPLETE (enough already), PARTIAL (some, useful details could be added), MISSING.
- priority 5 = would clearly strengthen how recruiters see this entity; 1 = marginal.
  Personal and education details: only what a resume needs; never chase extra personal data.
- understanding: speak to the student, e.g. "Your description already explains what Shop API
  does and its stack." No criticism."""


def assess_entity(db: Session, profile: Profile, entity_id: str) -> EntityState | None:
    """Assess one entity (cached by content hash) and upsert its topic states.
    Conversation states survive reassessment; information never gets downgraded below
    what an earlier answer established."""
    context = entity_context(profile, entity_id)
    if context is None:
        return None
    state = progress.entity_state(db, profile.id, entity_id, context["section"])
    new_hash = entity_hash(context, PROMPT_VERSION)
    if state.entity_hash == new_hash:
        return state

    rubric = RUBRICS[context["type"]]
    payload = {"entity_type": context["type"], "title": context["title"], "data": context["data"],
               "rubric": rubric}
    result = complete_json(settings.model_extract, ASSESS_PROMPT, json.dumps(payload, default=str),
                           Assessment, reasoning_effort="low")

    existing = {t.key: t for t in progress.topics(db, profile.id, entity_id)}
    seen = set()
    custom = 0
    for d in result.dimensions:
        key = re.sub(r"[^a-z_]", "", d.key.lower())[:40]
        if not key or key in seen:
            continue
        if key not in rubric:
            custom += 1
            if custom > 3:
                continue
        seen.add(key)
        row = existing.get(key)
        if not row:
            row = TopicState(profile_id=profile.id, entity_id=entity_id, key=key)
            db.add(row)
        row.label = rubric.get(key, d.label)
        row.why = d.why
        row.priority = d.priority
        rank = {"SKIPPED": 0, "MISSING": 0, "PARTIAL": 1, "COMPLETE": 2}
        if d.state == "NOT_APPLICABLE":
            row.info_state = "NOT_APPLICABLE"
        elif row.info_state == "SKIPPED" and d.state == "MISSING":
            pass  # still nothing known and the student chose to skip it
        elif rank.get(d.state, 0) >= rank.get(row.info_state, 0) or row.info_state == "NOT_APPLICABLE":
            row.info_state = d.state

    state.understanding = result.understanding
    state.entity_hash = new_hash
    db.commit()
    return state
