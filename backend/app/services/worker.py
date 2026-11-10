"""Run heavy AI work (resume crew, daily digest) somewhere other than the request.

    local   a background thread in this process (development; one machine with enough memory)
    github  a GitHub Actions workflow run (production: the free web server has 512 MB, CrewAI needs more)
The worker writes its result to the database; the page polls for it either way.
"""

import logging
import threading
import uuid

import httpx

from app.config import settings
from app.db import SessionLocal

log = logging.getLogger(__name__)


class WorkerError(Exception):
    pass


def _dispatch(workflow: str, inputs: dict[str, str]) -> None:
    if not (settings.github_repo and settings.github_token):
        raise WorkerError("GITHUB_REPO and GITHUB_TOKEN must be set when WORKER=github")
    resp = httpx.post(
        f"https://api.github.com/repos/{settings.github_repo}/actions/workflows/{workflow}/dispatches",
        headers={"Authorization": f"Bearer {settings.github_token}", "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28"},
        json={"ref": settings.github_ref, "inputs": inputs}, timeout=20)
    if resp.status_code != 204:
        raise WorkerError(f"GitHub dispatch failed ({resp.status_code}): {resp.text[:200]}")
    log.info("Dispatched %s %s", workflow, inputs)


def write_resume(profile_id: uuid.UUID, match_id: uuid.UUID) -> None:
    if settings.worker == "github":
        _dispatch("resume.yml", {"match_id": str(match_id)})
        return

    def work():
        from app.models import JobMatch, Profile
        from app.services.resume.service import generate
        with SessionLocal() as db:
            generate(db, db.get(Profile, profile_id), db.get(JobMatch, match_id))
    threading.Thread(target=work, daemon=True, name="resume-crew").start()


def run_digest(profile_id: uuid.UUID, force: bool) -> None:
    if settings.worker == "github":
        inputs = {"profile_id": str(profile_id), "force": "true" if force else "false"}
        _dispatch("daily.yml", inputs)
        return

    def work():
        from app.models import Profile
        from app.services import daily
        with SessionLocal() as db:
            daily.run_for_profile(db, db.get(Profile, profile_id), force=force)
    threading.Thread(target=work, daemon=True, name="daily-digest").start()
