"""The profile agent as a LangGraph state machine: sections -> entities -> chosen topics -> one question at a time.

    start -> enter_entity -> topics* --select--> prepare_question -> ask* --answer--> interpret
                ^              |  ^                    ^   |           |                 |
                |              |  +--more--+           |   +--none--+  +--skip/finish----+
                |              v                       +------------|----------------------+
                +---------- summary* <------------------------------+
    (* = pauses with interrupt() and waits for the student)

Why AI calls never sit in a pausing node: when a graph resumes, the interrupted node runs
again from the top. So assessment and question writing happen in enter_entity and
prepare_question; topics/ask/summary only build screens (cheap, repeatable) and pause.

Checkpoint state (here) is only navigation. Everything permanent - raw answers, facts,
topic and entity states - lives in normal tables, so it survives even a lost checkpoint.
"""

import uuid
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt
from sqlalchemy import select

from app.agent import analyst, interpreter, interviewer, progress
from app.agent.domain import SECTION_LABEL, SECTIONS
from app.agent.entities import entity_context, entity_list
from app.db import SessionLocal
from app.models import AgentAnswer, ItemFact, Profile
from app.services.llm import LLMError

SECTION_KEYS = [k for k, _ in SECTIONS]


class AgentState(TypedDict, total=False):
    profile_id: str
    session_id: str
    focus: str | None          # entity id when the student chose to revisit one entity
    queue: list[str]           # entity ids in section order
    idx: int
    offset: int                # paging through topic suggestions
    selected: list[str]        # topic keys chosen for this entity
    topic_i: int
    turns: int
    history: list[dict]        # [{q, a}] for the current topic
    question: dict | None
    entity_log: dict           # {"discussed": [...], "skipped": [...], "answers": [...]}
    skip_section: bool
    notices: list[str]         # shown on the next screen, then cleared
    action: dict
    next: str
    done: bool


def _db_profile(db, state) -> Profile:
    return db.get(Profile, uuid.UUID(state["profile_id"]))


def _meta(profile: Profile, entity_id: str) -> dict:
    e = next((x for x in entity_list(profile) if x["id"] == entity_id), None) or \
        {"id": entity_id, "title": "Removed item", "section": "additional", "type": "other"}
    return {**e, "section_label": SECTION_LABEL[e["section"]],
            "section_index": SECTION_KEYS.index(e["section"]) + 1, "sections_total": len(SECTION_KEYS)}


def _log(state) -> dict:
    return state.get("entity_log") or {"discussed": [], "skipped": [], "answers": []}


# ── Nodes ────────────────────────────────────────────────────────────


def start(state: AgentState) -> dict:
    with SessionLocal() as db:
        profile = _db_profile(db, state)
        queue = [state["focus"]] if state.get("focus") else [e["id"] for e in entity_list(profile)]
    return {"queue": queue, "idx": 0, "notices": [], "done": False}


def enter_entity(state: AgentState) -> dict:
    """Move to the next entity that has something worth discussing. Clear ones are noted, not shown."""
    idx, notices = state.get("idx", 0), list(state.get("notices", []))
    focus = state.get("focus")
    with SessionLocal() as db:
        profile = _db_profile(db, state)
        while idx < len(state["queue"]):
            eid = state["queue"][idx]
            try:
                es = analyst.assess_entity(db, profile, eid)
            except LLMError:
                notices.append("I couldn't look at one item right now; you can come back to it later.")
                idx += 1
                continue
            if es is None:  # item was deleted
                idx += 1
                continue
            page, _ = progress.suggestions(progress.topics(db, profile.id, eid), include_explored=bool(focus))
            if not page and not focus:
                notices.append(f"{_meta(profile, eid)['title']} already looks clear, nothing to add right now.")
                if es.status == "not_started":
                    es.status = "finished"
                db.commit()
                idx += 1
                continue
            es.status = "in_progress"
            db.commit()
            return {"idx": idx, "offset": 0, "selected": [], "topic_i": 0, "turns": 0, "history": [],
                    "question": None, "skip_section": False, "notices": notices,
                    "entity_log": {"discussed": [], "skipped": [], "answers": []}}
    return {"idx": idx, "done": True, "notices": notices}


