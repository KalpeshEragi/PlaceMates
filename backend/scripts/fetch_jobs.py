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
        counts = {k: v for k, v in run.stats.items() if isinstance(v, dict) and "fetched" in v}
        total_new = sum(s["new"] for s in counts.values())
        total_kept = sum(s["kept"] for s in counts.values())
        print(f"kept {total_kept} fresh India/remote tech jobs ({total_new} new)")
        for source, s in counts.items():
            print(f"  {source:10} fetched {s['fetched']:5}  fresh {s['fresh']:4}  kept {s['kept']:4}  new {s['new']:4}")
        if run.stats.get("dropped_not_genuine"):
            print("  dropped as not genuine:", run.stats["dropped_not_genuine"])
        if "apify_cost_usd" in run.stats:
            print(f"  apify cost this run: ${run.stats['apify_cost_usd']}")
        for e in run.errors or []:
            print(f"  ! {e['source']}/{e['board']}: {e['error']}")


if __name__ == "__main__":
    main()
