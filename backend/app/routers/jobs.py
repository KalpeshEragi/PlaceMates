"""Jobs API: browse fetched jobs, see the last fetch run, trigger a fetch."""

import threading

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.models import Job, JobFetchRun, User
from app.security import current_user
from app.services.jobs.fetcher import run_fetch

router = APIRouter(prefix="/jobs", tags=["jobs"])
_fetch_lock = threading.Lock()


def fetch_in_background() -> bool:
    """Start a fetch unless one is already running. Returns False if busy."""
    if not _fetch_lock.acquire(blocking=False):
        return False

    def work():
        try:
            with SessionLocal() as db:
                run_fetch(db)
        finally:
            _fetch_lock.release()

    threading.Thread(target=work, daemon=True, name="job-fetch").start()
    return True


@router.get("")
def list_jobs(q: str | None = None, seniority: str | None = None, remote: bool | None = None,
              limit: int = 50, _: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Job).order_by(Job.posted_at.desc()).limit(min(limit, 200))
    if q:
        stmt = stmt.where(or_(Job.title.ilike(f"%{q}%"), Job.company.ilike(f"%{q}%")))
    if seniority:
        stmt = stmt.where(Job.seniority == seniority)
    if remote is not None:
        stmt = stmt.where(Job.remote == remote)
    return [{"id": str(j.id), "title": j.title, "company": j.company, "location": j.location,
             "remote": j.remote, "seniority": j.seniority, "source": j.source,
             "posted_at": j.posted_at, "apply_url": j.apply_url} for j in db.scalars(stmt)]


@router.get("/runs/latest")
def latest_run(_: User = Depends(current_user), db: Session = Depends(get_db)):
    run = db.scalar(select(JobFetchRun).order_by(JobFetchRun.started_at.desc()))
    if not run:
        return None
    return {"started_at": run.started_at, "finished_at": run.finished_at, "stats": run.stats,
            "errors": run.errors, "running": _fetch_lock.locked()}


@router.post("/fetch", status_code=202)
def trigger_fetch(_: User = Depends(current_user)):
    if not fetch_in_background():
        raise HTTPException(409, "A fetch is already running")
    return {"started": True}
