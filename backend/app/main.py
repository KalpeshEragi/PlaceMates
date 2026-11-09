import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from app import models  # noqa: F401  (registers tables)
from app.config import settings
from app.db import Base, engine
from app.routers import auth, enrich, jobs, matches, profile
from app.services.jobs.schedule import start_daily_fetch


# Show our own logs (model calls, token use, rate-limit waits) next to uvicorn's.
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
for noisy in ("httpx", "httpcore"):
    logging.getLogger(noisy).setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Creates missing tables. Replace with Alembic migrations once the schema settles.
    with engine.begin() as conn:  # pgvector must exist before tables with vector columns
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    with engine.begin() as conn:  # work that was running when the server stopped will never finish: release it
        conn.execute(text("UPDATE tailored_resumes SET status = 'failed', error = 'Interrupted by a server restart' "
                          "WHERE status = 'running'"))
        conn.execute(text("UPDATE daily_digests SET status = 'failed', error = 'Interrupted by a server restart' "
                          "WHERE status = 'running'"))
    if settings.jobs_daily_fetch:
        start_daily_fetch()
    yield


app = FastAPI(title="PlaceMates API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Only holds the OAuth state during the Google redirect.
app.add_middleware(SessionMiddleware, secret_key=settings.session_secret)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(enrich.router)
app.include_router(jobs.router)
app.include_router(matches.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
