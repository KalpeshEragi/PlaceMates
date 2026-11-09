"""The daily digest: after the morning job fetch, for each student:

    1. today's shortlist (top 5, same all day)
    2. tailored resumes for the top N (settings.resumes_per_day, default 3) - one crew at a time;
       if the free AI daily limit is hit, the rest are marked pending and the batch moves on
    3. one email from the student's own Gmail: all 5 jobs with Apply buttons, resume PDFs attached

One DailyDigest row per student per day, so a restart never sends the same day twice.
"""

import html
import logging
import re
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.models import DailyDigest, JobMatch, JobPreferences, Profile, TailoredResume
from app.services import gmail
from app.services.matching.matcher import todays_shortlist
from app.services.resume.pdf import render_pdf
from app.services.resume.service import generate, profile_inputs

log = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))


def today_ist() -> str:
    return datetime.now(IST).date().isoformat()


def _resume(db: Session, match: JobMatch) -> TailoredResume | None:
    return db.scalar(select(TailoredResume).where(TailoredResume.match_id == match.id))


def write_resumes(db: Session, profile: Profile, matches: list[JobMatch], limit: int) -> dict:
    """Resumes for the top `limit` matches that don't have one yet. Stops calling the AI once the daily limit hits."""
    stats = {"ready": 0, "failed": 0, "pending": 0}
    out_of_budget = False
    for m in matches[:limit]:
        row = _resume(db, m)
        if row and row.status == "ready":
            stats["ready"] += 1
            continue
        if out_of_budget:
            row = row or TailoredResume(match_id=m.id, profile_id=profile.id, result={})
            row.status, row.error = "pending", "Today's free AI limit was reached. It will be written later."
            db.add(row)
            db.commit()
        else:
            row = generate(db, profile, m)
            out_of_budget = row.status == "pending"
        stats[row.status if row.status in stats else "failed"] += 1
    return stats


def _filename(profile: Profile, match: JobMatch) -> str:
    name = re.sub(r"[^A-Za-z0-9]+", "_", f"{profile.full_name or 'Resume'} {match.job.company}").strip("_")
    return f"{name[:60]}.pdf"


def _button(url: str, label: str, primary: bool) -> str:
    style = ("background:#111;color:#fff;" if primary else "background:#fff;color:#111;border:1px solid #bbb;")
    return (f'<a href="{html.escape(url)}" style="{style}display:inline-block;padding:7px 14px;border-radius:6px;'
            f'text-decoration:none;font-size:13px;margin-right:6px">{label}</a>')


