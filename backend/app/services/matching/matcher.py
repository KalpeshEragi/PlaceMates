"""Daily shortlist: filter by preferences, rank by meaning + skills + role, keep the top 5.

    pool       jobs posted in the last POOL_DAYS days that this student was never shown
    filter     experience level, job type, location           (hard rules from preferences)
    rank       0.55 semantic + 0.25 skills + 0.12 role + 0.05 level + 0.03 recency
    diversify  at most 2 jobs per company
    save       JobMatch rows with plain-language reasons; same day = same shortlist

Semantic similarity comes from pgvector (cosine distance in Postgres).
"""

import re
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Job, JobMatch, JobPreferences, Profile
from app.services.matching.embeddings import embed_missing_jobs, profile_embedding

POOL_DAYS = 14
TOP_K = 5
PER_COMPANY = 2
WEIGHTS = {"semantic": 0.55, "skills": 0.25, "role": 0.12, "level": 0.05, "recency": 0.03}

# Which posting levels suit each preferred level. "unknown" is allowed: many good fresher posts
# don't state a level.
LEVELS = {"intern": {"intern"}, "entry": {"entry", "unknown"}, "mid": {"mid", "entry", "unknown"}}
CITY_ALIASES = {"bangalore": "bengaluru", "gurgaon": "gurugram", "bombay": "mumbai", "madras": "chennai",
                "new delhi": "delhi", "trivandrum": "thiruvananthapuram"}
STOP = {"developer", "engineer", "engineering", "software", "intern", "junior", "senior", "the", "and", "role"}


def _city(text: str) -> str:
    t = text.lower().strip()
    return CITY_ALIASES.get(t, t)


def _is_internship(job: Job) -> bool:
    return job.seniority == "intern" or "intern" in (job.employment_type or "").lower() \
        or bool(re.search(r"\bintern(ship)?\b", job.title, re.I))


# "5+ years", "3-5 yrs", "minimum 4 years of experience" -> the lowest number of years asked for.
YEARS = re.compile(r"(?<![\d.])(\d{1,2})\s*(?:\+|[-–—]\s*\d{1,2}|to\s*\d{1,2})?\s*(?:\+\s*)?(?:years?|yrs?)\b", re.I)
MAX_YEARS = {"intern": 0, "entry": 2, "mid": 5}


def years_required(job: Job) -> int | None:
    """Smallest 'N years' mentioned near experience wording, in the title or description.
    The whole description: requirements often come after a long company intro."""
    text = f"{job.title}\n{job.description}"
    found = []
    for m in YEARS.finditer(text):
        window = text[max(0, m.start() - 60): m.end() + 60].lower()
        if "experience" in window or "exp" in window or m.start() < len(job.title):
            found.append(int(m.group(1)))
    return min(found) if found else None


def passes(job: Job, prefs: JobPreferences) -> bool:
    """Hard filters: wrong level, wrong job type or wrong place never reach the student."""
    years = years_required(job)
    if years is not None and years > MAX_YEARS.get(prefs.experience_level, 2):
        return False
    if job.seniority not in LEVELS.get(prefs.experience_level, LEVELS["entry"]) | (
            {"intern"} if "internship" in prefs.job_types else set()):
        return False
    kind = "internship" if _is_internship(job) else "full_time"
    if kind not in prefs.job_types:
        return False
    if job.remote:
        return prefs.remote_ok
    if not prefs.locations:
        return True  # anywhere in India
    loc = _city(job.location or "")
    return any(_city(c) in loc for c in prefs.locations) or any(
        alias in loc for c in prefs.locations for alias, canon in CITY_ALIASES.items() if canon == _city(c))


def profile_skills(profile: Profile) -> list[str]:
    names = {s.name for s in profile.skills}
    for item in profile.items:
        for f in item.facts:
            if f.field == "tech" or f.field.endswith(".tech") or f.field.startswith("tech_usage"):
                names |= set(f.value if isinstance(f.value, list) else [str(f.value)])
    return sorted(n for n in names if 1 < len(n) <= 30)


def _mentions(text: str, skill: str) -> bool:
    return re.search(rf"(?<![\w.+#]){re.escape(skill.lower())}(?![\w+#])", text) is not None


