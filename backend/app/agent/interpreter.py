"""Interpreter: turns the user's answers into facts, using tools.

The model decides WHAT to record; code decides WHETHER it's allowed. Every
record_fact call is checked: the item must be in this round, and the value
must come from what the user actually picked, typed or confirmed. Taps the
model forgets are saved anyway, so a user's answer is never lost.
"""

import json
import logging
import re
import uuid

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from sqlalchemy.orm import Session

from app.agent.domain import DOMAIN_CONTEXT, PROMPT_VERSION
from app.config import settings
from app.models import ItemFact

log = logging.getLogger(__name__)
MAX_STEPS = 5
WORD = re.compile(r"[a-z0-9]+")

INTERPRETER_PROMPT = f"""{DOMAIN_CONTEXT}

Your job: record what the student told you as facts, using the tools.
- record_fact once per distinct piece of information. Use a short field name
  (e.g. scale, tech, role, outcome, dataset, metric, deployment, team_size, detail).
- from_option=true when the value is exactly one or more picked option labels;
  false when it comes from their note or free text.
- A "Yes" to a confirm question means the statement in the question is true:
  record it in plain words (from_option=false).
- Split free text into separate facts ("handled refunds, ~2k a day" -> feature + scale).
- flag_conflict if an answer contradicts an existing fact.
- ask_followup only if an answer opens something clearly worth one more question.
- Record nothing for skipped or "Not sure" answers. Never add anything they didn't say.
When done, reply with the single word DONE."""


def _words(text: str) -> set[str]:
    return set(WORD.findall(text.lower()))


def interpret(db: Session, resolved: list[dict], free_text: str | None,
              facts_by_item: dict[str, list]) -> dict:
    allowed_items = {q["item_id"] for q in resolved}
    picked_by_item: dict[str, set[str]] = {}
    said = " ".join(filter(None, [free_text, *(q["note"] or "" for q in resolved)]))
    for q in resolved:
        picked_by_item.setdefault(q["item_id"], set()).update(q["picked"])
        if q["kind"] == "confirm" and q["picked"] == ["Yes"]:
            said += " " + q["text"]
    said_words = _words(said)

    recorded: list[dict] = []
    conflicts: list[str] = []
    followups: list[dict] = []

    @tool
    def record_fact(item_id: str, field: str, value: str | list[str], from_option: bool) -> str:
        """Save one fact the student gave about an item."""
        values = value if isinstance(value, list) else [value]
        values = [v.strip() for v in values if str(v).strip()]
        field = re.sub(r"[^a-z_]", "", field.lower().replace(" ", "_"))[:30] or "detail"
        if item_id not in allowed_items:
            return "Rejected: that item is not part of this round."
        if not values:
            return "Rejected: empty value."
        if from_option:
            if not set(values) <= picked_by_item.get(item_id, set()):
                return "Rejected: value must be exactly a picked option for that item."
        else:
            words = _words(" ".join(values))
            if not words or len(words & said_words) / len(words) < 0.5:
                return "Rejected: value must use the student's own words."
        recorded.append({"item_id": item_id, "field": field, "value": values if len(values) > 1 else values[0],
                         "source": "mcq" if from_option else "note"})
        return "Saved."

    @tool
    def flag_conflict(item_id: str, note: str) -> str:
        """Report that an answer contradicts an existing fact."""
        conflicts.append(f"{item_id}: {note}")
        return "Noted."

    @tool
    def ask_followup(item_id: str, topic: str, reason: str) -> str:
        """Queue one more question that an answer made worth asking."""
        if item_id in allowed_items and len(followups) < 3:
            followups.append({"item_id": item_id, "topic": topic, "reason": reason})
            return "Queued."
        return "Rejected."

    tools = {t.name: t for t in (record_fact, flag_conflict, ask_followup)}
    payload = {
        "answers": [
            {"n": q["n"], "item_id": q["item_id"], "item": q["item_title"], "kind": q["kind"],
             "question": q["text"], "picked": q["picked"], "skipped": q["skipped"], "note": q["note"]}
            for q in resolved
        ],
        "free_text": free_text,
        "existing_facts": {i: facts_by_item.get(i, []) for i in allowed_items},
    }

    try:
        llm = ChatGroq(model=settings.model_interpreter, api_key=settings.groq_api_key, temperature=0,
                       max_retries=2, timeout=60).bind_tools(list(tools.values()))
        messages = [SystemMessage(INTERPRETER_PROMPT), HumanMessage(json.dumps(payload, default=str))]
        for _ in range(MAX_STEPS):
            ai = llm.invoke(messages)
            messages.append(ai)
            if not ai.tool_calls:
                break
            for call in ai.tool_calls:
                fn = tools.get(call["name"])
                result = fn.invoke(call["args"]) if fn else "Unknown tool."
                messages.append(ToolMessage(str(result), tool_call_id=call["id"]))
    except Exception as err:  # noqa: BLE001 - model trouble must never lose the user's answers
        log.warning("Interpreter model failed, saving answers directly: %s", err)

    # Safety net: every tapped option is saved, even if the model skipped it.
    saved_values = {(r["item_id"], json.dumps(r["value"])) for r in recorded}
    for q in resolved:
        if q["picked"] and q["kind"] == "mcq":
            value = q["picked"] if q["multi"] else q["picked"][0]
            covered = (q["item_id"], json.dumps(value)) in saved_values or any(
                r["item_id"] == q["item_id"] and r["source"] == "mcq"
                and set(r["value"] if isinstance(r["value"], list) else [r["value"]]) & set(q["picked"])
                for r in recorded)
            if not covered:
                recorded.append({"item_id": q["item_id"], "field": q["topic"].replace(" ", "_")[:30],
                                 "value": value, "source": "mcq"})
        if q["note"] and not any(r["source"] == "note" and r["item_id"] == q["item_id"] for r in recorded):
            recorded.append({"item_id": q["item_id"], "field": "detail", "value": q["note"], "source": "note"})

    for r in recorded:
        db.add(ItemFact(item_id=uuid.UUID(r["item_id"]), field=r["field"], value=r["value"],
                        source=r["source"], prompt_version=PROMPT_VERSION))
    db.commit()
    return {"recorded": recorded, "conflicts": conflicts, "followups": followups}
