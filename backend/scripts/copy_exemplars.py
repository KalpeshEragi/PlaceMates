"""Copy the example bullets (built from the private resume corpus) into another database, e.g. production.

The corpus itself never leaves this machine; only the scored bullets and their embeddings are copied.

Usage: python -m scripts.copy_exemplars "postgresql://user:pass@host/db?sslmode=require"
"""

import sys

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from app.config import normalize_db_url
from app.db import Base, SessionLocal
from app.models import ExemplarBullet

COLUMNS = [c.name for c in ExemplarBullet.__table__.columns]


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    target = create_engine(normalize_db_url(sys.argv[1]), pool_pre_ping=True)
    with target.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(target)

    with SessionLocal() as src:
        rows = [{c: getattr(b, c) for c in COLUMNS} for b in src.scalars(select(ExemplarBullet))]
    with Session(target) as dst:
        existing = set(dst.scalars(select(ExemplarBullet.text)))
        new = [ExemplarBullet(**r) for r in rows if r["text"] not in existing]
        dst.add_all(new)
        dst.commit()
    print(f"copied {len(new)} bullets ({len(rows) - len(new)} were already there)")


if __name__ == "__main__":
    main()