def _role_words(roles: list[str]) -> set[str]:
    return {w for r in roles for w in re.findall(r"[a-z]+", r.lower()) if w not in STOP and len(w) > 2}


def _score(job: Job, similarity: float, skills: list[str], roles: list[str], prefs: JobPreferences,
           now: datetime) -> tuple[float, list[str]]:
    text = f"{job.title}\n{job.description}".lower()
    matched = [s for s in skills if _mentions(text, s)]
    semantic = min(max((similarity - 0.45) / 0.35, 0.0), 1.0)  # bge cosine ~0.45 (unrelated) .. 0.80 (very close)
    skill_part = min(len(matched) / 5, 1.0)
    words = _role_words(roles)
    role_part = 1.0 if words and words & set(re.findall(r"[a-z]+", job.title.lower())) else 0.0
    level_part = 1.0 if job.seniority == prefs.experience_level or (
        job.seniority == "intern" and "internship" in prefs.job_types) else 0.5
    age_days = max((now - job.posted_at).total_seconds() / 86400, 0)
    recency = max(1 - age_days / POOL_DAYS, 0)
    score = (WEIGHTS["semantic"] * semantic + WEIGHTS["skills"] * skill_part + WEIGHTS["role"] * role_part
             + WEIGHTS["level"] * level_part + WEIGHTS["recency"] * recency)

    reasons = []
    if similarity >= 0.62:
        reasons.append("Closely matches your projects and experience")
    elif similarity >= 0.55:
        reasons.append("Related to what you've worked on")
    if matched:
        reasons.append("Mentions your skills: " + ", ".join(matched[:5]))
    if role_part:
        reasons.append("Fits a role you're targeting")
    reasons.append("Remote" if job.remote else (job.location or "India"))
    reasons.append("Posted today" if age_days < 1 else f"Posted {int(age_days)} day{'s' if age_days >= 2 else ''} ago")
    return round(score, 4), reasons


def _near_duplicate(a: Job, b: Job) -> bool:
    """Same title and almost the same text (cosine > 0.97 on their embeddings)."""
    if re.sub(r"\W+", " ", a.title.lower()).strip() != re.sub(r"\W+", " ", b.title.lower()).strip():
        return False
    va, vb = list(a.embedding), list(b.embedding)
    return sum(x * y for x, y in zip(va, vb)) > 0.97


def todays_shortlist(db: Session, profile: Profile, prefs: JobPreferences,
                     today: date | None = None, k: int = TOP_K) -> list[JobMatch]:
    """Today's top picks. Calling again on the same day returns the same shortlist."""
    day = (today or date.today()).isoformat()
    existing = list(db.scalars(select(JobMatch).where(JobMatch.profile_id == profile.id, JobMatch.batch_date == day)
                               .order_by(JobMatch.rank)))
    if existing:
        return existing

    embed_missing_jobs(db)
    vec = profile_embedding(db, profile)
    now = datetime.now(timezone.utc)
    shown = select(JobMatch.job_id).where(JobMatch.profile_id == profile.id)
    similarity = (1 - Job.embedding.cosine_distance(vec)).label("similarity")
    rows = db.execute(
        select(Job, similarity)
        .where(Job.embedding.is_not(None), Job.posted_at >= now - timedelta(days=POOL_DAYS), Job.id.not_in(shown))
        .order_by(Job.embedding.cosine_distance(vec))
        .limit(300)  # nearest by meaning first; filters and the full score run on these
    ).all()

    skills = profile_skills(profile)
    scored = sorted(((*_score(job, float(sim), skills, prefs.target_roles, prefs, now), job)
                     for job, sim in rows if passes(job, prefs)), key=lambda x: -x[0])

    picks, per_company, picked_jobs = [], {}, []
    for score, reasons, job in scored:
        company = job.company.strip().lower()
        if per_company.get(company, 0) >= PER_COMPANY:
            continue
        if any(_near_duplicate(job, other) for other in picked_jobs):
            continue  # the same posting re-listed by another company or source
        picked_jobs.append(job)
        per_company[company] = per_company.get(company, 0) + 1
        picks.append(JobMatch(profile_id=profile.id, job_id=job.id, batch_date=day, rank=len(picks) + 1,
                              score=score, reasons=reasons))
        if len(picks) == k:
            break
    db.add_all(picks)
    db.commit()
    return picks
