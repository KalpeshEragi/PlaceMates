"""Local text embeddings (BAAI/bge-small-en-v1.5 via fastembed: small ONNX model, no GPU, no API cost).

Profiles are embedded as search queries and jobs as documents, which is how bge models are
meant to be used for retrieval. Vectors are normalized, so cosine similarity = dot product.
"""

import hashlib
import logging
from functools import lru_cache
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.snapshot import profile_snapshot
from app.models import Job, Profile, ProfileEmbedding

log = logging.getLogger(__name__)
MODEL = "BAAI/bge-small-en-v1.5"
CACHE_DIR = Path(__file__).resolve().parents[3] / ".models"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
MAX_CHARS = 2000  # the model reads ~512 tokens; the start of a posting carries the role


@lru_cache
def _model():
    from fastembed import TextEmbedding  # heavy import: only when first needed
    return TextEmbedding(MODEL, cache_dir=str(CACHE_DIR))


def embed(texts: list[str]) -> list[list[float]]:
    return [v.tolist() for v in _model().embed(texts, batch_size=32)]


def job_text(job: Job) -> str:
    return f"{job.title} at {job.company}\n{job.description}"[:MAX_CHARS]


def embed_missing_jobs(db: Session) -> int:
    """Embed every job that has no vector yet. Returns how many were embedded."""
    jobs = list(db.scalars(select(Job).where(Job.embedding.is_(None))))
    for i in range(0, len(jobs), 64):
        chunk = jobs[i:i + 64]
        for job, vec in zip(chunk, embed([job_text(j) for j in chunk])):
            job.embedding = vec
        db.commit()
    if jobs:
        log.info("Embedded %d jobs", len(jobs))
    return len(jobs)


def profile_text(profile: Profile) -> str:
    """What the student offers, as one passage: headline, skills, then each item with its facts."""
    snap = profile_snapshot(profile)
    parts = [snap["headline"] or "", "Skills: " + ", ".join(snap["skills"])]
    for item in snap["items"]:
        facts = "; ".join(
            ", ".join(map(str, f["value"])) if isinstance(f["value"], list) else str(f["value"])
            for f in item["facts"])
        parts.append(f"{item['kind']}: {item['title']} {item['organization'] or ''}. {facts}")
    return "\n".join(p for p in parts if p.strip())[:MAX_CHARS]


def profile_embedding(db: Session, profile: Profile) -> list[float]:
    """Cached; recomputed only when the profile text changes."""
    text = profile_text(profile)
    digest = hashlib.sha256(text.encode()).hexdigest()
    row = db.scalar(select(ProfileEmbedding).where(ProfileEmbedding.profile_id == profile.id))
    if row and row.text_hash == digest:
        return list(row.embedding)
    vec = embed([QUERY_PREFIX + text])[0]
    if not row:
        row = ProfileEmbedding(profile_id=profile.id)
        db.add(row)
    row.text_hash, row.embedding = digest, vec
    db.commit()
    return vec
