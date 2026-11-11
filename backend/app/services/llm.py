"""Cheap-model calls (Groq). Gemini is reserved for resume drafting."""

import json
import logging
import re
import time

import httpx
from pydantic import BaseModel, ValidationError

from app.config import settings


log = logging.getLogger(__name__)


class LLMError(Exception):
    pass


def _chat(model: str, messages: list[dict], reasoning_effort: str | None, max_tokens: int | None = None) -> str:
    if not settings.groq_api_key:
        raise LLMError("GROQ_API_KEY is not set")
    body: dict = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        **({"max_tokens": max_tokens} if max_tokens else {}),
        "response_format": {"type": "json_object"},
    }
    if reasoning_effort:
        body["reasoning_effort"] = reasoning_effort

    attempts = 5
    for attempt in range(attempts):
        resp = httpx.post(
            f"{settings.groq_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json=body,
            timeout=90,
        )
        if resp.status_code == 429 and attempt < attempts - 1:
            # Rate limited: use Groq's "try again in Xs/Xms" hint, else the retry-after header.
            hint = re.search(r"try again in ([\d.]+)(ms|s)", resp.text)
            wait = (float(hint.group(1)) / (1000 if hint.group(2) == "ms" else 1) + 0.5) if hint \
                else float(resp.headers.get("retry-after", "5"))
            wait = min(wait, 30)
            log.warning("Rate limited on %s, waiting %.0fs", model, wait)
            time.sleep(wait)
            continue
        if resp.status_code != 200:
            raise LLMError(f"Groq {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        log.info("%s: %s tokens", model, data.get("usage", {}).get("total_tokens"))
        return data["choices"][0]["message"]["content"]
    raise LLMError("Groq rate limit: still limited after retries")


def complete_json[T: BaseModel](
    model: str, system: str, user: str, schema: type[T], reasoning_effort: str | None = None,
    max_tokens: int | None = None,
) -> T:
    """Ask for JSON matching `schema`. Retries once, showing the model its error."""
    messages = [
        {"role": "system", "content": f"{system}\n\nReturn only JSON matching this schema:\n"
         f"{json.dumps(schema.model_json_schema())}"},
        {"role": "user", "content": user},
    ]
    raw = _chat(model, messages, reasoning_effort, max_tokens)
    try:
        return schema.model_validate_json(raw)
    except ValidationError as err:
        messages += [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": f"That JSON was invalid: {err}. Return corrected JSON only."},
        ]
        try:
            return schema.model_validate_json(_chat(model, messages, reasoning_effort, max_tokens))
        except ValidationError as err2:
            raise LLMError(f"Model returned invalid JSON twice: {err2}") from err2
