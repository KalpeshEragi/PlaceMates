"""Interviewer: turns planned gaps into tap-to-answer questions."""

import json
import re
import string
from typing import Literal

from pydantic import BaseModel, Field

from app.agent.domain import DOMAIN_CONTEXT
from app.agent.planner import Gap, _topic_words
from app.config import settings
from app.services.llm import LLMError, complete_json


# Options like "Reduced bugs by 10-20%" put made-up results in front of students.
INVENTED_GAIN = re.compile(
    r"\b(reduc|improv|increas|boost|cut|sav|decreas|grew|faster|slower)\w*\b.*\d|\d.*\b(faster|improvement|reduction|increase)\b",
    re.I,
)


class DraftQuestion(BaseModel):
    gap_index: int
    topic: str = Field(description="Copy the gap's topic exactly")
    kind: Literal["mcq", "confirm"] = Field(description='"confirm" for yes/no checks of something likely true')
    text: str
    multi: bool = Field(description="True if several options can be true at once (e.g. technologies)")
    numeric: bool = Field(description="True if it asks about a size, count or measurable result")
    options: list[str] = Field(default=[], description="3-5 options for mcq; empty for confirm")


class Drafts(BaseModel):
    questions: list[DraftQuestion]


INTERVIEWER_PROMPT = f"""{DOMAIN_CONTEXT}

Your job: write one question per gap (use its gap_index and copy its topic).
- Ask exactly about that gap's topic. Never ask about something already in the item's facts.
- Mention the item by name. Under 20 words.
- mcq: 3-5 options specific to that item's own facts and tech. No "Other" or "Skip".
- Sizes as ranges, always with a modest option. Results as kinds of result, never
  invented numbers or percentages.
- confirm: only to check something strongly implied by the facts ("Did Shop API use MongoDB for orders?")."""


def write_questions(gaps: list[Gap], snapshot: dict, start_n: int = 1) -> list[dict]:
    items = {i["item_id"]: i for i in snapshot["items"]}
    payload = [{"gap_index": n, **g.model_dump(), "item": items.get(g.item_id)} for n, g in enumerate(gaps)]
    try:
        returned = complete_json(settings.model_interviewer, INTERVIEWER_PROMPT,
                                 json.dumps(payload, default=str), Drafts, reasoning_effort="low").questions
    except LLMError:
        returned = []
    # Match drafts to gaps by the topic they echo, not by position (small models mix up indexes).
    by_topic = {d.topic.strip().lower(): d for d in returned}

    questions = []
    for gap in gaps:
        d = by_topic.get(gap.topic.strip().lower())
        title = items[gap.item_id]["title"]
        if d and not _fits(d.text, gap, items[gap.item_id]):
            d = None  # off-topic or already answered: ask in the user's own words instead
        if d and d.kind == "confirm":
            labels, multi = ["Yes", "No", "Not sure"], False
        elif d and len(opts := [o for o in d.options if not INVENTED_GAIN.search(o)]) >= 2:
            labels = [*opts[:5], "Not measured" if d.numeric else "Not sure / skip"]
            multi = d.multi
        else:
            # Model failed: ask in the user's own words instead.
            labels, multi = ["Skip"], False
        options = [{"key": k, "label": label} for k, label in zip(string.ascii_lowercase, labels)]
        questions.append({
            "n": start_n + len(questions),
            "item_id": gap.item_id, "item_title": title, "topic": gap.topic,
            "kind": d.kind if d and len(labels) > 1 else "text",
            "text": d.text if d else f"{title}: tell us about the {gap.topic}.",
            "multi": multi, "options": options, "skip_key": options[-1]["key"],
        })
    return questions


def _fits(text: str, gap: Gap, item: dict) -> bool:
    """A draft must be about the planned gap, and not about something the item already has."""
    words = _topic_words(text) - _topic_words(item["title"])
    if not words & _topic_words(f"{gap.topic} {gap.reason}"):
        return False
    known = set()
    for f in item["facts"]:
        if f["field"] != "bullet":
            known |= _topic_words(f["field"])
            values = f["value"] if isinstance(f["value"], list) else [str(f["value"])]
            known |= {w for v in values for w in _topic_words(v) if len(w) > 3}
    return not (words & known)
