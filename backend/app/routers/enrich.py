"""Profile agent API: guided topics, one question at a time, full student control."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from langgraph.types import Command
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agent import analyst, answers, interpreter, progress, runtime
from app.agent.domain import SECTIONS
from app.agent.entities import entity_context, entity_list
from app.db import get_db
from app.models import AgentAnswer, AgentSession, EntityState, Profile, User
from app.security import current_user
from app.services.llm import LLMError

router = APIRouter(prefix="/enrich", tags=["enrich"])

# Which actions each paused screen accepts.
SCREEN_ACTIONS = {
    "topics": {"select", "more", "skip_entity", "finish_section"},
    "question": {"skip_question", "skip_topic", "finish_topic", "finish_entity", "finish_section"},
    "summary": {"continue", "back_to_topics"},
}


class StartIn(BaseModel):
    entity_id: str | None = None  # revisit one project/experience


class ActionIn(BaseModel):
    type: str
    keys: list[str] = []


def _profile(user: User) -> Profile:
    if not user.profile:
        raise HTTPException(404, "Profile not found")
    return user.profile


def _session(db: Session, profile: Profile) -> AgentSession | None:
    return db.scalar(select(AgentSession).where(
        AgentSession.profile_id == profile.id, AgentSession.status.in_(["active", "paused"]))
        .order_by(AgentSession.created_at.desc()))


def _sections(db: Session, profile: Profile) -> list[dict]:
    states = {s.entity_id: s.status for s in db.scalars(
        select(EntityState).where(EntityState.profile_id == profile.id))}
    ents = entity_list(profile)
    out = []
    for key, label in SECTIONS:
        items = [e for e in ents if e["section"] == key]
        if not items:
            continue
        out.append({"key": key, "label": label, "entities": [
            {"id": e["id"], "title": e["title"], "status": states.get(e["id"], "not_started"),
             **progress.counts(progress.topics(db, profile.id, e["id"]))} for e in items]})
    return out


def _view(db: Session, profile: Profile) -> dict:
    session = _session(db, profile)
    screen = None
    if session:
        screen = runtime.pending_screen(session.thread_id)
        if screen is None:  # the graph reached the end
            notices = runtime.state_values(session.thread_id).get("notices", [])
            session.status = "done"
            db.commit()
            screen = {"screen": "done", "notices": notices}
            session_status = "done"
        else:
            session_status = session.status
    else:
        session_status = "none"

    header = None
    try:
        if profile.items:
            b = analyst.get_brief(db, profile, allow_stale=True)
            header = {"strength": b.strength, "reasons": b.strength_reasons, "summary": b.summary}
    except LLMError:
        pass
    failed = db.scalar(select(func.count()).select_from(AgentAnswer).where(
        AgentAnswer.profile_id == profile.id, AgentAnswer.status == "failed"))
    return {"header": header, "session": {"status": session_status, "screen": screen},
            "sections": _sections(db, profile), "failed_answers": failed}


def _resume(session: AgentSession, value: dict) -> None:
    try:
        runtime.get_graph().invoke(Command(resume=value), runtime.config(session.thread_id))
    except LLMError as err:
        raise HTTPException(502, f"The assistant is busy right now. Your progress is saved; try again in a minute. ({err})")


def _paused_on(db: Session, profile: Profile) -> tuple[AgentSession, dict]:
    session = _session(db, profile)
    screen = runtime.pending_screen(session.thread_id) if session else None
    if not session or not screen:
        raise HTTPException(409, "No conversation is waiting right now")
    if session.status == "paused":
        session.status = "active"
        db.commit()
    return session, screen


@router.get("")
def current(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _view(db, _profile(user))


@router.post("/start")
def start(body: StartIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    session = _session(db, profile)
    if session and not body.entity_id:  # resume exactly where the student left off
        session.status = "active"
        db.commit()
        return _view(db, profile)
    if body.entity_id and entity_context(profile, body.entity_id) is None:
        raise HTTPException(404, "Item not found")
    if session:  # revisiting one item ends the previous conversation (everything is already saved)
        session.status = "done"
    if not profile.items and not body.entity_id:
        raise HTTPException(400, "Add a resume or some items first")
    session = AgentSession(profile_id=profile.id, thread_id=f"enrich-{uuid.uuid4()}")
    db.add(session)
    db.commit()
    try:
        runtime.get_graph().invoke({"profile_id": str(profile.id), "session_id": str(session.id),
                                    "focus": body.entity_id}, runtime.config(session.thread_id))
    except LLMError as err:
        raise HTTPException(502, f"The assistant is busy right now, try again in a minute. ({err})")
    return _view(db, profile)


@router.post("/action")
def action(body: ActionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    session, screen = _paused_on(db, profile)
    if body.type not in SCREEN_ACTIONS.get(screen["screen"], set()):
        raise HTTPException(400, f"'{body.type}' isn't available on this screen")
    if body.type == "skip_question":  # keep a record that it was skipped
        q = screen["question"]
        answers.save_answer(db, profile.id, session.id, screen["entity"]["id"], q,
                            {"keys": [], "labels": [], "text": None, "number": None, "skipped": True}).status = "skipped"
        db.commit()
    _resume(session, body.model_dump())
    return _view(db, profile)


@router.post("/answer")
def answer(body: answers.AnswerIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    session, screen = _paused_on(db, profile)
    if screen["screen"] != "question":
        raise HTTPException(400, "There's no question waiting for an answer")
    raw = answers.normalize(screen["question"], body)
    if answers.is_empty(raw):
        raise HTTPException(400, "Type or pick an answer, or use Skip")
    # 1) Save the raw response. 2) Only then let the agent interpret it.
    saved = answers.save_answer(db, profile.id, session.id, screen["entity"]["id"], screen["question"], raw)
    _resume(session, {"type": "answer", "answer_id": str(saved.id)})
    return _view(db, profile)


@router.post("/pause")
def pause(user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    session = _session(db, profile)
    if session:
        session.status = "paused"
        db.commit()
    return _view(db, profile)


@router.post("/retry")
def retry_failed(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Re-interpret answers whose interpretation failed. Safe to repeat: no duplicate facts."""
    profile = _profile(user)
    failed = list(db.scalars(select(AgentAnswer).where(
        AgentAnswer.profile_id == profile.id, AgentAnswer.status == "failed")))
    fixed = 0
    for a in failed:
        ctx = entity_context(profile, a.entity_id)
        if ctx and interpreter.interpret(db, profile, a, ctx) is None:
            fixed += 1
    return {"retried": len(failed), "fixed": fixed, **_view(db, profile)}