def topics(state: AgentState) -> dict:
    eid = state["queue"][state["idx"]]
    with SessionLocal() as db:
        profile = _db_profile(db, state)
        es = progress.entity_state(db, profile.id, eid, _meta(profile, eid)["section"])
        rows = progress.topics(db, profile.id, eid)
        page, more = progress.suggestions(rows, state.get("offset", 0), include_explored=bool(state.get("focus")))
        for t in page:
            progress.set_convo(db, profile.id, eid, t.key, "SUGGESTED")
        db.commit()
        screen = {
            "screen": "topics", "entity": _meta(profile, eid), "understanding": es.understanding,
            "topics": [{"key": t.key, "label": t.label, "why": t.why, "info_state": t.info_state} for t in page],
            "more_available": more, "notices": state.get("notices", []),
            "completeness": progress.counts(rows),
        }

    action = interrupt(screen)

    kind = action.get("type")
    if kind == "select":
        keys = [k for k in action.get("keys", []) if k in {t["key"] for t in screen["topics"]}]
        if keys:
            with SessionLocal() as db:
                for k in keys:
                    progress.set_convo(db, uuid.UUID(state["profile_id"]), eid, k, "SELECTED")
                db.commit()
            return {"selected": keys, "topic_i": 0, "turns": 0, "history": [], "notices": [],
                    "next": "prepare_question"}
    if kind == "more":
        return {"offset": state.get("offset", 0) + progress.SUGGEST_LIMIT, "notices": [], "next": "topics"}
    if kind == "skip_entity":
        return {"notices": [], "next": "summary"}
    if kind == "finish_section":
        return {"notices": [], "skip_section": True, "next": "summary"}
    return {"next": "topics"}


def prepare_question(state: AgentState) -> dict:
    """Pick the next question worth asking across the selected topics, or go to the summary."""
    eid = state["queue"][state["idx"]]
    topic_i, turns, history = state.get("topic_i", 0), state.get("turns", 0), list(state.get("history", []))
    log = _log(state)
    with SessionLocal() as db:
        profile = _db_profile(db, state)
        pid = profile.id
        while topic_i < len(state.get("selected", [])):
            key = state["selected"][topic_i]
            row = progress.topic(db, pid, eid, key)
            finished = row is None or row.convo_state == "SKIPPED" or (turns > 0 and row.info_state == "COMPLETE")
            question = None
            if not finished:
                progress.set_convo(db, pid, eid, key, "IN_PROGRESS")
                ctx = entity_context(profile, eid)
                dims = [{"key": t.key, "label": t.label, "state": t.info_state}
                        for t in progress.topics(db, pid, eid)]
                try:
                    question = interviewer.next_question(
                        ctx, progress.entity_state(db, pid, eid, ctx["section"]).understanding,
                        {"key": row.key, "label": row.label, "why": row.why, "state": row.info_state},
                        dims, history, turns)
                except LLMError:
                    if turns == 0:  # still let the student talk about it
                        question = {"topic_key": key, "topic_label": row.label, "lead_in": row.why or "",
                                    "kind": "long_text", "text": f"Could you tell me about the {row.label.lower()}?",
                                    "options": [], "allow_other": False, "unit": None, "skip_labels": []}
            if question:
                db.commit()
                return {"question": question, "topic_i": topic_i, "turns": turns, "history": history,
                        "entity_log": log, "next": "ask"}
            # Topic done (covered, or nothing more worth asking).
            if row is not None and row.convo_state != "SKIPPED":
                progress.set_convo(db, pid, eid, key, "EXPLORED")
                if turns > 0 and key not in log["discussed"]:
                    log["discussed"].append(key)
            topic_i, turns, history = topic_i + 1, 0, []
        db.commit()
    return {"question": None, "topic_i": topic_i, "turns": 0, "history": [], "entity_log": log, "next": "summary"}


def ask(state: AgentState) -> dict:
    eid = state["queue"][state["idx"]]
    q = state["question"]
    with SessionLocal() as db:
        profile = _db_profile(db, state)
        labels = {t.key: t.label for t in progress.topics(db, profile.id, eid)}
        screen = {
            "screen": "question", "entity": _meta(profile, eid), "question": q,
            "history": state.get("history", []), "notices": state.get("notices", []),
            "selected_topics": [{"key": k, "label": labels.get(k, k), "current": i == state.get("topic_i")}
                                for i, k in enumerate(state.get("selected", []))],
        }

    action = interrupt(screen)

    kind = action.get("type")
    key, log = q["topic_key"], _log(state)
    pid = uuid.UUID(state["profile_id"])
    next_topic = {"topic_i": state.get("topic_i", 0) + 1, "turns": 0, "history": [], "notices": []}
    if kind == "answer" and action.get("answer_id"):
        return {"action": action, "notices": [], "next": "interpret"}
    if kind == "skip_question":
        history = [*state.get("history", []), {"q": q["text"], "a": "(skipped)"}]
        return {"turns": state.get("turns", 0) + 1, "history": history, "notices": [], "next": "prepare_question"}
    with SessionLocal() as db:
        if kind == "skip_topic":
            progress.set_convo(db, pid, eid, key, "SKIPPED")
            log["skipped"] = list(dict.fromkeys([*log["skipped"], key]))
        elif state.get("turns", 0) > 0:  # finishing a topic that was actually discussed
            progress.set_convo(db, pid, eid, key, "EXPLORED")
            log["discussed"] = list(dict.fromkeys([*log["discussed"], key]))
        db.commit()
    if kind in ("skip_topic", "finish_topic"):
        return {**next_topic, "entity_log": log, "next": "prepare_question"}
    if kind in ("finish_entity", "finish_section"):
        return {"entity_log": log, "notices": [], "skip_section": kind == "finish_section", "next": "summary"}
    return {"next": "ask"}


