"""Run the job fetcher once and print a summary.

Usage: python -m scripts.fetch_jobs
"""

import logging

from app.db import Base, SessionLocal, engine
from app.services.jobs.fetcher import run_fetch


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        run = run_fetch(db)
        total_new = sum(s["new"] for s in run.stats.values())
        total_kept = sum(s["kept"] for s in run.stats.values())
        print(f"kept {total_kept} fresh India/remote tech jobs ({total_new} new)")
        for source, s in run.stats.items():
            print(f"  {source:10} fetched {s['fetched']:5}  fresh {s['fresh']:4}  kept {s['kept']:4}  new {s['new']:4}")
        for e in run.errors or []:
            print(f"  ! {e['source']}/{e['board']}: {e['error']}")


if __name__ == "__main__":
    main()