def build_email(profile: Profile, matches: list[JobMatch], resumes: dict) -> tuple[str, str, str]:
    """-> (subject, html, plain text)."""
    day = datetime.now(IST).strftime("%d %b")
    subject = f"PlaceMates: {len(matches)} jobs for you today ({day})"
    cards, lines = [], [f"Your top {len(matches)} jobs for {day}.", ""]
    view = f"{settings.frontend_url}/matches"
    for m in matches:
        j, r = m.job, resumes.get(m.id)
        where = ", ".join(x for x in (j.location, "remote" if j.remote else None) if x)
        why = "".join(f"<li>{html.escape(x)}</li>" for x in (m.reasons or [])[:3])
        if r and r.status == "ready":
            s = r.result.get("score", {})
            votes = s.get("shortlist_votes", {})
            resume = (f"<p style='margin:8px 0 4px;font-size:13px'><b>Tailored resume attached</b>: score "
                      f"{s.get('score')} ({s.get('band')}), HR panel {votes.get('shortlist', 0)} shortlist / "
                      f"{votes.get('maybe', 0)} maybe / {votes.get('reject', 0)} reject.</p>")
            confirm = r.result.get("ask_student", [])[:1]
            if confirm:
                note = confirm[0] if len(confirm[0]) <= 180 else confirm[0][:177] + "..."
                resume += ("<p style='margin:0;font-size:12px;color:#555'>Check before sending: "
                           f"{html.escape(note)}</p>")
            lines.append(f"{m.rank}. {j.title} at {j.company} ({where}) - resume score {s.get('score')} attached")
        elif r and r.status == "pending":
            resume = ("<p style='margin:8px 0 0;font-size:13px;color:#555'>Resume waiting: today's free AI limit "
                      "was reached. Generate it on PlaceMates.</p>")
            lines.append(f"{m.rank}. {j.title} at {j.company} ({where}) - resume pending")
        else:
            resume = ("<p style='margin:8px 0 0;font-size:13px;color:#555'>Want a tailored resume for this one? "
                      "Generate it on PlaceMates.</p>")
            lines.append(f"{m.rank}. {j.title} at {j.company} ({where})")
        lines.append(f"   Apply: {j.apply_url}")
        cards.append(
            "<div style='border:1px solid #e3e3e3;border-radius:10px;padding:14px 16px;margin:0 0 12px'>"
            f"<div style='font-size:12px;color:#777'>#{m.rank} &middot; {html.escape(j.source)}</div>"
            f"<div style='font-size:16px;font-weight:bold;margin:2px 0'>{html.escape(j.title)}</div>"
            f"<div style='font-size:13px;color:#444'>{html.escape(j.company)}{' &middot; ' + html.escape(where) if where else ''}</div>"
            f"<ul style='margin:8px 0 0;padding-left:18px;font-size:13px;color:#333'>{why}</ul>{resume}"
            f"<div style='margin-top:10px'>{_button(j.apply_url, 'Apply', True)}{_button(view, 'View on PlaceMates', False)}</div>"
            "</div>")
    body = ("<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111'>"
            f"<p style='font-size:15px'>Hi {html.escape((profile.full_name or '').split(' ')[0] or 'there')}, "
            f"here are your top {len(matches)} jobs for today.</p>{''.join(cards)}"
            "<p style='font-size:12px;color:#777'>Resumes use only facts from your PlaceMates profile. Read each one "
            "before you send it. Scores are a guide, not a promise of a shortlist.</p></div>")
    lines += ["", f"See all details: {view}"]
    return subject, body, "\n".join(lines)


def run_for_profile(db: Session, profile: Profile, force: bool = False) -> DailyDigest:
    day = today_ist()
    digest = db.scalar(select(DailyDigest).where(DailyDigest.profile_id == profile.id,
                                                 DailyDigest.batch_date == day))
    if digest and digest.status in ("sent", "running") and not force:
        return digest
    digest = digest or DailyDigest(profile_id=profile.id, batch_date=day)
    digest.status, digest.error = "running", None
    db.add(digest)
    db.commit()
    started = time.time()
    try:
        prefs = db.scalar(select(JobPreferences).where(JobPreferences.profile_id == profile.id))
        matches = todays_shortlist(db, profile, prefs, today=datetime.now(IST).date())
        stats = write_resumes(db, profile, matches, settings.resumes_per_day) if matches else {}
        stats.update(matches=len(matches), seconds=round(time.time() - started))
        digest.stats = stats
        if not matches:
            digest.status, digest.error = "skipped", "No new matching jobs today"
        elif not settings.daily_email:
            digest.status, digest.error = "skipped", "Daily email is turned off"
        else:
            resumes = {m.id: _resume(db, m) for m in matches}
            items, _, education = profile_inputs(profile)
            files = [(_filename(profile, m), render_pdf(profile, r.result["draft"], items, education))
                     for m in matches if (r := resumes.get(m.id)) and r.status == "ready"]
            subject, body, text = build_email(profile, matches, resumes)
            gmail.send(profile.user, subject, body, text, files)
            digest.status, digest.sent_at = "sent", datetime.now(timezone.utc)
            for m in matches:
                if m.status == "shortlisted":
                    m.status = "sent"
    except Exception as err:  # noqa: BLE001 - recorded on the digest; the next run can retry
        log.exception("Daily digest failed for profile %s", profile.id)
        digest.status, digest.error = "failed", f"{type(err).__name__}: {err}"[:500]
    db.commit()
    return digest


def run_for_all() -> None:
    """Every student with preferences and a profile. Called by the scheduler after the morning fetch."""
    with SessionLocal() as db:
        ids = db.scalars(select(JobPreferences.profile_id)).all()
    for pid in ids:
        with SessionLocal() as db:
            profile = db.get(Profile, pid)
            if profile and profile.items:
                d = run_for_profile(db, profile)
                log.info("Daily digest for %s: %s %s", pid, d.status, d.stats)