def interpret(state: AgentState) -> dict:
    answer_id = uuid.UUID(state["action"]["answer_id"])
    eid = state["queue"][state["idx"]]
    log = _log(state)
    notices = []
    with SessionLocal() as db:
        profile = _db_profile(db, state)
        answer = db.get(AgentAnswer, answer_id)
        error = interpreter.interpret(db, profile, answer, entity_context(profile, eid))
        if error:
            notices.append("Your answer is saved. I couldn't process it fully just now; I'll retry it later.")
        shown = answer.raw.get("text") or ", ".join(answer.raw.get("labels", [])) or str(answer.raw.get("number", ""))
    log["answers"] = list(dict.fromkeys([*log["answers"], str(answer_id)]))
    key = state["question"]["topic_key"]
    log["discussed"] = list(dict.fromkeys([*log["discussed"], key]))
    return {"history": [*state.get("history", []), {"q": state["question"]["text"], "a": shown}],
            "turns": state.get("turns", 0) + 1, "entity_log": log, "notices": notices,
            "next": "prepare_question"}


def summary(state: AgentState) -> dict:
    eid = state["queue"][state["idx"]]
    log = _log(state)
    with SessionLocal() as db:
        profile = _db_profile(db, state)
        meta = _meta(profile, eid)
        rows = progress.topics(db, profile.id, eid)
        labels = {t.key: t.label for t in rows}
        answer_ids = [uuid.UUID(a) for a in log["answers"]]
        saved = [f"{f.field.split('.')[-1].replace('_', ' ')}: {', '.join(f.value) if isinstance(f.value, list) else f.value}"
                 for f in db.scalars(select(ItemFact).where(ItemFact.answer_id.in_(answer_ids)))] if answer_ids else []
        if not saved and answer_ids:  # personal/skills answers update basics/skills instead of facts
            saved = [a.raw.get("text") or ", ".join(a.raw.get("labels", []))
                     for a in db.scalars(select(AgentAnswer).where(AgentAnswer.id.in_(answer_ids)))]
        open_rows, _ = progress.suggestions(rows, 0)
        unexplored = [t.label for t in open_rows if t.key not in log["discussed"]]
        # Where we go next.
        queue, j = state["queue"], state["idx"] + 1
        if state.get("skip_section"):
            sections = {e["id"]: e["section"] for e in entity_list(profile)}
            while j < len(queue) and sections.get(queue[j]) == meta["section"]:
                j += 1
        next_title = _meta(profile, queue[j])["title"] if j < len(queue) else None
        screen = {
            "screen": "summary", "entity": meta, "saved": [s for s in saved if s],
            "discussed": [labels.get(k, k) for k in log["discussed"]],
            "skipped": [labels.get(k, k) for k in log["skipped"]],
            "unexplored": unexplored, "next_title": next_title, "notices": state.get("notices", []),
        }

    action = interrupt(screen)

    if action.get("type") == "back_to_topics":
        return {"offset": 0, "notices": [], "next": "topics"}
    with SessionLocal() as db:
        pid = uuid.UUID(state["profile_id"])
        es = progress.entity_state(db, pid, eid, meta["section"])
        es.status = "finished" if log["answers"] else "skipped"
        for k in range(state["idx"] + 1, j):  # rest of a section the student chose to skip
            other = progress.entity_state(db, pid, queue[k], meta["section"])
            if other.status == "not_started":
                other.status = "skipped"
        db.commit()
    return {"idx": j, "notices": [], "next": "enter_entity"}


def _route(state: AgentState) -> str:
    return state["next"]


def build_graph(checkpointer):
    g = StateGraph(AgentState)
    for name, fn in [("start", start), ("enter_entity", enter_entity), ("topics", topics),
                     ("prepare_question", prepare_question), ("ask", ask), ("interpret", interpret),
                     ("summary", summary)]:
        g.add_node(name, fn)

    g.add_edge(START, "start")
    g.add_edge("start", "enter_entity")
    g.add_conditional_edges("enter_entity", lambda s: END if s.get("done") else "topics")
    g.add_conditional_edges("topics", _route, ["prepare_question", "topics", "summary"])
    g.add_conditional_edges("prepare_question", _route, ["ask", "summary"])
    g.add_conditional_edges("ask", _route, ["interpret", "prepare_question", "summary", "ask"])
    g.add_edge("interpret", "prepare_question")
    g.add_conditional_edges("summary", _route, ["topics", "enter_entity"])
    return g.compile(checkpointer=checkpointer)
