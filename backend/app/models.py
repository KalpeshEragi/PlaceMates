"""Database tables.

The profile is the single source of truth. It stores facts, never polished
resume wording. Each fact records where it came from (resume, mcq, note,
manual), so resume writers can only use what the user actually provided.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

EMBED_DIM = 384  # BAAI/bge-small-en-v1.5


def _id() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _id()
    google_sub: Mapped[str] = mapped_column(String, unique=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str | None] = mapped_column(String)
    avatar_url: Mapped[str | None] = mapped_column(String)
    # Encrypted with Fernet. Used later to send the daily email via gmail.send.
    google_refresh_token: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _created()

    profile: Mapped["Profile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    full_name: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)
    location: Mapped[str | None] = mapped_column(String)
    headline: Mapped[str | None] = mapped_column(String)
    summary: Mapped[str | None] = mapped_column(Text)
    links: Mapped[list] = mapped_column(JSONB, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="profile")
    items: Mapped[list["ProfileItem"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="ProfileItem.position"
    )
    skills: Mapped[list["Skill"]] = relationship(back_populates="profile", cascade="all, delete-orphan")


class ProfileItem(Base):
    """One experience, project, education entry, certification or award."""

    __tablename__ = "profile_items"

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String)  # experience | project | education | certification | award
    title: Mapped[str] = mapped_column(String)
    organization: Mapped[str | None] = mapped_column(String)
    start_date: Mapped[str | None] = mapped_column(String)
    end_date: Mapped[str | None] = mapped_column(String)
    # Exactly what the uploaded resume said. Never rewritten.
    original_text: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = _created()

    profile: Mapped[Profile] = relationship(back_populates="items")
    facts: Mapped[list["ItemFact"]] = relationship(
        back_populates="item", cascade="all, delete-orphan", order_by="ItemFact.created_at"
    )


class ItemFact(Base):
    __tablename__ = "item_facts"

    id: Mapped[uuid.UUID] = _id()
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profile_items.id", ondelete="CASCADE"), index=True)
    field: Mapped[str] = mapped_column(String)  # bullet | tech | scale | role | features | outcome | detail ...
    value: Mapped[object] = mapped_column(JSONB)
    source: Mapped[str] = mapped_column(String)  # resume | mcq | note | manual
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    # Which agent prompt version recorded it (None for resume/manual facts).
    prompt_version: Mapped[str | None] = mapped_column(String)
    # Evidence: the raw answer this fact was interpreted from (None for resume/manual).
    answer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("agent_answers.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = _created()

    item: Mapped[ProfileItem] = relationship(back_populates="facts")


class ProfileBrief(Base):
    """The analyst's cached understanding of a profile. Rebuilt when the profile changes."""

    __tablename__ = "profile_briefs"

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), unique=True)
    profile_hash: Mapped[str] = mapped_column(String)
    prompt_version: Mapped[str] = mapped_column(String)
    brief: Mapped[dict] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AgentSession(Base):
    """One profile-agent chat. Its LangGraph state lives in the checkpointer under thread_id."""

    __tablename__ = "agent_sessions"

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    thread_id: Mapped[str] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String, default="active")  # active | paused | done
    created_at: Mapped[datetime] = _created()


# ── Jobs ──────────────────────────────────────────────────────────────


class Job(Base):
    """One job posting, normalized across sources. The same role seen on two sources is one row."""

    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = _id()
    source: Mapped[str] = mapped_column(String)            # greenhouse | lever | ashby | adzuna | jsearch
    source_id: Mapped[str] = mapped_column(String)         # the posting id at that source
    dedupe_key: Mapped[str] = mapped_column(String, unique=True)  # company|title|city, normalized
    company: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String)
    location: Mapped[str | None] = mapped_column(String)
    remote: Mapped[bool] = mapped_column(default=False)
    seniority: Mapped[str] = mapped_column(String, default="unknown")  # intern | entry | mid | senior | unknown
    employment_type: Mapped[str | None] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    apply_url: Mapped[str] = mapped_column(String)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    first_seen_at: Mapped[datetime] = _created()
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    raw: Mapped[dict] = mapped_column(JSONB)  # original posting, for debugging and re-parsing
    # bge-small (384 numbers) of title + description, for semantic matching. Filled after fetching.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBED_DIM))


class JobPreferences(Base):
    """What a student is looking for. Hard filters: experience level, job types, location.
    Ranking only: target roles, minimum salary."""

    __tablename__ = "job_preferences"

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), unique=True)
    target_roles: Mapped[list] = mapped_column(JSONB, default=list)     # ["Backend developer", "Data analyst"]
    locations: Mapped[list] = mapped_column(JSONB, default=list)        # ["Bengaluru", "Pune"]; empty = anywhere in India
    remote_ok: Mapped[bool] = mapped_column(default=True)
    experience_level: Mapped[str] = mapped_column(String, default="entry")  # intern | entry | mid
    job_types: Mapped[list] = mapped_column(JSONB, default=lambda: ["full_time"])  # full_time | internship
    min_salary_lpa: Mapped[float | None] = mapped_column(Float)          # ranking only; most posts omit salary
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ProfileEmbedding(Base):
    """Cached profile embedding; recomputed when the profile text changes."""

    __tablename__ = "profile_embeddings"

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), unique=True)
    text_hash: Mapped[str] = mapped_column(String)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBED_DIM))


