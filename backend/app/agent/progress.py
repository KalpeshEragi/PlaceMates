"""Read/write entity and topic progress. Plain code, no AI.

Rules that hold everywhere:
- Information state (what we know) and conversation state (what we discussed) are separate.
- Skipping a topic never deletes or downgrades a fact; a skipped topic is never shown as COMPLETE.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EntityState, TopicState

OPEN_INFO = ("MISSING", "PARTIAL")
SUGGEST_LIMIT = 3


def entity_state(db: Session, profile_id: uuid.UUID, entity_id: str, section: str) -> EntityState:
    row = db.scalar(select(EntityState).where(EntityState.profile_id == profile_id,
                                              EntityState.entity_id == entity_id))
    if not row:
        row = EntityState(profile_id=profile_id, entity_id=entity_id, section=section)
        db.add(row)
        db.flush()
    return row


def topics(db: Session, profile_id: uuid.UUID, entity_id: str) -> list[TopicState]:
    return list(db.scalars(select(TopicState).where(
        TopicState.profile_id == profile_id, TopicState.entity_id == entity_id)
        .order_by(TopicState.priority.desc(), TopicState.key)))


def topic(db: Session, profile_id: uuid.UUID, entity_id: str, key: str) -> TopicState | None:
    return db.scalar(select(TopicState).where(TopicState.profile_id == profile_id,
                                              TopicState.entity_id == entity_id, TopicState.key == key))


def suggestions(rows: list[TopicState], offset: int = 0) -> tuple[list[TopicState], bool]:
    """Best open opportunities, a few at a time. Returns (page, more_available)."""
    open_rows = [t for t in rows if t.info_state in OPEN_INFO and t.priority >= 3
                 and t.convo_state not in ("SKIPPED", "EXPLORED")]
    # Highest priority first; MISSING before PARTIAL on ties.
    open_rows.sort(key=lambda t: (-t.priority, t.info_state != "MISSING"))
    page = open_rows[offset:offset + SUGGEST_LIMIT]
    return page, len(open_rows) > offset + SUGGEST_LIMIT


def set_convo(db: Session, profile_id: uuid.UUID, entity_id: str, key: str, state: str) -> None:
    row = topic(db, profile_id, entity_id, key)
    if not row:
        return
    # Never move a finished conversation back to a weaker state by accident.
    if row.convo_state in ("EXPLORED", "SKIPPED") and state in ("SUGGESTED", "SELECTED"):
        return
    row.convo_state = state
    if state == "SKIPPED" and row.info_state == "MISSING":
        row.info_state = "SKIPPED"  # nothing known and student chose not to discuss
    db.flush()


def set_info(db: Session, profile_id: uuid.UUID, entity_id: str, key: str, state: str) -> None:
    """Only ever improves information state (an answer can't make us know less)."""
    rank = {"SKIPPED": 0, "MISSING": 0, "PARTIAL": 1, "COMPLETE": 2}
    row = topic(db, profile_id, entity_id, key)
    if row and state in rank and rank[state] > rank.get(row.info_state, 0):
        row.info_state = state
        db.flush()


def counts(rows: list[TopicState]) -> dict:
    applicable = [t for t in rows if t.info_state != "NOT_APPLICABLE"]
    return {"complete": sum(t.info_state == "COMPLETE" for t in applicable), "total": len(applicable)}
