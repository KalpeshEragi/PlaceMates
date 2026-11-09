"""Job preferences and the daily shortlist."""

import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import JobMatch, JobPreferences, Profile, TailoredResume, User
from app.security import current_user
from app.services.matching.matcher import todays_shortlist
from app.services.resume.service import generate

router = APIRouter(tags=["matches"])


class PreferencesIn(BaseModel):
    target_roles: list[str] = Field(default=[], max_length=5)
    locations: list[str] = Field(default=[], max_length=8)
    remote_ok: bool = True
    experience_level: Literal["intern", "entry", "mid"] = "entry"
    job_types: list[Literal["full_time", "internship"]] = Field(default=["full_time"], min_length=1)
    min_salary_lpa: float | None = None


def _profile(user: User) -> Profile:
    if not user.profile:
        raise HTTPException(404, "Profile not found")
    return user.profile


def _prefs(db: Session, profile: Profile) -> JobPreferences | None:
    return db.scalar(select(JobPreferences).where(JobPreferences.profile_id == profile.id))


def _prefs_out(p: JobPreferences | None) -> dict | None:
    if not p:
        return None
    return {k: getattr(p, k) for k in PreferencesIn.model_fields}


def _match_out(m: JobMatch) -> dict:
    j = m.job
    return {"id": str(m.id), "rank": m.rank, "score": m.score, "reasons": m.reasons, "status": m.status,
            "job": {"id": str(j.id), "title": j.title, "company": j.company, "location": j.location,
                    "remote": j.remote, "seniority": j.seniority, "source": j.source,
                    "posted_at": j.posted_at, "apply_url": j.apply_url,
                    "description": j.description[:600]}}


@router.get("/preferences")
def get_preferences(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _prefs_out(_prefs(db, _profile(user)))


@router.put("/preferences")
def set_preferences(body: PreferencesIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    prefs = _prefs(db, profile) or JobPreferences(profile_id=profile.id)
    clean = body.model_dump()
    clean["target_roles"] = [r.strip() for r in body.target_roles if r.strip()]
    clean["locations"] = [c.strip() for c in body.locations if c.strip()]
    clean["job_types"] = list(dict.fromkeys(body.job_types))
    for k, v in clean.items():
        setattr(prefs, k, v)
    db.add(prefs)
    db.commit()
    return _prefs_out(prefs)


@router.get("/matches/today")
def matches_today(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Today's shortlist (built on first request of the day, then the same all day)."""
    profile = _profile(user)
    prefs = _prefs(db, profile)
    if not prefs:
        raise HTTPException(400, "Set your job preferences first")
    if not profile.items:
        raise HTTPException(400, "Add your resume first")
    return {"date": date.today().isoformat(), "matches": [_match_out(m) for m in todays_shortlist(db, profile, prefs)]}


class StatusIn(BaseModel):
    status: Literal["applied", "dismissed", "shortlisted"]


@router.patch("/matches/{match_id}")
def set_status(match_id: uuid.UUID, body: StatusIn, user: User = Depends(current_user),
               db: Session = Depends(get_db)):
    m = db.get(JobMatch, match_id)
    if not m or m.profile_id != _profile(user).id:
        raise HTTPException(404, "Match not found")
    m.status = body.status
    db.commit()
    return _match_out(m)


def _resume_out(r: TailoredResume | None) -> dict | None:
    if not r:
        return None
    res, ev = r.result, r.result.get("evaluation", {})
    return {"status": r.status, "score": r.score, "error": r.error, "created_at": r.created_at,
            "draft": res.get("draft"), "text": res.get("text"), "score_parts": res.get("score"),
            "ats": ev.get("ats"), "panel": ev.get("panel"), "interview_prep": ev.get("interview_prep", []),
            "analysis": res.get("analysis"), "strategy": res.get("strategy"), "market": res.get("market"),
            "dropped_for_truth": res.get("dropped_for_truth", []), "ask_student": res.get("ask_student", []),
            "seconds": res.get("seconds")}


def _own_match(db: Session, user: User, match_id: uuid.UUID) -> tuple[Profile, JobMatch]:
    profile = _profile(user)
    m = db.get(JobMatch, match_id)
    if not m or m.profile_id != profile.id:
        raise HTTPException(404, "Match not found")
    return profile, m


@router.post("/matches/{match_id}/resume")
def create_resume(match_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Write a tailored resume for this job (takes a few minutes)."""
    profile, m = _own_match(db, user, match_id)
    return _resume_out(generate(db, profile, m))


@router.get("/matches/{match_id}/resume")
def get_resume(match_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _, m = _own_match(db, user, match_id)
    return _resume_out(db.scalar(select(TailoredResume).where(TailoredResume.match_id == m.id)))
