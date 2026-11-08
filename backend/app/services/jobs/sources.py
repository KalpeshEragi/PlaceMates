"""One async fetch function per source. Each returns normalized Postings (no filtering here)."""

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
