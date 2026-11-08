import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app import models  # noqa: F401  (registers tables)
from app.config import settings
from app.db import Base, engine
from app.routers import auth, enrich, profile


# Show our own logs (model calls, token use, rate-limit waits) next to uvicorn's.
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
for noisy in ("httpx", "httpcore"):
    logging.getLogger(noisy).setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Creates missing tables. Replace with Alembic migrations once the schema settles.
    Base.metadata.create_all(engine)
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


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
