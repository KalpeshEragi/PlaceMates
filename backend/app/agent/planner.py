"""Planner: decides which knowledge gaps are worth asking about next."""

import json
import re

from pydantic import BaseModel, Field

from app.agent.domain import DOMAIN_CONTEXT
from app.config import settings
from app.services.llm import complete_json

ROUND_SIZE = 5
SESSION_LIMIT = 20
PER_ITEM_PER_ROUND = 2
PER_ITEM_PER_SESSION = 4


class Gap(BaseModel):
    item_id: str
    topic: str = Field(description='Short label, e.g. "transaction volume", "dataset size", "your role"')
    reason: str = Field(description="Why a recruiter for this kind of item would care")
    value: int = Field(ge=1, le=5, description="How much the answer would improve the resume")


class Plan(BaseModel):
    gaps: list[Gap]
    stop: bool = Field(description="True when nothing valuable is left to ask")


PLANNER_PROMPT = f"""{DOMAIN_CONTEXT}

Your job: pick the most valuable missing details to ask the student about next.
- Use the brief's "vague" notes and the latest facts (facts may have changed since the brief).
- Never repeat a topic already asked about for that item (see "already_asked").
- Pending follow-ups from earlier answers come first if still useful.
- Prefer items most relevant to the likely or target roles. Non-tech items:
  at most one light question about leadership or teamwork.
- Skip education unless something important is missing.
- Up to {ROUND_SIZE} gaps. Set stop=true if nothing with value >= 3 is left."""


GENERIC = {"and", "or", "the", "of", "your", "used", "use", "details", "detail", "info", "stack", "type",
           "environment", "source", "count", "number", "level"}
SYNONYMS = {"technologies": "tech", "technology": "tech", "tools": "tech", "framework": "tech",
            "storage": "database", "db": "database", "datastore": "database",
            "deployed": "deployment", "hosting": "deployment", "hosted": "deployment",
            "accuracy": "metric", "metrics": "metric", "users": "users", "usage": "users"}


def _topic_words(text: str) -> set[str]:
    words = re.findall(r"[a-z]+", text.lower().replace("_", " "))
    return {SYNONYMS.get(w, w) for w in words} - GENERIC


def _already_known(topic: str, item: dict) -> bool:
    """True if a fact on this item already covers the topic (e.g. 'dataset size' vs field 'dataset_size')."""
    words = _topic_words(topic)
    return bool(words) and any(_topic_words(f["field"]) & words for f in item["facts"] if f["field"] != "bullet")


def plan(brief: dict, snapshot: dict, asked: list[str], followups: list[dict],
         target_role: str | None, remaining: int) -> list[Gap]:
    payload = {
        "brief": brief, "profile": snapshot, "already_asked": asked,
        "pending_followups": followups, "target_role": target_role,
    }
    result = complete_json(settings.model_questions, PLANNER_PROMPT, json.dumps(payload, default=str), Plan,
                           reasoning_effort="low")
    if result.stop:
        return []

    # Code enforces the limits; the model only proposes.
    items = {i["item_id"]: i for i in snapshot["items"]}
    known = set(items)
    asked_set = {a.lower() for a in asked}
    per_session: dict[str, int] = {}
    for key in asked:
        per_session[key.split(":", 1)[0]] = per_session.get(key.split(":", 1)[0], 0) + 1

    chosen: list[Gap] = []
    per_round: dict[str, int] = {}
    for gap in sorted(result.gaps, key=lambda g: -g.value):
        key = f"{gap.item_id}:{gap.topic}".lower()
        if (gap.item_id not in known or key in asked_set or gap.value < 3
                or _already_known(gap.topic, items[gap.item_id])
                or per_round.get(gap.item_id, 0) >= PER_ITEM_PER_ROUND
                or per_session.get(gap.item_id, 0) + per_round.get(gap.item_id, 0) >= PER_ITEM_PER_SESSION):
            continue
        chosen.append(gap)
        asked_set.add(key)
        per_round[gap.item_id] = per_round.get(gap.item_id, 0) + 1
        if len(chosen) >= min(ROUND_SIZE, remaining):
            break
    return chosen
