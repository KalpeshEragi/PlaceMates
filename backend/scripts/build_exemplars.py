"""Rebuild the exemplar_bullets table from the local resume corpus (corpus/metadata.json + corpus/text).

Usage: python -m scripts.build_exemplars [path/to/corpus]
The corpus itself is never committed (it contains real people's resumes).
"""

import json
import sys
from pathlib import Path

from sqlalchemy import delete, text

from app.db import Base, SessionLocal, engine
from app.models import ExemplarBullet
from app.services.matching.embeddings import embed
from app.services.matching.exemplars import bullet_parts, bullet_quality, split_bullets

DEFAULT_CORPUS = Path(__file__).resolve().parents[2] / "corpus"


def resume_weight(entry: dict) -> float:
    """Trust less: suspicious or AI-looking resumes, and unverified outcomes."""
    w = 1.0
    if entry.get("review_flag") == "suspicious":
        w *= 0.6
    ai = (entry.get("ai_writing_check") or {}).get("level")
    w *= {"high": 0.7, "medium": 0.9}.get(ai, 1.0)
    if entry.get("confidence") == "medium":
        w *= 0.95
    return w


def main(corpus: Path) -> None:
    meta = json.loads((corpus / "metadata.json").read_text(encoding="utf-8"))
    rows, seen = [], set()
    for entry in meta["resumes"]:
        if not entry.get("transcript"):
            continue
        weight = resume_weight(entry)
        transcript = (corpus / entry["transcript"]).read_text(encoding="utf-8")
        for section, heading, bullet in split_bullets(transcript):
            key = bullet.lower()
            if key in seen:
                continue
            seen.add(key)
            parts = bullet_parts(bullet)
            rows.append(dict(text=bullet, section=section, role=entry.get("role") or "Software Engineer",
                             level=entry.get("level") or "unknown", source_file=entry["file"], heading=heading,
                             quality=bullet_quality(parts, weight), parts=parts))

    vectors = embed([r["text"] for r in rows])
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.execute(delete(ExemplarBullet))
        db.add_all(ExemplarBullet(**r, embedding=v) for r, v in zip(rows, vectors))
        db.commit()

    strong = sum(r["quality"] >= 0.6 for r in rows)
    print(f"{len(rows)} bullets from {len(meta['resumes'])} resumes | strong (quality >= 0.6): {strong}")
    print("by section:", {s: sum(r["section"] == s for r in rows) for s in ("experience", "project")})


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CORPUS)
