"""Benchmark pairs: one student profile + one real job posting.

Profiles come from the database (students who agreed to be used); jobs are real postings from the fetcher,
chosen by meaning-similarity to the profile and spread across companies. The 23 corpus resumes are NOT used:
the pipeline learned its example bullets from them, so testing on them would inflate results.
"""

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Job, Profile
from app.services.matching.embeddings import profile_embedding
from app.services.matching.matcher import years_required
from app.services.resume.service import profile_inputs


SENIOR = re.compile(r"\b(lead|senior|sr|staff|principal|manager|head|director|architect)\b", re.I)


def resume_text(profile: Profile, items: dict[str, dict], education: list[dict], skills: list[str]) -> str:
    """The student's resume as plain text: what someone would paste into a chat. Contains every saved fact,
    so both systems get exactly the same information."""
    lines = [profile.full_name or "", " | ".join(x for x in (profile.email, profile.location) if x), ""]
    if profile.headline:
        lines += [profile.headline, ""]
    if education:
        lines.append("EDUCATION")
        for e in education:
            lines.append(" | ".join(x for x in (e.get("title"), e.get("organization"), e.get("dates")) if x))
            lines += [f"- {f['value']}" for f in e["facts"]]
        lines.append("")
    lines += ["SKILLS", ", ".join(skills), ""]
    for kind, label in (("experience", "EXPERIENCE"), ("research", "RESEARCH"), ("project", "PROJECTS"),
                        ("award", "ACHIEVEMENTS"), ("certification", "CERTIFICATIONS"), ("other", "OTHER")):
        group = [i for i in items.values() if i["kind"] == kind]
        if not group:
            continue
        lines.append(label)
        for it in group:
            lines.append(" | ".join(x for x in (it.get("title"), it.get("organization"), it.get("dates")) if x))
            for f in it["facts"]:
                value = ", ".join(map(str, f["value"])) if isinstance(f["value"], list) else str(f["value"])
                field = f["field"].split(".")[-1].replace("_", " ")
                lines.append(f"- {value}" if f["field"] in ("bullet", "detail") else f"- {field}: {value}")
        lines.append("")
    return "\n".join(lines).strip()


def build(db: Session, per_profile: dict[str, int]) -> list[dict]:
    """per_profile: profile full name -> number of jobs. Returns pairs with everything both systems need."""
    pairs = []
    for name, n in per_profile.items():
        profile = db.scalar(select(Profile).where(Profile.full_name == name))
        if not profile:
            raise SystemExit(f"No profile named {name!r}")
        items, skills, education = profile_inputs(profile)
        vec = profile_embedding(db, profile)
        jobs = db.scalars(select(Job).where(Job.embedding.is_not(None))
                          .order_by(Job.embedding.cosine_distance(vec)).limit(60)).all()
        picked, companies = [], set()
        for j in jobs:
            if len(j.description) < 800 or j.company.lower() in companies:
                continue  # real requirements need a real description; one job per company
            if SENIOR.search(j.title) or (years_required(j) or 0) > 2:
                continue  # fresher jobs only, as in the product
            picked.append(j)
            companies.add(j.company.lower())
            if len(picked) == n:
                break
        for j in picked:
            pairs.append({
                "id": f"{name.split()[0].lower()}-{str(j.id)[:8]}",
                "student": name,
                "job": {"title": j.title, "company": j.company, "description": j.description},
                "items": items, "skills": skills, "education": education,
                "resume_text": resume_text(profile, items, education, skills),
            })
    return pairs
