"""The morning job, runnable anywhere (GitHub Actions in production): fetch jobs, then each student's
shortlist, top resumes and email.

Usage:
    python -m scripts.daily                          # fetch, then every student
    python -m scripts.daily --profile-id <uuid> --force --skip-fetch   # one student's digest now
"""

import argparse
import logging
import uuid

from app.db import Base, SessionLocal, engine
from app.models import Profile
from app.services import daily
from app.services.jobs.fetcher import run_fetch


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile-id", help="Only this student's digest")
    parser.add_argument("--force", action="store_true", help="Send even if today's digest already went out")
    parser.add_argument("--skip-fetch", action="store_true", help="Use the jobs already in the database")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    for noisy in ("httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    Base.metadata.create_all(engine)

    if not args.skip_fetch:
        with SessionLocal() as db:
            run = run_fetch(db)
            print("fetch:", {k: v for k, v in run.stats.items() if not isinstance(v, dict)})

    if args.profile_id:
        with SessionLocal() as db:
            profile = db.get(Profile, uuid.UUID(args.profile_id))
            if not profile:
                raise SystemExit(f"No profile {args.profile_id}")
            d = daily.run_for_profile(db, profile, force=args.force)
            print("digest:", d.status, d.stats, d.error or "")
            if d.status == "failed":
                raise SystemExit(1)
    else:
        daily.run_for_all()


if __name__ == "__main__":
    main()
