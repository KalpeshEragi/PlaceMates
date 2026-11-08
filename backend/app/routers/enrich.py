"""Profile agent API: start a chat, answer a round, stop."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from langgraph.types import Command
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import analyst, runtime
from app.agent.answers import Answer, Reply, parse_shorthand
from app.db import get_db
from app.models import AgentSession, Profile, User
from app.security import current_user
from app.services.llm import LLMError

router = APIRouter(prefix="/enrich", tags=["enrich"])


class AnswerIn(BaseModel):
    # Shorthand ("1c 2a 3abd + note") or structured taps; free_text works with either.
    reply: str | None = None
    answers: list[Answer] | None = None
    free_text: str | None = None


def _profile(user: User) -> Profile:
    if not user.profile:
        raise HTTPException(404, "Profile not found")
    return user.profile


def _active(db: Session, profile: Profile) -> AgentSession | None:
    return db.scalar(select(AgentSession).where(
        AgentSession.profile_id == profile.id, AgentSession.status == "active"))


def _view(db: Session, profile: Profile, session: AgentSession | None) -> dict:
    """What the UI needs: strength, current questions, what was just saved."""
    questions, values = None, {}
    if session:
        questions = runtime.pending_questions(session.thread_id)
        values = runtime.get_graph().get_state(runtime.config(session.thread_id)).values
        if questions is None and session.status == "active":
            session.status = "done"  # graph reached END
            db.commit()

    brief = values.get("brief")
    if brief is None and profile.items:
        try:
            brief = analyst.get_brief(db, profile).model_dump()
        except LLMError:
            brief = None
    return {
        "strength": brief["strength"] if brief else 0,
        "strength_reasons": brief["strength_reasons"] if brief else [],
        "summary": brief["summary"] if brief else None,
        "status": "asking" if questions else ("done" if session else "idle"),
        "questions": questions or [],
        "last_recorded": values.get("last_recorded", []),
        "conflicts": values.get("conflicts", []),
    }


def _run(fn):
    try:
        return fn()
    except LLMError as err:
        raise HTTPException(502, f"The assistant is busy right now, try again in a minute: {err}")


@router.get("")
def current(user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    return _view(db, profile, _active(db, profile))


@router.post("/start")
def start(user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    if not profile.items:
        raise HTTPException(400, "Add a resume or some items first")
    session = _active(db, profile)
    if not session:
        session = AgentSession(profile_id=profile.id, thread_id=f"enrich-{uuid.uuid4()}")
        db.add(session)
        db.commit()
        _run(lambda: runtime.get_graph().invoke({"profile_id": str(profile.id)}, runtime.config(session.thread_id)))
    return _view(db, profile, session)


@router.post("/answer")
def answer(body: AnswerIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    session = _active(db, profile)
    questions = runtime.pending_questions(session.thread_id) if session else None
    if not questions:
        raise HTTPException(409, "No questions waiting for an answer")

    answers = body.answers if body.answers is not None else parse_shorthand(body.reply or "", len(questions))
    reply = Reply(answers=answers, free_text=(body.free_text or "").strip() or None)
    _run(lambda: runtime.get_graph().invoke(Command(resume=reply.model_dump()), runtime.config(session.thread_id)))
    db.refresh(profile)
    return _view(db, profile, session)


@router.post("/stop")
def stop(user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    session = _active(db, profile)
    if session:
        session.status = "done"
        db.commit()
    return _view(db, profile, None)
