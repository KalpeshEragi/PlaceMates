"""Job preferences, the daily shortlist, tailored resumes and the daily digest."""

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import DailyDigest, JobMatch, JobPreferences, Profile, TailoredResume, User
from app.security import current_user
from app.services import daily, worker
from app.services.matching.matcher import todays_shortlist
from app.services.resume.pdf import render_pdf
from app.services.resume.review_pdf import render_review_pdf
from app.services.resume.service import profile_inputs

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


def _match_out(m: JobMatch, resume: TailoredResume | None = None) -> dict:
    j = m.job
    brief = None
    if resume:
        brief = {"status": resume.status, "score": resume.score,
                 "band": (resume.result or {}).get("score", {}).get("band")}
    return {"id": str(m.id), "rank": m.rank, "score": m.score, "reasons": m.reasons, "status": m.status,
            "resume": brief,
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
    matches = todays_shortlist(db, profile, prefs, today=datetime.now(daily.IST).date())
    resumes = {r.match_id: r for r in db.scalars(select(TailoredResume).where(
        TailoredResume.match_id.in_([m.id for m in matches])))}
    return {"date": daily.today_ist(), "resumes_per_day": daily.settings.resumes_per_day,
            "matches": [_match_out(m, resumes.get(m.id)) for m in matches]}


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


def _stale(updated: datetime | None) -> bool:
    """A run silent for 20 minutes has died (e.g. a GitHub Actions run that never started)."""
    return updated is None or datetime.now(timezone.utc) - updated > timedelta(minutes=20)


def _resume_row(db: Session, m: JobMatch) -> TailoredResume | None:
    return db.scalar(select(TailoredResume).where(TailoredResume.match_id == m.id))


@router.post("/matches/{match_id}/resume", status_code=202)
def create_resume(match_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Start writing a tailored resume for this job (2-5 minutes). Poll GET for the result."""
    profile, m = _own_match(db, user, match_id)
    row = _resume_row(db, m) or TailoredResume(match_id=m.id, profile_id=profile.id, result={})
    if row.status == "running" and not _stale(row.updated_at):
        raise HTTPException(409, "This resume is already being written")
    row.status, row.error = "running", None
    db.add(row)
    db.commit()
    try:
        worker.write_resume(profile.id, m.id)
    except worker.WorkerError as err:
        row.status, row.error = "failed", str(err)[:500]
        db.commit()
        raise HTTPException(503, "Couldn't start the resume writer. Try again in a minute.") from err
    return _resume_out(row)


@router.get("/matches/{match_id}/resume")
def get_resume(match_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _, m = _own_match(db, user, match_id)
    return _resume_out(_resume_row(db, m))


@router.get("/matches/{match_id}/resume.pdf")
def resume_pdf(match_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile, m = _own_match(db, user, match_id)
    row = _resume_row(db, m)
    if not row or row.status != "ready":
        raise HTTPException(404, "No finished resume for this job yet")
    items, _, education = profile_inputs(profile)
    name = re.sub(r"[^A-Za-z0-9]+", "_", f"{profile.full_name or 'Resume'} {m.job.company}").strip("_")
    return Response(render_pdf(profile, row.result["draft"], items, education), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{name[:60]}.pdf"'})


@router.get("/matches/{match_id}/review.pdf")
def review_pdf(match_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """The review that goes with the tailored resume: job match, recruiter views, what to confirm."""
    profile, m = _own_match(db, user, match_id)
    row = _resume_row(db, m)
    if not row or row.status != "ready":
        raise HTTPException(404, "No finished resume for this job yet")
    name = re.sub(r"[^A-Za-z0-9]+", "_", f"{profile.full_name or 'Resume'} {m.job.company}").strip("_")
    pdf = render_review_pdf(row.result, {"title": m.job.title, "company": m.job.company}, profile.full_name or "you")
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{name[:60]}_review.pdf"'})


def _digest_out(d: DailyDigest | None) -> dict | None:
    if not d:
        return None
    return {"date": d.batch_date, "status": d.status, "stats": d.stats, "error": d.error, "sent_at": d.sent_at}


@router.get("/digest/today")
def digest_today(user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    return _digest_out(db.scalar(select(DailyDigest).where(DailyDigest.profile_id == profile.id,
                                                          DailyDigest.batch_date == daily.today_ist())))


@router.post("/digest/run", status_code=202)
def digest_run(force: bool = False, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Run today's digest now (shortlist, top resumes, email) instead of waiting for the morning."""
    profile = _profile(user)
    if not _prefs(db, profile):
        raise HTTPException(400, "Set your job preferences first")
    try:
        worker.run_digest(profile.id, force)
    except worker.WorkerError as err:
        raise HTTPException(503, "Couldn't start today's email. Try again in a minute.") from err
    return {"started": True}
