import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import QuestionBatch, User
from app.security import current_user
from app.services import gaps, questions

router = APIRouter(prefix="/enrich", tags=["enrich"])


class AnswerIn(BaseModel):
    batch_id: uuid.UUID
    # Either shorthand text ("1c 2a 3abd + note") or structured clicks.
    reply: str | None = None
    answers: list[questions.Answer] | None = None


def _state(db: Session, user: User) -> dict:
    profile = user.profile
    if not profile:
        raise HTTPException(404, "Profile not found")
    db.refresh(profile)
    batch = questions.next_batch(db, profile)
    return {
        "strength": gaps.strength(profile),
        "batch": {"id": str(batch.id), "questions": batch.questions} if batch else None,
    }


@router.get("")
def current(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Profile strength plus the questions to show now (None when done)."""
    return _state(db, user)


@router.post("/answer")
def answer(body: AnswerIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    batch = db.get(QuestionBatch, body.batch_id)
    if not batch or not user.profile or batch.profile_id != user.profile.id:
        raise HTTPException(404, "Question batch not found")
    if batch.status != "open":
        raise HTTPException(409, "Already answered")

    parsed = body.answers if body.answers is not None else questions.parse_reply(body.reply or "", len(batch.questions))
    questions.save_answers(db, batch, parsed)
    return _state(db, user)
