"""Turn profile gaps into multiple-choice questions, and answers into facts.

The cheap model only writes question text and tailored options. Picking
which gaps to ask about, adding the honest "skip" option, parsing replies and
saving facts are all plain code, so they're predictable and free.
"""

import json
import re
import string
import uuid

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ItemFact, Profile, ProfileItem, QuestionBatch
from app.services.gaps import profile_gaps
from app.services.llm import LLMError, complete_json

BATCH_SIZE = 5
PER_ITEM_PER_BATCH = 2
MAX_ASKED_PER_ITEM = 3

SKIP_LABEL = {"scale": "Not measured", "outcome": "Not measured"}
MULTI = {"tech"}

# Used when the model is unavailable, so the chat still works.
FALLBACK = {
    "action": ("What did you personally build or own here?",
               ["Designed and built it end to end", "Built a major module", "Implemented specific features", "Fixed bugs and wrote tests"]),
    "tech": ("Which technologies did you use?", ["Python", "JavaScript/TypeScript", "Java", "SQL database", "Cloud (AWS/GCP/Azure)"]),
    "scale": ("Roughly how big was it?", ["Personal/demo use", "Under 100 users or records", "100–1,000", "1,000–10,000", "10,000+"]),
    "outcome": ("What changed because of your work?", ["Saved time for users or the team", "Made something faster", "Used by real users", "Won or placed in a competition"]),
    "role": ("What was your role?", ["Built it solo", "Led a team", "Built a major part in a team", "Contributed a feature"]),
}


class GenQuestion(BaseModel):
    item_id: str
    dimension: str
    text: str
    options: list[str] = Field(min_length=2, max_length=6)


class GenBatch(BaseModel):
    questions: list[GenQuestion]


SYSTEM_PROMPT = """You write short multiple-choice questions that help a student add missing
detail to one resume item at a time.
Rules:
- One question per requested (item_id, dimension). Use the given ids exactly.
- Mention the item by name. Keep each question under 20 words.
- 3 to 5 options, specific to that item's own text and tech. No "Other" or "Skip" option.
- For scale, use ranges (e.g. "100–1,000 users"). Always include a modest option, so nobody
  feels pushed to exaggerate.
- For outcome, describe kinds of result ("Made checkout faster", "Used by classmates").
  Never put invented numbers or percentages in options.
Dimensions: action = what they personally did; tech = technologies used;
scale = size (users, data, requests, team size); outcome = result or impact;
role = solo vs team and their part."""


def asked_pairs(db: Session, profile: Profile) -> set[tuple[str, str]]:
    batches = db.scalars(
        select(QuestionBatch).where(QuestionBatch.profile_id == profile.id, QuestionBatch.status == "answered")
    )
    return {(q["item_id"], q["field"]) for b in batches for q in b.questions}


def _pick(profile: Profile, asked: set[tuple[str, str]]) -> list[tuple[ProfileItem, str]]:
    per_item: dict[str, int] = {}
    for item_id, _ in asked:
        per_item[item_id] = per_item.get(item_id, 0) + 1

    picked: list[tuple[ProfileItem, str]] = []
    for g in profile_gaps(profile, asked):
        room = min(PER_ITEM_PER_BATCH, MAX_ASKED_PER_ITEM - per_item.get(str(g.item.id), 0))
        for dim in g.missing[:max(room, 0)]:
            picked.append((g.item, dim))
            if len(picked) == BATCH_SIZE:
                return picked
    return picked


def _generate(picked: list[tuple[ProfileItem, str]]) -> dict[tuple[str, str], GenQuestion]:
    items = {}
    for item, dim in picked:
        entry = items.setdefault(str(item.id), {
            "item_id": str(item.id), "kind": item.kind, "title": item.title,
            "organization": item.organization,
            "facts": [{"field": f.field, "value": f.value} for f in item.facts],
            "ask_about": [],
        })
        entry["ask_about"].append(dim)
    try:
        batch = complete_json(settings.model_questions, SYSTEM_PROMPT, json.dumps(list(items.values())), GenBatch)
    except LLMError:
        return {}
    wanted = {(str(i.id), d) for i, d in picked}
    return {(q.item_id, q.dimension): q for q in batch.questions if (q.item_id, q.dimension) in wanted}


def next_batch(db: Session, profile: Profile) -> QuestionBatch | None:
    """Return the open batch, or make a new one. None when nothing is left to ask."""
    open_batch = db.scalar(
        select(QuestionBatch).where(QuestionBatch.profile_id == profile.id, QuestionBatch.status == "open")
    )
    if open_batch:
        return open_batch

    picked = _pick(profile, asked_pairs(db, profile))
    if not picked:
        return None

    generated = _generate(picked)
    questions = []
    for n, (item, dim) in enumerate(picked, start=1):
        gen = generated.get((str(item.id), dim))
        text, labels = (gen.text, gen.options) if gen else FALLBACK[dim]
        labels = [*labels[:5], SKIP_LABEL.get(dim, "Not sure / skip")]
        options = [{"key": k, "label": label} for k, label in zip(string.ascii_lowercase, labels)]
        questions.append({
            "n": n, "item_id": str(item.id), "item_title": item.title, "field": dim,
            "text": text, "multi": dim in MULTI, "options": options, "skip_key": options[-1]["key"],
        })

    batch = QuestionBatch(profile_id=profile.id, questions=questions)
    db.add(batch)
    db.commit()
    return batch


# ── Answers ─────────────────────────────────────────────────


class Answer(BaseModel):
    n: int
    keys: list[str] = []
    note: str | None = None


TOKEN = re.compile(r"(?<![\w])(\d{1,2})\s*([a-f]+)(?![\w])", re.I)


def parse_reply(reply: str, count: int) -> list[Answer]:
    """Parse shorthand like "1c 2a 3abd + also added Redis rate limiting".

    Text after a "+" becomes a note on the question just before it
    (or on question 1 if there is none).
    """
    tokens = [m for m in TOKEN.finditer(reply) if 1 <= int(m.group(1)) <= count]
    answers: dict[int, Answer] = {}

    def add_note(n: int, text: str) -> None:
        if "+" in text and (note := text.split("+", 1)[1].strip()):
            ans = answers.setdefault(n, Answer(n=n))
            ans.note = f"{ans.note} {note}" if ans.note else note

    add_note(1, reply[: tokens[0].start()] if tokens else reply)
    for i, m in enumerate(tokens):
        n = int(m.group(1))
        answers.setdefault(n, Answer(n=n)).keys = list(dict.fromkeys(m.group(2).lower()))
        end = tokens[i + 1].start() if i + 1 < len(tokens) else len(reply)
        add_note(n, reply[m.end():end])
    return sorted(answers.values(), key=lambda a: a.n)


def save_answers(db: Session, batch: QuestionBatch, answers: list[Answer]) -> None:
    by_n = {q["n"]: q for q in batch.questions}
    for ans in answers:
        q = by_n.get(ans.n)
        if not q:
            continue
        item_id = uuid.UUID(q["item_id"])
        labels = {o["key"]: o["label"] for o in q["options"]}
        chosen = [labels[k] for k in ans.keys if k in labels and k != q["skip_key"]]
        if not q["multi"]:
            chosen = chosen[:1]
        if chosen:
            value = chosen if q["multi"] else chosen[0]
            db.add(ItemFact(item_id=item_id, field=q["field"], value=value, source="mcq"))
        if ans.note:
            db.add(ItemFact(item_id=item_id, field="detail", value=ans.note, source="note"))
    batch.status = "answered"
    batch.answers = [a.model_dump() for a in answers]
    db.commit()
