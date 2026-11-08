"""Interpreter: turns ONE saved answer into profile facts through validated tools.

The raw answer is already in agent_answers before this runs. The model returns all
its tool calls in one structured response; each call goes through a tool function
that decides whether it's allowed (right entity, known dimension, value grounded in
what the student actually picked or wrote). Rejected calls get one repair round.

Idempotent: facts carry answer_id, and re-interpreting an answer replaces exactly
the facts that came from it, so retries never duplicate anything.
"""

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.agent import progress
from app.agent.domain import PROMPT_VERSION
from app.config import settings
from app.models import AgentAnswer, ItemFact, Profile, Skill
from app.services.llm import LLMError, complete_json

log = logging.getLogger(__name__)
WORD = re.compile(r"[a-z0-9]+")
BASIC_FIELDS = {"location", "headline", "link"}


class ToolCall(BaseModel):
    tool: Literal["record_fact", "update_dimension", "add_skill", "set_basic"]
    dimension: str | None = Field(default=None, description="record_fact/update_dimension: dimension key")
    name: str | None = Field(default=None, description="record_fact: specific fact name, e.g. 'metric', 'daily_users'")
    value: str | list[str] | None = None
    from_option: bool = Field(default=False, description="record_fact: value is exactly picked option label(s)")
    state: Literal["COMPLETE", "PARTIAL"] | None = Field(default=None, description="update_dimension")
    field: str | None = Field(default=None, description="set_basic: location | headline | link")


class ToolPlan(BaseModel):
    calls: list[ToolCall]


INTERPRETER_PROMPT = """You record what a student said about one profile entity as structured facts.
Never add, assume or round up anything they did not say.

Return every tool call you need in "calls":
- record_fact(dimension, name, value, from_option): one per distinct piece of information.
  dimension = the dimension the information belongs to, NOT the question's topic by default.
  Example: asked about architecture, the student also says "deployed on Render, used daily by
  the canteen" -> deployment.platform = "Render" and scale_usage.users = "college canteen, daily",
  plus update_dimension for architecture, deployment and scale_usage.
  name = short snake_case fact name. Keep distinct concepts distinct
  (e.g. active_backlog_count vs cleared_backlog_count).
  from_option=true only when value is exactly picked option label(s); otherwise use their words.
- update_dimension(dimension, state): for EVERY dimension this answer now covers
  (COMPLETE = enough detail, PARTIAL = some). One answer can cover several dimensions.
- add_skill(value): only for the skills entity.
- set_basic(field, value): only for the personal entity; field is location, headline or link.
- "Not sure" / "Prefer not to answer" / empty answers: no calls."""


URL = re.compile(r"(?<![@\w.])(?:https?://)?(?:[\w-]+\.)+[a-z]{2,}(?:/[^\s,;)]*)?", re.I)
# Real web domain endings only, so "Node.js" or "next.config" never become links.
TLDS = {"com", "in", "dev", "io", "me", "org", "net", "app", "co", "ai", "xyz", "tech", "site", "page",
        "edu", "info", "live", "vercel", "pages", "online", "blog"}


def extract_urls(text: str) -> list[str]:
    """'github.com/x and linkedin.com/in/y' -> ['https://github.com/x', 'https://linkedin.com/in/y']."""
    urls = []
    for m in URL.findall(text or ""):
        url = m.rstrip(".")
        host = re.sub(r"^https?://", "", url, flags=re.I).split("/")[0]
        if host.rsplit(".", 1)[-1].lower() not in TLDS:
            continue
        urls.append(url if url.lower().startswith("http") else f"https://{url}")
    return list(dict.fromkeys(urls))


def _stems(text: str) -> set[str]:
    """Whole words with plurals folded ('metrics' -> 'metric'); prefixes would confuse
    'controllers' with 'contribution'."""
    return {w[:-1] if w.endswith("s") and len(w) > 4 else w
            for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 3}


def _dimension_for(name: str, dims: dict, current: str) -> str | None:
    """'deployment_container' -> 'deployment', 'daily_usage' -> 'scale_usage' (if those dims exist)."""
    name_stems = _stems(name.replace("_", " "))
    if name_stems & _stems(current.replace("_", " ")):
        return None  # the name fits the asked topic
    for key in dims:
        if key != current and name_stems & _stems(key.replace("_", " ")):
            return key
    return None


def _words(text: str) -> set[str]:
    return set(WORD.findall(text.lower()))


def _key(text: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-z_]", "", text.lower().replace(" ", "_"))).strip("_")[:40]


