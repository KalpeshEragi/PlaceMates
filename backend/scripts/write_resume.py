"""Write one tailored resume (GitHub Actions runs this when a student clicks "Write tailored resume").

Usage: python -m scripts.write_resume --match-id <uuid>
"""

import argparse
import logging
import uuid

from app.db import SessionLocal
from app.models import JobMatch, Profile
from app.services.resume.service import generate


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--match-id", required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    with SessionLocal() as db:
        match = db.get(JobMatch, uuid.UUID(args.match_id))
        if not match:
            raise SystemExit(f"No match {args.match_id}")
        row = generate(db, db.get(Profile, match.profile_id), match)
        print("resume:", row.status, row.score, row.error or "")
        if row.status == "failed":
            raise SystemExit(1)


if __name__ == "__main__":
    main()
