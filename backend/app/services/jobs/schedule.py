"""Once a day inside the API process (when JOBS_DAILY_FETCH=true): fetch jobs, then send daily digests.

Deliberately simple: one daemon thread that sleeps until the next run time (IST).
Fine for a single API process; with several workers, use an external cron instead
(e.g. `python -m scripts.fetch_jobs` from cron or a scheduled cloud job).
"""

import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from app.config import settings

log = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))


def _seconds_until_next(hour: int) -> float:
    now = datetime.now(IST)
    nxt = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return (nxt - now).total_seconds()


def start_daily_fetch() -> None:
    from app.routers.jobs import fetch_in_background  # avoid an import cycle
    from app.services.daily import run_for_all

    def loop():
        while True:
            wait = _seconds_until_next(settings.jobs_daily_fetch_hour_ist)
            log.info("Next job fetch in %.1f hours", wait / 3600)
            time.sleep(wait)
            # Fetch fresh jobs, then each student's shortlist, resumes and email.
            if not fetch_in_background(then=run_for_all):
                log.warning("Skipped daily job fetch: one is already running")

    threading.Thread(target=loop, daemon=True, name="job-fetch-schedule").start()
