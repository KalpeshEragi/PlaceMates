"""Model calls for the benchmark.

Generation (baseline and the PlaceMates writer) uses the same Groq model, so a difference comes from the
pipeline, not the model. Judging uses a different family (Gemini) so the judge doesn't favour its own
writing; when Gemini's small free quota runs out it falls back to Groq and records that.
"""

import json
import logging
import time

import httpx
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.services.llm import complete_json

log = logging.getLogger(__name__)
GEN_MODEL = settings.model_extract          # openai/gpt-oss-120b on Groq: the PlaceMates writer's model too
GEMINI = "gemini-2.5-flash"
_gemini_off = False


class QuotaExhausted(Exception):
    """A free daily quota ran out: stop and resume the run later."""


def daily_limit(err: Exception) -> bool:
    t = str(err).lower()
    return "tokens per day" in t or "(tpd)" in t or "requests per day" in t


def generate[T: BaseModel](system: str, user: str, schema: type[T]) -> T:
    try:
        return complete_json(GEN_MODEL, system, user, schema)
    except Exception as err:  # noqa: BLE001
        if daily_limit(err):
            raise QuotaExhausted(str(err)[:200]) from err
        raise


def _gemini(system: str, user: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI}:generateContent"
    body = {"systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    for attempt in range(3):
        r = httpx.post(url, params={"key": settings.gemini_api_key}, json=body, timeout=180)
        if r.status_code == 429 and "PerDay" in r.text:
            raise QuotaExhausted("Gemini daily quota")
        if r.status_code in (429, 503) and attempt < 2:
            time.sleep(20)
            continue
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    raise RuntimeError("Gemini kept failing")


def judge[T: BaseModel](system: str, user: str, schema: type[T]) -> tuple[T, str]:
    """-> (answer, judge model used)."""
    global _gemini_off
    schema_note = f"\n\nReturn only JSON matching this schema:\n{json.dumps(schema.model_json_schema())}"
    if settings.gemini_api_key and not _gemini_off:
        try:
            raw = _gemini(system + schema_note, user)
            try:
                return schema.model_validate_json(raw), GEMINI
            except ValidationError:
                fixed = _gemini(system + schema_note, f"{user}\n\nYour previous answer was invalid JSON for the "
                                                      f"schema. Previous answer:\n{raw}")
                return schema.model_validate_json(fixed), GEMINI
        except QuotaExhausted:
            log.warning("Gemini daily quota used up; judging with Groq for the rest of this run")
            _gemini_off = True
    try:
        return complete_json(settings.model_extract, system, user, schema), settings.model_extract
    except Exception as err:  # noqa: BLE001
        if daily_limit(err):
            raise QuotaExhausted(str(err)[:200]) from err
        raise
