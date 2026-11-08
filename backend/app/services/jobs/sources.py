"""One async fetch function per source. Each returns normalized Postings (no filtering here)."""

import asyncio
import re
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.services.jobs.normalize import Posting, html_to_text

SEARCH_QUERIES = ["software engineer", "software developer", "data analyst", "data scientist",
                  "devops engineer", "frontend developer", "backend developer", "QA engineer",
                  "machine learning engineer", "intern software"]


def _iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def greenhouse(client: httpx.AsyncClient, slug: str) -> list[Posting]:
    r = await client.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", params={"content": "true"})
    r.raise_for_status()
    out = []
    for j in r.json().get("jobs", []):
        out.append(Posting(
            source="greenhouse", source_id=str(j["id"]), company=j.get("company_name") or slug,
            title=j["title"], location=(j.get("location") or {}).get("name") or "",
            description=html_to_text(j.get("content")), apply_url=j["absolute_url"],
            posted_at=_iso(j.get("first_published") or j["updated_at"]),
            raw={k: j.get(k) for k in ("id", "title", "location", "first_published", "updated_at", "departments")},
        ))
    return out


async def lever(client: httpx.AsyncClient, slug: str) -> list[Posting]:
    r = await client.get(f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json"})
    r.raise_for_status()
    out = []
    for j in r.json():
        cats = j.get("categories") or {}
        lists = "\n\n".join(f"{x.get('text', '')}\n{html_to_text(x.get('content'))}" for x in j.get("lists") or [])
        out.append(Posting(
            source="lever", source_id=j["id"], company=slug.capitalize(), title=j["text"],
            location=", ".join(cats.get("allLocations") or [cats.get("location") or ""]),
            description="\n\n".join(filter(None, [j.get("descriptionPlain"), lists, j.get("additionalPlain")])).strip(),
            apply_url=j.get("hostedUrl") or j.get("applyUrl"),
            posted_at=datetime.fromtimestamp(j["createdAt"] / 1000, tz=timezone.utc),
            employment_type=cats.get("commitment"), remote_flag=j.get("workplaceType") == "remote",
            raw={k: j.get(k) for k in ("id", "text", "categories", "createdAt", "workplaceType")},
        ))
    return out


async def ashby(client: httpx.AsyncClient, slug: str) -> list[Posting]:
    r = await client.get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    r.raise_for_status()
    out = []
    for j in r.json().get("jobs", []):
        if j.get("isListed") is False:
            continue
        locs = [j.get("location") or ""] + [s.get("location", "") for s in j.get("secondaryLocations") or []]
        out.append(Posting(
            source="ashby", source_id=j["id"], company=slug.capitalize(), title=j["title"],
            location=", ".join(filter(None, locs)),
            description=j.get("descriptionPlain") or html_to_text(j.get("descriptionHtml")),
            apply_url=j.get("jobUrl") or j.get("applyUrl"), posted_at=_iso(j["publishedAt"]),
            employment_type=j.get("employmentType"), remote_flag=bool(j.get("isRemote")),
            raw={k: j.get(k) for k in ("id", "title", "location", "publishedAt", "isRemote", "workplaceType")},
        ))
    return out


async def adzuna(client: httpx.AsyncClient, query: str) -> list[Posting]:
    """Adzuna India search. Off unless ADZUNA_APP_ID/KEY are set. Written from the public docs; untested.
    Note: Adzuna descriptions are short snippets."""
    r = await client.get("https://api.adzuna.com/v1/api/jobs/in/search/1", params={
        "app_id": settings.adzuna_app_id, "app_key": settings.adzuna_app_key, "what": query,
        "max_days_old": settings.jobs_fresh_days, "results_per_page": 50, "content-type": "application/json"})
    r.raise_for_status()
    return [Posting(
        source="adzuna", source_id=str(j["id"]), company=(j.get("company") or {}).get("display_name") or "Unknown",
        title=j["title"], location=(j.get("location") or {}).get("display_name") or "India",
        description=html_to_text(j.get("description")), apply_url=j["redirect_url"],
        posted_at=_iso(j["created"]), employment_type=j.get("contract_time"), raw={"id": j["id"]},
    ) for j in r.json().get("results", [])]


async def jsearch(client: httpx.AsyncClient, query: str) -> list[Posting]:
    """JSearch (RapidAPI, Google Jobs). Off unless JSEARCH_API_KEY is set. Free tier is small,
    so only a few queries run per day. Written from the public docs; untested."""
    r = await client.get("https://jsearch.p.rapidapi.com/search",
                         params={"query": f"{query} in India", "date_posted": "3days", "num_pages": 1},
                         headers={"X-RapidAPI-Key": settings.jsearch_api_key,
                                  "X-RapidAPI-Host": "jsearch.p.rapidapi.com"})
    r.raise_for_status()
    return [Posting(
        source="jsearch", source_id=j["job_id"], company=j.get("employer_name") or "Unknown",
        title=j["job_title"], location=", ".join(filter(None, [j.get("job_city"), j.get("job_country")])),
        description=j.get("job_description") or "", apply_url=j["job_apply_link"],
        posted_at=_iso(j["job_posted_at_datetime_utc"]), employment_type=j.get("job_employment_type"),
        remote_flag=bool(j.get("job_is_remote")), raw={"job_id": j["job_id"]},
    ) for j in r.json().get("data", []) if j.get("job_posted_at_datetime_utc")]


# ── Apify scrapers (LinkedIn + Naukri) ────────────────────────────────
# valig's actors, chosen 2026-11-09: ~$0.40 per 1,000 results on the free plan, full LinkedIn
# descriptions, Naukri experience ranges. Usage of each run is collected for the budget guard.

APIFY_LINKEDIN = "valig~linkedin-jobs-scraper"
APIFY_NAUKRI = "valig~naukri-jobs-scraper"
LINKEDIN_QUERIES = ["software engineer", "software developer", "frontend developer", "backend developer",
                    "full stack developer", "data analyst", "machine learning engineer", "devops engineer"]
NAUKRI_QUERIES = ["software developer", "software engineer fresher", "data analyst", "web developer"]
LINKEDIN_PER_QUERY = 30
NAUKRI_PER_QUERY = 25
# Skipped by the scraper itself, so we never pay for roles PlaceMates' users can't apply to.
SENIOR_TITLES = ["senior", "sr", "lead", "staff", "principal", "manager", "director", "head", "architect", "iii"]
APIFY_USAGE: list[float] = []  # USD per run in the current fetch (reset by the fetcher)
# The free plan allows 5 actor runs at once; stay below it.
APIFY_CONCURRENCY = 4
_apify_slots: asyncio.Semaphore | None = None


def reset_apify(concurrency: int = APIFY_CONCURRENCY) -> None:
    """Call at the start of each fetch (inside its event loop)."""
    global _apify_slots
    _apify_slots = asyncio.Semaphore(concurrency)
    APIFY_USAGE.clear()

LINKEDIN_LEVEL = {"Internship": "intern", "Entry level": "entry", "Associate": "entry",
                  "Mid-Senior level": "mid", "Director": "senior", "Executive": "senior"}


async def _run_actor(client: httpx.AsyncClient, actor: str, payload: dict) -> list[dict]:
    async with _apify_slots or asyncio.Semaphore(1):
        return await _run_actor_now(client, actor, payload)


async def _run_actor_now(client: httpx.AsyncClient, actor: str, payload: dict) -> list[dict]:
    headers = {"Authorization": f"Bearer {settings.apify_api_key}"}
    r = await client.post(f"https://api.apify.com/v2/acts/{actor}/runs", headers=headers, json=payload,
                          params={"waitForFinish": 240}, timeout=300)
    r.raise_for_status()
    run = r.json()["data"]
    APIFY_USAGE.append(float(run.get("usageTotalUsd") or 0))
    if run["status"] != "SUCCEEDED":
        raise RuntimeError(f"Apify run {run['id']} ended {run['status']}")
    items = await client.get(f"https://api.apify.com/v2/datasets/{run['defaultDatasetId']}/items",
                             headers=headers, timeout=60)
    items.raise_for_status()
    return items.json()


async def apify_linkedin(client: httpx.AsyncClient, query: str) -> list[Posting]:
    items = await _run_actor(client, APIFY_LINKEDIN, {
        "keywords": query, "location": "India", "datePosted": "r86400",  # last 24 hours
        "limit": LINKEDIN_PER_QUERY, "titleExclude": SENIOR_TITLES})
    return [Posting(
        source="linkedin", source_id=str(j["id"]), company=j.get("companyName") or "Unknown",
        title=j["title"], location=j.get("location") or "",
        description=j.get("description") or html_to_text(j.get("descriptionHtml")),
        apply_url=j.get("applyUrl") or j["url"], posted_at=_iso(j["postedDate"]),
        employment_type=j.get("contractType"), seniority_hint=LINKEDIN_LEVEL.get(j.get("experienceLevel")),
        raw={k: j.get(k) for k in ("id", "url", "experienceLevel", "postedDate", "applicationsCount", "workType")},
    ) for j in items if j.get("title") and j.get("postedDate")]


def _naukri_level(exp: dict | None, title: str) -> str | None:
    try:
        low = int((exp or {}).get("minimum"))
    except (TypeError, ValueError):
        return None
    if re.search(r"\bintern", title, re.I):
        return "intern"
    return "entry" if low <= 1 else "mid" if low <= 4 else "senior"


async def apify_naukri(client: httpx.AsyncClient, query: str) -> list[Posting]:
    items = await _run_actor(client, APIFY_NAUKRI, {
        "keywords": query, "jobAge": "1", "experience": 1, "sort": "f", "limit": NAUKRI_PER_QUERY})
    out = []
    for j in items:
        if not (j.get("title") and j.get("createdDate")):
            continue
        skills = j.get("skills") or {}
        skill_list = [*(skills.get("preferred") or []), *(skills.get("other") or [])]
        desc = j.get("description")
        description = html_to_text(desc.get("full") or desc.get("short") if isinstance(desc, dict) else desc)
        if skill_list:  # Naukri descriptions can be short; skills help matching later
            description += "\n\nSkills: " + ", ".join(skill_list)
        out.append(Posting(
            source="naukri", source_id=str(j["id"]), company=(j.get("company") or {}).get("name") or "Unknown",
            title=j["title"], location=", ".join(l.get("label", "") for l in j.get("locations") or []) or "India",
            description=description, apply_url=j["url"],
            posted_at=datetime.fromtimestamp(j["createdDate"] / 1000, tz=timezone.utc),
            employment_type=j.get("employmentType"), seniority_hint=_naukri_level(j.get("experience"), j["title"]),
            raw={k: j.get(k) for k in ("id", "url", "experience", "createdDateText", "roleCategory")},
        ))
    return out
