"""What the market is asking for right now, from the jobs PlaceMates fetched (mostly India).

Counts which technologies appear in recent postings for a role family. This is live data,
unlike the knowledge base, so the strategy agent can see e.g. "Docker appears in 41% of
recent backend postings".
"""

from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.intelligence.kb import role_family
from app.models import Job
from app.services.matching.exemplars import TECH

ALIASES = {"javascript": "javascript", "react.js": "react", "node.js": "node", "node": "node", "golang": "go",
           "postgresql": "postgres", "postgres": "postgres", "restful": "rest", "sklearn": "scikit-learn",
           "vue.js": "vue", "spring boot": "spring"}


def _canon(term: str) -> str:
    t = term.lower()
    return ALIASES.get(t, t)


def signals(db: Session, family: str, days: int = 30, top: int = 15) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    jobs = db.scalars(select(Job).where(Job.posted_at >= since)).all()
    same = [j for j in jobs if role_family(j.title) == family]
    counts = Counter()
    for j in same:
        counts.update({_canon(t) for t in TECH.findall(f"{j.title} {j.description}")})
    n = len(same)
    return {"role_family": family, "postings": n, "days": days,
            "top_skills": [{"skill": s, "share": round(c / n, 2)} for s, c in counts.most_common(top)] if n else []}


def render(sig: dict) -> str:
    if not sig["postings"]:
        return "(no recent postings for this role family)"
    skills = ", ".join(f"{s['skill']} {round(s['share'] * 100)}%" for s in sig["top_skills"])
    return (f"{sig['postings']} {sig['role_family']} postings in the last {sig['days']} days "
            f"(share of postings mentioning each): {skills}")
