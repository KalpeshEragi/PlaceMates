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
APIFY_PRICE_PER_RESULT = 0.0004  # valig actors, free plan (checked 2026-11-09)
APIFY_PRICE_PER_RUN = 0.001


def apify_plan(errors: list[dict]) -> list[tuple[str, str, object]]:
    """Apify searches to run today, trimmed so this month's spend stays under the budget."""
    if not settings.apify_api_key:
        return []
    try:
        r = httpx.get("https://api.apify.com/v2/users/me/limits", timeout=20,
                      headers={"Authorization": f"Bearer {settings.apify_api_key}"})
        r.raise_for_status()
        used = float(r.json()["data"]["current"].get("monthlyUsageUsd") or 0)
    except Exception as err:  # noqa: BLE001 - can't see spend: don't risk spending
        errors.append({"source": "apify", "board": "budget", "error": f"Could not read usage: {err}"[:300]})
        return []
    plan = [("linkedin", q, sources.apify_linkedin, sources.LINKEDIN_PER_QUERY) for q in sources.LINKEDIN_QUERIES]
    plan += [("naukri", q, sources.apify_naukri, sources.NAUKRI_PER_QUERY) for q in sources.NAUKRI_QUERIES]
    left = settings.apify_monthly_budget_usd - used
    while plan and sum(n * APIFY_PRICE_PER_RESULT + APIFY_PRICE_PER_RUN for *_, n in plan) > left:
        plan.pop()  # drop the least important searches first
    if len(plan) < len(sources.LINKEDIN_QUERIES) + len(sources.NAUKRI_QUERIES):
        errors.append({"source": "apify", "board": "budget",
                       "error": f"Ran {len(plan)} searches: ${used:.2f} of ${settings.apify_monthly_budget_usd} used this month"})
    return [(kind, q, fn) for kind, q, fn, _ in plan]


async def _collect() -> tuple[list[tuple[str, list[Posting]]], list[dict]]:
    tasks: list[tuple[str, str, object]] = []
    errors: list[dict] = []
    sources.reset_apify()
    tasks += apify_plan(errors)
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

    batches = []
    for (kind, arg, _), res in zip(tasks, results):
        if isinstance(res, BaseException):
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
            job.location, job.remote = p.location, remote
            job.seniority = p.seniority_hint or seniority(p.title)
            job.employment_type, job.description, job.apply_url = p.employment_type, p.description, p.apply_url
            job.posted_at, job.last_seen_at, job.raw = p.posted_at, now, p.raw

    if sources.APIFY_USAGE:
        stats["apify_cost_usd"] = round(sum(sources.APIFY_USAGE), 4)
    run.stats, run.errors, run.finished_at = stats, errors, datetime.now(timezone.utc)
    db.commit()
    log.info("Job fetch done: %s | %d board errors", stats, len(errors))
    return run
