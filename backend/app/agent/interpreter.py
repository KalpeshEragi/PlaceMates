"""Interpreter: turns the user's answers into facts through validated tools.

The model returns ALL its tool calls in one structured response (one model
call per round instead of a slow call-per-tool loop). Each call is then run
through the same tool functions, which decide WHETHER it's allowed: the item
must be in this round, and the value must come from what the user actually
picked, typed or confirmed. Rejections go back to the model once for repair.
Anything the model misses (taps, notes, free-text sentences) is still saved.
"""

import json
import logging
import re
import uuid
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agent.domain import PROMPT_VERSION
from app.config import settings
from app.models import ItemFact
from app.services.llm import LLMError, complete_json

log = logging.getLogger(__name__)
WORD = re.compile(r"[a-z0-9]+")


class ToolCall(BaseModel):
    tool: Literal["record_fact", "flag_conflict", "ask_followup"]
    item_id: str
    field: str | None = Field(default=None, description="record_fact: short field name")
    value: str | list[str] | None = Field(default=None, description="record_fact: the fact")
    from_option: bool = Field(default=False, description="record_fact: value is exactly picked option label(s)")
    note: str | None = Field(default=None, description="flag_conflict: what contradicts what")
    topic: str | None = Field(default=None, description="ask_followup: what to ask next")
    reason: str | None = Field(default=None, description="ask_followup: why it's worth asking")


class ToolPlan(BaseModel):
    calls: list[ToolCall]


INTERPRETER_PROMPT = """You record what a student said about their resume items as facts.
Never add, assume or round up anything they did not say.

Return every tool call you need in "calls":
- record_fact: once per distinct piece of information. Short field name
  (e.g. scale, tech, database, role, outcome, dataset, metric, deployment, users, team_size, detail).
  from_option=true only when value is exactly one or more picked option labels;
  false when it comes from a note or free text (use their words).
- A "Yes" to a confirm question means the statement in the question is true:
  record it in plain words (from_option=false).
- Split free text into separate facts, each on the item it is about
  ("Shop API is on Render and the canteen uses it" -> deployment + users on Shop API).
- flag_conflict: an answer contradicts an existing fact.
- ask_followup: only if an answer opens something clearly worth one more question.
- Nothing for skipped or "Not sure" answers."""


def _words(text: str) -> set[str]:
    return set(WORD.findall(text.lower()))


def _field(name: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-z_]", "", name.lower().replace(" ", "_"))).strip("_")[:30] or "detail"


