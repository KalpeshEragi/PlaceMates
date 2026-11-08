"""Interviewer: turns planned gaps into tap-to-answer questions."""

import json
import string
from typing import Literal

from pydantic import BaseModel, Field

from app.agent.domain import DOMAIN_CONTEXT
from app.agent.planner import Gap
from app.config import settings
from app.services.llm import LLMError, complete_json


class DraftQuestion(BaseModel):
    gap_index: int
    kind: Literal["mcq", "confirm"] = Field(description='"confirm" for yes/no checks of something likely true')
    text: str
    multi: bool = Field(description="True if several options can be true at once (e.g. technologies)")
    numeric: bool = Field(description="True if it asks about a size, count or measurable result")
    options: list[str] = Field(default=[], description="3-5 options for mcq; empty for confirm")


class Drafts(BaseModel):
    questions: list[DraftQuestion]


INTERVIEWER_PROMPT = f"""{DOMAIN_CONTEXT}

Your job: write one question per gap (use its gap_index).
- Mention the item by name. Under 20 words.
- mcq: 3-5 options specific to that item's own facts and tech. No "Other" or "Skip".
- Sizes as ranges, always with a modest option. Results as kinds of result, never
  invented numbers or percentages.
- confirm: only to check something strongly implied by the facts ("Did Shop API use MongoDB for orders?")."""


def write_questions(gaps: list[Gap], snapshot: dict, start_n: int = 1) -> list[dict]:
    items = {i["item_id"]: i for i in snapshot["items"]}
    payload = [{"gap_index": n, **g.model_dump(), "item": items.get(g.item_id)} for n, g in enumerate(gaps)]
    try:
        drafts = {d.gap_index: d for d in complete_json(
            settings.model_questions, INTERVIEWER_PROMPT, json.dumps(payload, default=str), Drafts,
            reasoning_effort="low").questions}
    except LLMError:
        drafts = {}

    questions = []
    for idx, gap in enumerate(gaps):
        d = drafts.get(idx)
        title = items[gap.item_id]["title"]
        if d and d.kind == "confirm":
            labels, multi = ["Yes", "No", "Not sure"], False
        elif d and len(d.options) >= 2:
            labels = [*d.options[:5], "Not measured" if d.numeric else "Not sure / skip"]
            multi = d.multi
        else:
            # Model failed: ask in the user's own words instead.
            labels, multi = ["Skip"], False
        options = [{"key": k, "label": label} for k, label in zip(string.ascii_lowercase, labels)]
        questions.append({
            "n": start_n + len(questions),
            "item_id": gap.item_id, "item_title": title, "topic": gap.topic,
            "kind": d.kind if d and len(labels) > 1 else "text",
            "text": d.text if d else f"{title}: tell us about {gap.topic}.",
            "multi": multi, "options": options, "skip_key": options[-1]["key"],
        })
    return questions
