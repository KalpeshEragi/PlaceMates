"""Model calls for the benchmark.

Generation (baseline and the PlaceMates writer) uses the same model, gpt-oss-120b on Groq, so a difference
comes from the pipeline, not the model. Judging uses ONE fixed model from a different family (Qwen 3.8 27B on
Groq, with its own free quota) for every pair, so the judge doesn't favour its own writing and pairs stay
comparable. (Gemini was tried first: its 20-requests-a-day free quota ran out mid-run.)
"""

import logging

from pydantic import BaseModel

from app.config import settings
from app.services.llm import LLMError, complete_json

log = logging.getLogger(__name__)
GEN_MODEL = settings.model_extract   # openai/gpt-oss-120b: the PlaceMates writer's model too
JUDGE_MODEL = "qwen/qwen3.8-27b"


class QuotaExhausted(Exception):
    """A free daily quota ran out: stop and resume the run later."""


def daily_limit(err: Exception) -> bool:
    t = str(err).lower()
    return "tokens per day" in t or "(tpd)" in t or "requests per day" in t


def _call[T: BaseModel](model: str, system: str, user: str, schema: type[T]) -> T:
    for attempt in range(2):  # Groq sometimes rejects a long JSON answer once; a second try usually works
        try:
            return complete_json(model, system, user, schema)
        except Exception as err:  # noqa: BLE001
            if daily_limit(err):
                raise QuotaExhausted(str(err)[:200]) from err
            if attempt == 0 and isinstance(err, LLMError):
                log.warning("%s failed (%s); retrying once", model, str(err)[:100])
                continue
            raise
    raise RuntimeError("unreachable")


def generate[T: BaseModel](system: str, user: str, schema: type[T]) -> T:
    return _call(GEN_MODEL, system, user, schema)


def judge[T: BaseModel](system: str, user: str, schema: type[T]) -> tuple[T, str]:
    """-> (answer, judge model)."""
    return _call(JUDGE_MODEL, system, user, schema), JUDGE_MODEL