def interpret(db: Session, resolved: list[dict], free_text: str | None,
              facts_by_item: dict[str, list], all_items: dict[str, str]) -> dict:
    """all_items: item_id -> title for the whole profile (free text may mention any item)."""
    round_items = {q["item_id"] for q in resolved}
    picked_by_item: dict[str, set[str]] = {}
    said = " ".join(filter(None, [free_text, *(q["note"] or "" for q in resolved)]))
    for q in resolved:
        picked_by_item.setdefault(q["item_id"], set()).update(q["picked"])
        if q["kind"] == "confirm" and q["picked"] == ["Yes"]:
            said += " " + q["text"]
    said_words = _words(said)
    # Free text can be about any item, not only this round's.
    allowed_items = round_items | (set(all_items) if free_text else set())

    recorded: list[dict] = []
    conflicts: list[str] = []
    followups: list[dict] = []

    # ── Tools: the only way the model can change anything ───────────
    def record_fact(item_id: str, field: str | None, value, from_option: bool) -> str:
        values = value if isinstance(value, list) else [value]
        values = [str(v).strip() for v in values if v is not None and str(v).strip()]
        if item_id not in allowed_items:
            return "rejected: item not part of this round"
        if not values:
            return "rejected: empty value"
        if from_option:
            if not set(values) <= picked_by_item.get(item_id, set()):
                return "rejected: value must be exactly picked option label(s) for that item"
        else:
            words = _words(" ".join(values))
            if not words or len(words & said_words) / len(words) < 0.5:
                return "rejected: use the student's own words"
        recorded.append({"item_id": item_id, "field": _field(field or "detail"),
                         "value": values if len(values) > 1 else values[0],
                         "source": "mcq" if from_option else "note"})
        return "saved"

    def flag_conflict(item_id: str, note: str | None) -> str:
        if item_id in allowed_items and note:
            conflicts.append(f"{item_id}: {note}")
            return "noted"
        return "rejected"

    def ask_followup(item_id: str, topic: str | None, reason: str | None) -> str:
        if item_id in round_items and topic and len(followups) < 3:
            followups.append({"item_id": item_id, "topic": topic, "reason": reason or ""})
            return "queued"
        return "rejected"

    def run(call: ToolCall) -> str:
        if call.tool == "record_fact":
            return record_fact(call.item_id, call.field, call.value, call.from_option)
        if call.tool == "flag_conflict":
            return flag_conflict(call.item_id, call.note)
        return ask_followup(call.item_id, call.topic, call.reason)

    payload = {
        "answers": [
            {"n": q["n"], "item_id": q["item_id"], "item": q["item_title"], "kind": q["kind"],
             "question": q["text"], "picked": q["picked"], "skipped": q["skipped"], "note": q["note"]}
            for q in resolved
        ],
        "free_text": free_text,
        "items": [{"item_id": i, "title": t, "facts": facts_by_item.get(i, [])}
                  for i, t in all_items.items() if i in allowed_items],
    }
    try:
        result = complete_json(settings.model_interpreter, INTERPRETER_PROMPT,
                               json.dumps(payload, default=str), ToolPlan, reasoning_effort="low")
        rejected = [(c, r) for c in result.calls if (r := run(c)).startswith("rejected")]
        if rejected:  # one repair round, showing the model why
            fix = complete_json(
                settings.model_interpreter, INTERPRETER_PROMPT,
                json.dumps({**payload, "rejected_calls": [{"call": c.model_dump(), "why": r} for c, r in rejected],
                            "instruction": "Return corrected calls for the rejected ones only."}, default=str),
                ToolPlan, reasoning_effort="low")
            for c in fix.calls:
                run(c)
    except LLMError as err:
        log.warning("Interpreter model failed, saving answers directly: %s", err)

    # ── Safety net: the user's input is never lost ─────────────────
    for q in resolved:
        if q["picked"] and q["kind"] == "mcq" and not any(
                r["item_id"] == q["item_id"] and r["source"] == "mcq"
                and set(r["value"] if isinstance(r["value"], list) else [r["value"]]) & set(q["picked"])
                for r in recorded):
            recorded.append({"item_id": q["item_id"], "field": _field(q["topic"]),
                             "value": q["picked"] if q["multi"] else q["picked"][0], "source": "mcq"})
        if q["note"] and not _covered(q["note"], recorded):
            recorded.append({"item_id": q["item_id"], "field": "detail", "value": q["note"], "source": "note"})

    for sentence in re.split(r"(?<=[.!?;])\s+|\n+", free_text or ""):
        if sentence.strip() and not _covered(sentence, recorded):
            target = next((i for i, t in all_items.items() if t.lower() in sentence.lower()), resolved[0]["item_id"])
            recorded.append({"item_id": target, "field": "detail", "value": sentence.strip(), "source": "note"})

    for r in recorded:
        db.add(ItemFact(item_id=uuid.UUID(r["item_id"]), field=r["field"], value=r["value"],
                        source=r["source"], prompt_version=PROMPT_VERSION))
    db.commit()
    return {"recorded": recorded, "conflicts": conflicts, "followups": followups}


def _covered(text: str, recorded: list[dict]) -> bool:
    """True if saved notes already carry most of this text's meaningful words."""
    words = {w for w in _words(text) if len(w) > 3}
    if not words:
        return True
    noted = set().union(*(_words(str(r["value"])) for r in recorded if r["source"] == "note")) if recorded else set()
    return len(words & noted) / len(words) >= 0.4
