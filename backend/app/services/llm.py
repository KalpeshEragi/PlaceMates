"""Cheap-model calls (Groq). Gemini is reserved for resume drafting."""

import json

import httpx
from pydantic import BaseModel, ValidationError

from app.config import settings


class LLMError(Exception):
    pass


def _chat(model: str, messages: list[dict]) -> str:
    if not settings.groq_api_key:
        raise LLMError("GROQ_API_KEY is not set")
    resp = httpx.post(
        f"{settings.groq_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        json={
            "model": model,
            "messages": messages,
            "temperature": 0,
            "response_format": {"type": "json_object"},
        },
        timeout=60,
    )
    if resp.status_code != 200:
        raise LLMError(f"Groq {resp.status_code}: {resp.text[:300]}")
    return resp.json()["choices"][0]["message"]["content"]


def complete_json[T: BaseModel](model: str, system: str, user: str, schema: type[T]) -> T:
    """Ask for JSON matching `schema`. Retries once, showing the model its error."""
    messages = [
        {"role": "system", "content": f"{system}\n\nReturn only JSON matching this schema:\n"
         f"{json.dumps(schema.model_json_schema())}"},
        {"role": "user", "content": user},
    ]
    raw = _chat(model, messages)
    try:
        return schema.model_validate_json(raw)
    except ValidationError as err:
        messages += [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": f"That JSON was invalid: {err}. Return corrected JSON only."},
        ]
        try:
            return schema.model_validate_json(_chat(model, messages))
        except ValidationError as err2:
            raise LLMError(f"Model returned invalid JSON twice: {err2}") from err2
