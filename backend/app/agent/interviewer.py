"""Interviewer: decides whether one more question on a topic is worth asking, and writes it.

One question at a time. The format fits the information: options for quick facts,
free text for explanations (architecture, decisions, challenges).
"""

import json
import re
import string
from typing import Literal

from pydantic import BaseModel, Field

from app.agent.domain import DOMAIN_CONTEXT
from app.config import settings
from app.services.llm import complete_json

MAX_TURNS_PER_TOPIC = 3
EXPLAIN_TOPICS = {"architecture", "architecture_decisions", "design_decisions", "challenges", "methodology",
                  "experimental_setup", "limitations", "problem_statement", "systems_built", "responsibilities",
                  "individual_contribution", "evaluation", "agent_communication"}

# Options like "Reduced bugs by 10-20%" put made-up results in front of students.
INVENTED_GAIN = re.compile(
    r"\b(reduc|improv|increas|boost|cut|sav|decreas|grew|faster|slower)\w*\b.*\d|\d.*\b(faster|improvement|reduction|increase)\b",
    re.I,
)


class NextQuestion(BaseModel):
    done: bool = Field(description="True if the topic is covered well enough, or another question isn't worth it")
    lead_in: str = Field(default="", description="One friendly sentence acknowledging what you know and what you'd like to explore")
    kind: Literal["single", "multi", "number", "short_text", "long_text"] = "short_text"
    text: str = ""
    options: list[str] = Field(default=[], description="2-5 options for single/multi; empty otherwise")
    unit: str | None = Field(default=None, description="For number questions, e.g. 'users', 'ms'")


INTERVIEWER_PROMPT = f"""{DOMAIN_CONTEXT}

You are a knowledgeable, friendly technical interviewer helping a student describe ONE topic
of ONE profile entity. Decide whether ONE more question is genuinely worth asking.
- done=true if the topic is already covered by the facts or the conversation, if the student
  signalled they don't know or don't want to go deeper, or if more would be marginal.
- If the student skipped a question, never ask the same thing again in another form; ask
  something clearly different, or set done=true.
- Never ask about anything already in the facts or answered in the conversation, and don't
  ask about other dimensions that are COMPLETE.
- Choose the format that fits: single/multi for quick facts (2-5 specific options), number for a
  single quantity, long_text for explanations (architecture, decisions, challenges, methodology),
  short_text for a name or phrase.
- Options: specific to this entity; sizes as ranges with a modest option; never invented
  results or percentages. Don't include "Other", "Not sure" or "Skip" (added automatically).
- lead_in: e.g. "I understand the overall architecture. It would help to know how the agents
  coordinate." Never "Question 3 of 10", never "you must".
- text: one clear question, under 25 words. For number/short_text/long_text it must stand on
  its own: never say "the following" or "below" unless you give options."""

REFERS_TO_OPTIONS = re.compile(r"\b(following|below|these options|options above)\b", re.I)


def _mismatch(q: NextQuestion) -> bool:
    usable = [o for o in q.options if not INVENTED_GAIN.search(o)]
    has_options = q.kind in ("single", "multi") and len(usable) >= 2
    return not has_options and bool(REFERS_TO_OPTIONS.search(q.text))


def next_question(entity: dict, understanding: str | None, topic: dict, dimensions: list[dict],
                  history: list[dict], turn: int) -> dict | None:
    """Returns a question dict, or None when the topic is done."""
    if turn >= MAX_TURNS_PER_TOPIC:
        return None
    payload = {
        "entity": {"type": entity["type"], "title": entity["title"], "data": entity["data"]},
        "what_is_already_clear": understanding,
        "topic": topic,
        "all_dimensions": dimensions,
        "conversation_on_this_topic": history,
    }
    q = complete_json(settings.model_interviewer, INTERVIEWER_PROMPT, json.dumps(payload, default=str),
                      NextQuestion, reasoning_effort="low")
    if q.done or not q.text.strip():
        return None
    if _mismatch(q):  # text points at options that aren't there: one retry with feedback
        q = complete_json(settings.model_interviewer, INTERVIEWER_PROMPT, json.dumps(
            {**payload, "problem": f"Your question '{q.text}' refers to options but has none usable. "
                                   "Either give 2-5 options with kind single/multi, or rewrite it to stand alone."},
            default=str), NextQuestion, reasoning_effort="low")
        if q.done or not q.text.strip():
            return None
        if _mismatch(q):
            q.kind, q.options, q.text = "long_text", [], f"Could you tell me about the {topic['label'].lower()}?"

    kind = q.kind
    if kind == "short_text" and topic["key"] in EXPLAIN_TOPICS:
        kind = "long_text"  # explanations need room
    labels = [o for o in q.options if not INVENTED_GAIN.search(o)][:5] if kind in ("single", "multi") else []
    if kind in ("single", "multi") and len(labels) < 2:
        kind = "short_text"  # options were unusable: ask openly instead
        labels = []
    extras = ["Not sure", "Prefer not to answer"] if labels else []
    options = [{"key": k, "label": label} for k, label in zip(string.ascii_lowercase, labels + extras)]
    return {
        "topic_key": topic["key"], "topic_label": topic["label"],
        "lead_in": q.lead_in.strip(), "kind": kind, "text": q.text.strip(),
        "options": options, "allow_other": bool(labels), "unit": q.unit if kind == "number" else None,
        "skip_labels": extras,
    }
