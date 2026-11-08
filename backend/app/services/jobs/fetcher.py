"""Daily job fetch: pull every source in parallel, keep fresh India/remote tech roles, upsert.

One failing board never stops the run; failures are recorded on the JobFetchRun.
Re-running is safe: postings are upserted by dedupe_key, so nothing is duplicated.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Job, JobFetchRun
from app.services.jobs import sources
from app.services.jobs.companies import BOARDS
from app.services.jobs.normalize import Posting, dedupe_key, is_tech, seniority, where

log = logging.getLogger(__name__)
JSEARCH_QUERIES_PER_DAY = 3  # free tier is small


async def _collect() -> tuple[list[tuple[str, list[Posting]]], list[dict]]:
    tasks: list[tuple[str, str, object]] = []
    for kind, slugs in BOARDS.items():
        fn = getattr(sources, kind)
        tasks += [(kind, slug, fn) for slug in slugs]
    if settings.adzuna_app_id and settings.adzuna_app_key:
        tasks += [("adzuna", q, sources.adzuna) for q in sources.SEARCH_QUERIES]
    if settings.jsearch_api_key:
        tasks += [("jsearch", q, sources.jsearch) for q in sources.SEARCH_QUERIES[:JSEARCH_QUERIES_PER_DAY]]

    limits = httpx.Limits(max_connections=10)
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, limits=limits,
                                 headers={"User-Agent": "PlaceMates job fetcher"}) as client:
        results = await asyncio.gather(*(fn(client, arg) for _, arg, fn in tasks), return_exceptions=True)

    batches, errors = [], []
    for (kind, arg, _), res in zip(tasks, results):
        if isinstance(res, Exception):
            errors.append({"source": kind, "board": arg, "error": f"{type(res).__name__}: {res}"[:300]})
        else:
            batches.append((kind, res))
    return batches, errors


def run_fetch(db: Session) -> JobFetchRun:
    run = JobFetchRun()
    db.add(run)
    db.commit()

    batches, errors = asyncio.run(_collect())
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.jobs_fresh_days)
    now = datetime.now(timezone.utc)
    stats: dict[str, dict] = {}
    seen_keys: set[str] = set()

    for kind, postings in batches:
        s = stats.setdefault(kind, {"fetched": 0, "fresh": 0, "kept": 0, "new": 0})
        s["fetched"] += len(postings)
        for p in postings:
            if p.posted_at < cutoff:
                continue
            s["fresh"] += 1
            keep, remote = where(p)
            if not keep or not is_tech(p.title) or not p.apply_url or not p.description:
                continue
            key = dedupe_key(p.company, p.title, p.location)
            if key in seen_keys:
                continue  # same role from two sources in this run
            seen_keys.add(key)
            s["kept"] += 1
            job = db.scalar(select(Job).where(Job.dedupe_key == key))
            if job is None:
                job = Job(dedupe_key=key, first_seen_at=now)
                db.add(job)
                s["new"] += 1
            job.source, job.source_id, job.company, job.title = p.source, p.source_id, p.company, p.title
            job.location, job.remote, job.seniority = p.location, remote, seniority(p.title)
            job.employment_type, job.description, job.apply_url = p.employment_type, p.description, p.apply_url
            job.posted_at, job.last_seen_at, job.raw = p.posted_at, now, p.raw

    run.stats, run.errors, run.finished_at = stats, errors, datetime.now(timezone.utc)
    db.commit()
    log.info("Job fetch done: %s | %d board errors", stats, len(errors))
    return run