def interpret(db: Session, profile: Profile, answer: AgentAnswer, entity: dict) -> str | None:
    """Interpret one answer. Returns an error message if the model failed (answer is still kept)."""
    raw = answer.raw or {}
    question = answer.question or {}
    entity_id = answer.entity_id
    is_item = entity_id not in ("personal", "skills")
    item_uuid = uuid.UUID(entity_id) if is_item else None
    dims = {t.key: t for t in progress.topics(db, profile.id, entity_id)}

    picked = [l for l in raw.get("labels", []) if l not in question.get("skip_labels", [])]
    text = (raw.get("text") or "").strip()
    number = raw.get("number")
    said = " ".join(filter(None, [text, " ".join(picked), str(number) if number is not None else "",
                                  raw.get("unit") or ""]))
    said_words = _words(said)

    # Idempotency: an earlier attempt's facts for this answer are replaced, not duplicated.
    if is_item:
        db.execute(delete(ItemFact).where(ItemFact.answer_id == answer.id))

    facts: list[dict] = []
    dim_updates: dict[str, str] = {}

    def grounded(values: list[str]) -> bool:
        words = _words(" ".join(values))
        return bool(words) and len(words & said_words) / len(words) >= 0.5

    def run(c: ToolCall) -> str:
        values = c.value if isinstance(c.value, list) else ([c.value] if c.value is not None else [])
        values = [str(v).strip() for v in values if str(v).strip()]
        if c.tool == "update_dimension":
            if c.dimension not in dims or c.state is None:
                return "rejected: unknown dimension"
            if not said_words:
                return "rejected: empty answer covers nothing"
            dim_updates[c.dimension] = c.state
            return "ok"
        if c.tool == "record_fact":
            if not is_item:
                return "rejected: record_fact is only for projects, experience, education etc."
            dimension = c.dimension if c.dimension in dims else question.get("topic_key")
            # Models often file everything under the asked topic; re-file by the fact's own name.
            if dimension == question.get("topic_key") and (better := _dimension_for(c.name or "", dims, dimension)):
                dimension = better
                dim_updates.setdefault(better, "PARTIAL")
            if not values:
                return "rejected: empty value"
            if c.from_option and not set(values) <= set(picked):
                return "rejected: from_option values must be exactly picked labels"
            if not c.from_option and not grounded(values):
                return "rejected: use the student's own words"
            facts.append({"field": f"{dimension}.{_key(c.name or 'detail') or 'detail'}",
                          "value": values if len(values) > 1 else values[0],
                          "source": "mcq" if c.from_option else "note"})
            return "ok"
        if c.tool == "add_skill":
            if entity_id != "skills" or not values or not grounded(values):
                return "rejected"
            have = {s.name.lower() for s in profile.skills}
            for v in values:
                if v.lower() not in have:
                    profile.skills.append(Skill(name=v, source="note"))
            return "ok"
        if c.tool == "set_basic":
            if entity_id != "personal" or c.field not in BASIC_FIELDS or not values or not grounded(values):
                return "rejected"
            if c.field == "link":
                urls = [u for v in values for u in extract_urls(v)]
                if not urls:
                    return "rejected: no link found in the value"
                profile.links = list(dict.fromkeys([*(profile.links or []), *urls]))
            else:
                setattr(profile, c.field, values[0])
            return "ok"
        return "rejected"

    payload = {
        "entity": {"id": entity_id, "type": entity["type"], "title": entity["title"]},
        "dimensions": [{"key": k, "label": t.label, "state": t.info_state} for k, t in dims.items()],
        "question": {"topic": question.get("topic_key"), "kind": question.get("kind"), "text": question.get("text"),
                     "options": [o["label"] for o in question.get("options", [])]},
        "answer": {"picked": picked, "text": text, "number": number, "unit": raw.get("unit")},
    }
    error = None
    if said_words:
        try:
            plan = complete_json(settings.model_interpreter, INTERPRETER_PROMPT,
                                 json.dumps(payload, default=str), ToolPlan, reasoning_effort="low")
            rejected = [(c, r) for c in plan.calls if (r := run(c)).startswith("rejected")]
            if rejected:
                fix = complete_json(
                    settings.model_interpreter, INTERPRETER_PROMPT,
                    json.dumps({**payload, "rejected_calls": [{"call": c.model_dump(), "why": r} for c, r in rejected],
                                "instruction": "Return corrected calls for the rejected ones only."}, default=str),
                    ToolPlan, reasoning_effort="low")
                for c in fix.calls:
                    run(c)
        except LLMError as err:
            error = str(err)
            log.warning("Interpreter failed for answer %s: %s", answer.id, err)

    # Links are too important to leave to the model: pull them out of personal answers in code.
    if entity_id == "personal" and (urls := extract_urls(text)):
        profile.links = list(dict.fromkeys([*(profile.links or []), *urls]))
        if "professional_links" in dims:
            dim_updates.setdefault("professional_links", "COMPLETE")

    # Safety net: an item answer always leaves a trace, even if the model failed or skipped it.
    topic_key = question.get("topic_key")
    if is_item and said_words and not facts:
        value = text or (picked if len(picked) > 1 else (picked[0] if picked else str(number)))
        facts.append({"field": f"{topic_key}.detail", "value": value, "source": "mcq" if picked and not text else "note"})
    if said_words and topic_key in dims and topic_key not in dim_updates:
        dim_updates[topic_key] = "PARTIAL"  # something was said about the topic itself

    for f in facts:
        db.add(ItemFact(item_id=item_uuid, field=f["field"], value=f["value"], source=f["source"],
                        prompt_version=PROMPT_VERSION, answer_id=answer.id))
    for key, state in dim_updates.items():
        progress.set_info(db, profile.id, entity_id, key, state)

    answer.attempts += 1
    answer.status = "failed" if error else "interpreted"
    answer.error = error
    answer.interpreted_at = datetime.now(timezone.utc)
    db.commit()
    return error