class ExemplarBullet(Base):
    """A bullet from a real resume that passed a screen (see corpus/metadata.json).
    The resume writer uses these for style only, never for content."""

    __tablename__ = "exemplar_bullets"

    id: Mapped[uuid.UUID] = _id()
    text: Mapped[str] = mapped_column(Text, unique=True)
    section: Mapped[str] = mapped_column(String, index=True)   # experience | project
    role: Mapped[str] = mapped_column(String)                  # Software Engineer | Data Scientist
    level: Mapped[str] = mapped_column(String)                 # Intern | New Grad | Full-Time ...
    source_file: Mapped[str] = mapped_column(String)           # corpus file it came from
    heading: Mapped[str | None] = mapped_column(String)        # the job/project line above it
    quality: Mapped[float] = mapped_column(Float, index=True)  # 0-1, computed in code
    parts: Mapped[dict] = mapped_column(JSONB)                 # {action, tech, metric, outcome, words, ...}
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBED_DIM))


class JobMatch(Base):
    """A job picked for a student. One row per (profile, job): a job is never picked twice."""

    __tablename__ = "job_matches"
    __table_args__ = (UniqueConstraint("profile_id", "job_id"),)

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    batch_date: Mapped[str] = mapped_column(String, index=True)  # "2026-11-09": the day's shortlist
    rank: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Float)
    reasons: Mapped[list] = mapped_column(JSONB)  # short, human-readable "why this job"
    status: Mapped[str] = mapped_column(String, default="shortlisted")  # shortlisted | sent | applied | dismissed
    created_at: Mapped[datetime] = _created()

    job: Mapped[Job] = relationship()


class JobFetchRun(Base):
    """One run of the daily fetcher: what each source returned and what failed."""

    __tablename__ = "job_fetch_runs"

    id: Mapped[uuid.UUID] = _id()
    started_at: Mapped[datetime] = _created()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stats: Mapped[dict | None] = mapped_column(JSONB)    # per source: fetched, kept, new
    errors: Mapped[list | None] = mapped_column(JSONB)   # [{source, board, error}]


# ── Permanent progress (separate from LangGraph checkpoints) ──────────
# entity_id is a profile item UUID as text, or "personal" / "skills".


class EntityState(Base):
    """The analyst's understanding of one entity, and where the student is with it."""

    __tablename__ = "entity_states"
    __table_args__ = (UniqueConstraint("profile_id", "entity_id"),)

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    entity_id: Mapped[str] = mapped_column(String)
    section: Mapped[str] = mapped_column(String)
    understanding: Mapped[str | None] = mapped_column(Text)
    entity_hash: Mapped[str | None] = mapped_column(String)  # reassess when the entity changes
    status: Mapped[str] = mapped_column(String, default="not_started")  # not_started | in_progress | finished | skipped
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TopicState(Base):
    """One information dimension of an entity: what we know (info_state) and
    whether it was discussed (convo_state). The two are tracked separately."""

    __tablename__ = "topic_states"
    __table_args__ = (UniqueConstraint("profile_id", "entity_id", "key"),)

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    entity_id: Mapped[str] = mapped_column(String, index=True)
    key: Mapped[str] = mapped_column(String)  # canonical dimension key, e.g. "evaluation"
    label: Mapped[str] = mapped_column(String)
    why: Mapped[str | None] = mapped_column(Text)  # why adding it could help, in friendly words
    priority: Mapped[int] = mapped_column(Integer, default=3)
    info_state: Mapped[str] = mapped_column(String, default="MISSING")
    convo_state: Mapped[str] = mapped_column(String, default="NOT_EXPLORED")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AgentAnswer(Base):
    """Every response, saved BEFORE any interpretation, so nothing is ever lost."""

    __tablename__ = "agent_answers"

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("agent_sessions.id", ondelete="SET NULL"))
    entity_id: Mapped[str] = mapped_column(String)
    topic_key: Mapped[str] = mapped_column(String)
    question: Mapped[dict] = mapped_column(JSONB)
    raw: Mapped[dict] = mapped_column(JSONB)  # {keys, labels, text, number}
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | interpreted | failed | skipped
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    prompt_version: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = _created()
    interpreted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Skill(Base):
    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("profile_id", "name"),)

    id: Mapped[uuid.UUID] = _id()
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)

    profile: Mapped[Profile] = relationship(back_populates="skills")
