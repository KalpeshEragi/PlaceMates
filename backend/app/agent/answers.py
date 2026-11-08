"""Normalize a student's response and save it BEFORE any AI interpretation. Plain code."""

import re
import uuid

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agent.domain import PROMPT_VERSION
from app.models import AgentAnswer


class AnswerIn(BaseModel):
    keys: list[str] = []          # tapped option keys
    text: str | None = None       # free text, "Other" text, or shorthand like "abd + note"
    number: float | None = None


SHORTHAND = re.compile(r"^\s*(?:\d{1,2}\s*)?([a-h]{1,8})\s*(?:\+\s*(.*))?$", re.I | re.S)


def normalize(question: dict, body: AnswerIn) -> dict:
    """-> {keys, labels, text, number, unit}. Shorthand in the text box works for option questions."""
    by_key = {o["key"]: o["label"] for o in question.get("options", [])}
    keys, text = list(body.keys), (body.text or "").strip()
    if by_key and not keys and text and (m := SHORTHAND.match(text)) and set(m.group(1).lower()) <= set(by_key):
        keys, text = list(dict.fromkeys(m.group(1).lower())), (m.group(2) or "").strip()
    keys = [k for k in keys if k in by_key]
    if question.get("kind") == "single":
        keys = keys[:1]
    number = body.number
    if question.get("kind") == "number" and number is None and text:
        if (m := re.search(r"-?\d[\d,]*\.?\d*", text)):
            number = float(m.group().replace(",", ""))
    return {"keys": keys, "labels": [by_key[k] for k in keys], "text": text or None,
            "number": number, "unit": question.get("unit")}


def is_empty(raw: dict) -> bool:
    return not raw["keys"] and not raw["text"] and raw["number"] is None


def save_answer(db: Session, profile_id: uuid.UUID, session_id: uuid.UUID, entity_id: str,
                question: dict, raw: dict) -> AgentAnswer:
    """Persist the raw response first. Interpretation happens afterwards and may fail safely."""
    answer = AgentAnswer(profile_id=profile_id, session_id=session_id, entity_id=entity_id,
                         topic_key=question["topic_key"], question=question, raw=raw,
                         status="pending", prompt_version=PROMPT_VERSION)
    db.add(answer)
    db.commit()
    return answer
