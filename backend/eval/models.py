"""Model calls for the benchmark.

Fairness rule: inside one pair, the generic prompt and the whole PlaceMates pipeline run on the SAME model,
so a difference comes from the pipeline. Across pairs the model may change: when a free daily quota runs
out, the next model in the chain takes over and the interrupted pair is redone from scratch on it.

Judging uses a different family from the writer where possible (Qwen), one judge per pair for both resumes.
"""

import logging

from pydantic import BaseModel

from app.services.llm import LLMError, complete_json

log = logging.getLogger(__name__)
GEN_CHAIN = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]     # each has its own free daily quota on Groq
JUDGE_CHAIN = ["qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
JUDGE_MAX_TOKENS = {"qwen/qwen3.8-27b": 900}  # free Qwen allows 1000 output tokens a minute, reservation counts
exhausted: set[str] = set()


class QuotaExhausted(Exception):
    """A model's free daily quota ran out."""

    def __init__(self, model: str, detail: str = ""):
        super().__init__(f"{model}: {detail[:150]}")
        self.model = model


def daily_limit(err: Exception) -> bool:
    t = str(err).lower()
    return "tokens per day" in t or "(tpd)" in t or "requests per day" in t


def first_available(chain: list[str]) -> str | None:
    return next((m for m in chain if m not in exhausted), None)


def call[T: BaseModel](model: str, system: str, user: str, schema: type[T], max_tokens: int | None = None) -> T:
    for attempt in range(2):  # Groq sometimes rejects a long JSON answer once; a second try usually works
        try:
            return complete_json(model, system, user, schema, max_tokens=max_tokens)
        except Exception as err:  # noqa: BLE001
            if daily_limit(err):
                exhausted.add(model)
                raise QuotaExhausted(model, str(err)) from err
            if attempt == 0 and isinstance(err, LLMError):
                log.warning("%s failed (%s); retrying once", model, str(err)[:100])
                continue
            raise
    raise RuntimeError("unreachable")


def judge_call[T: BaseModel](model: str, system: str, user: str, schema: type[T]) -> T:
    return call(model, system, user, schema, max_tokens=JUDGE_MAX_TOKENS.get(model))
