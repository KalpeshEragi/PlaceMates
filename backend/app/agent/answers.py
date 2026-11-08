"""User replies: taps, shorthand ("1c 2a 3abd + note") or free text. Plain code, no AI."""

import re

from pydantic import BaseModel


class Answer(BaseModel):
    n: int
    keys: list[str] = []
    note: str | None = None


class Reply(BaseModel):
    answers: list[Answer] = []
    free_text: str | None = None


TOKEN = re.compile(r"(?<![\w])(\d{1,2})\s*([a-f]+)(?![\w])", re.I)


def parse_shorthand(reply: str, count: int) -> list[Answer]:
    """Text after a "+" becomes a note on the question just before it (or question 1)."""
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


def resolve(questions: list[dict], reply: Reply) -> list[dict]:
    """Per question: the option labels picked (skip removed) and the note."""
    by_n = {a.n: a for a in reply.answers}
    out = []
    for q in questions:
        ans = by_n.get(q["n"])
        labels = {o["key"]: o["label"] for o in q["options"]}
        picked = [labels[k] for k in (ans.keys if ans else []) if k in labels and k != q["skip_key"]]
        if not q["multi"]:
            picked = picked[:1]
        out.append({**q, "picked": picked, "skipped": bool(ans and q["skip_key"] in ans.keys),
                    "note": ans.note if ans else None})
    return out
