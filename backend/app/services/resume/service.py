"""Generate and store a tailored resume for one job match."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.snapshot import profile_snapshot
from app.models import JobMatch, Profile, TailoredResume

log = logging.getLogger(__name__)


def profile_inputs(profile: Profile) -> tuple[dict[str, dict], list[str], list[dict]]:
    snap = profile_snapshot(profile)
    items = {i["item_id"]: i for i in snap["items"] if i["kind"] != "education"}
    education = [i for i in snap["items"] if i["kind"] == "education"]
    return items, snap["skills"], education


def generate(db: Session, profile: Profile, match: JobMatch) -> TailoredResume:
    """Run the crew for this match (about 2-4 minutes). Re-running replaces the previous version."""
    from app.services.resume.crew import tailor  # heavy import: only when needed

    items, skills, education = profile_inputs(profile)
    job = {"title": match.job.title, "company": match.job.company, "description": match.job.description}
    row = db.scalar(select(TailoredResume).where(TailoredResume.match_id == match.id)) or \
        TailoredResume(match_id=match.id, profile_id=profile.id, result={})
    try:
        result = tailor(job, items, skills, education)
        row.status, row.result, row.score, row.error = "ready", result, result["score"]["score"], None
    except Exception as err:  # noqa: BLE001 - keep a record; the student can retry
        log.exception("Resume crew failed for match %s", match.id)
        row.status, row.error = "failed", f"{type(err).__name__}: {err}"[:500]
    db.add(row)
    db.commit()
    return row
