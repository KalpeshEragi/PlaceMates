"""The two systems under test, on the same model.

baseline     what a student does today: paste resume + job description into an LLM and ask it to tailor.
             The prompt is a typical user prompt, without PlaceMates' honesty rules.
placemates   the full pipeline (analysis, strategy, generation with example bullets, truth checks),
             minus the recruiter panel, which only adds scores and isn't needed here.
"""

from pydantic import BaseModel, Field

from app.config import settings
from eval.models import QuotaExhausted, call, daily_limit, exhausted

BASELINE_PROMPT = ("Here is my resume and a job description. Rewrite my resume so it is tailored to this job and "
                   "gives me the best chance of being shortlisted.")


class Section(BaseModel):
    heading: str = Field(description="e.g. 'Backend Intern | Razorpay' or 'PlaceMate project'")
    bullets: list[str]


class BaselineResume(BaseModel):
    summary: str
    skills: list[str]
    sections: list[Section]


def baseline(pair: dict, model: str) -> dict:
    out = call(model, "You are a helpful assistant.",
                   f"{BASELINE_PROMPT}\n\nMY RESUME:\n{pair['resume_text']}\n\nJOB DESCRIPTION:\n"
                   f"{pair['job']['title']} at {pair['job']['company']}\n{pair['job']['description'][:4000]}",
                   BaselineResume)
    lines = ["SUMMARY", out.summary, "", "SKILLS", ", ".join(out.skills), ""]
    for s in out.sections:
        lines += [s.heading, *(f"- {b}" for b in s.bullets), ""]
    return {"text": "\n".join(lines).strip(), "raw": out.model_dump(), "model": model}


def placemates(pair: dict, model: str) -> dict:
    """Every agent in the pipeline runs on `model` for this pair."""
    from app.services.resume.crew import _tailor  # heavy import
    saved = settings.model_extract, settings.model_questions
    settings.model_extract = settings.model_questions = model
    try:
        r = _tailor(pair["job"], pair["items"], pair["skills"], pair["education"], use_gemini=False,
                    with_panel=False)
    except Exception as err:  # noqa: BLE001
        if daily_limit(err):
            exhausted.add(model)
            raise QuotaExhausted(model, str(err)) from err
        raise
    finally:
        settings.model_extract, settings.model_questions = saved
    return {"text": r["text"], "brief": r["analysis"]["job"], "dropped_for_truth": r["dropped_for_truth"],
            "unsupported_claims": r["unsupported_claims"], "seconds": r["seconds"], "model": model}
