"""The profile agent as a LangGraph state machine.

    analyst -> planner -> interviewer -> wait_for_user (interrupt) -> interpreter
                  ^                                                      |
                  +------------------------------------------------------+
    planner -> finish -> END   when nothing valuable is left or the limit is hit

State holds only ids and small JSON, so it checkpoints cleanly to Postgres.
Each node opens its own DB session.
"""

import operator
import uuid
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.agent import analyst, interpreter, interviewer, planner
from app.agent.answers import Reply, resolve
from app.agent.snapshot import profile_snapshot
from app.db import SessionLocal
from app.models import Profile


class AgentState(TypedDict, total=False):
    profile_id: str
    brief: dict
    gaps: list[dict]
    questions: list[dict]
    asked: Annotated[list[str], operator.add]  # "item_id:topic", appended each round
    asked_count: int
    followups: list[dict]
    conflicts: Annotated[list[str], operator.add]
    last_recorded: list[dict]
    reply: dict  # the user's answers, set when the graph resumes
    done: bool


def _profile(db, state: AgentState) -> Profile:
    return db.get(Profile, uuid.UUID(state["profile_id"]))


def analyse(state: AgentState) -> dict:
    with SessionLocal() as db:
        brief = analyst.get_brief(db, _profile(db, state))
    return {"brief": brief.model_dump(), "asked_count": state.get("asked_count", 0),
            "followups": [], "done": False}


def plan(state: AgentState) -> dict:
    remaining = planner.SESSION_LIMIT - state.get("asked_count", 0)
    if remaining <= 0:
        return {"gaps": [], "done": True}
    with SessionLocal() as db:
        snapshot = profile_snapshot(_profile(db, state))
    gaps = planner.plan(state["brief"], snapshot, state.get("asked", []), state.get("followups", []),
                        target_role=None, remaining=remaining)
    return {"gaps": [g.model_dump() for g in gaps], "done": not gaps}


def interview(state: AgentState) -> dict:
    with SessionLocal() as db:
        snapshot = profile_snapshot(_profile(db, state))
    gaps = [planner.Gap.model_validate(g) for g in state["gaps"]]
    return {"questions": interviewer.write_questions(gaps, snapshot)}


def wait_for_user(state: AgentState) -> dict:
    # Pauses the graph. The API resumes it with Command(resume=<Reply as dict>).
    reply = interrupt({"questions": state["questions"]})
    return {"reply": reply}


def interpret(state: AgentState) -> dict:
    reply = Reply.model_validate(state.get("reply") or {})
    resolved = resolve(state["questions"], reply)
    with SessionLocal() as db:
        snapshot = profile_snapshot(_profile(db, state))
        facts = {i["item_id"]: i["facts"] for i in snapshot["items"]}
        result = interpreter.interpret(db, resolved, reply.free_text, facts)
    return {
        "asked": [f"{q['item_id']}:{q['topic']}".lower() for q in state["questions"]],
        "asked_count": state.get("asked_count", 0) + len(state["questions"]),
        "followups": result["followups"],
        "conflicts": result["conflicts"],
        "last_recorded": result["recorded"],
    }


def finish(state: AgentState) -> dict:
    # Refresh the brief so the strength score reflects the new facts.
    with SessionLocal() as db:
        brief = analyst.get_brief(db, _profile(db, state))
    return {"brief": brief.model_dump(), "questions": [], "done": True}


def build_graph(checkpointer):
    g = StateGraph(AgentState)
    g.add_node("analyse", analyse)
    g.add_node("plan", plan)
    g.add_node("interview", interview)
    g.add_node("wait_for_user", wait_for_user)
    g.add_node("interpret", interpret)
    g.add_node("finish", finish)

    g.add_edge(START, "analyse")
    g.add_edge("analyse", "plan")
    g.add_conditional_edges("plan", lambda s: "finish" if s.get("done") else "interview")
    g.add_edge("interview", "wait_for_user")
    g.add_edge("wait_for_user", "interpret")
    g.add_edge("interpret", "plan")
    g.add_edge("finish", END)
    return g.compile(checkpointer=checkpointer)
