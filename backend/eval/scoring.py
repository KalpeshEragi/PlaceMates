"""How each generated resume is scored.

claim audit      every factual claim about the candidate, labelled against the student's own resume text
                 (supported / unsupported / contradictory / inaccurate). LLM judge from a different model
                 family; a sample is hand-checked by a person.
code check       numbers and technologies not found anywhere in the student's facts (deterministic).
coverage         share of the job's required skills present (the same ATS code for both resumes).
blind judge      both resumes in random order as "Resume A/B"; rubric scores and a preference.
"""

import random
from typing import Literal

from pydantic import BaseModel, Field

from app.services.resume import ats
from app.services.resume.checks import facts_text, truth_violations
from app.services.resume.schemas import JobBrief
from eval.models import judge

LABELS = ("supported", "unsupported", "contradictory", "inaccurate")


class Claim(BaseModel):
    claim: str = Field(description="One factual statement about the candidate, quoted or closely paraphrased")
    kind: Literal["technology", "number", "responsibility", "outcome", "experience", "education", "other"]
    label: Literal["supported", "unsupported", "contradictory", "inaccurate"]
    evidence: str = Field(description="The line from the candidate's resume that supports or contradicts it, "
                                      "or 'none'")


class Audit(BaseModel):
    claims: list[Claim]


AUDIT_RULES = (
    "You audit a tailored resume against the candidate's original resume, which is the ONLY source of truth. "
    "List every factual claim the tailored resume makes about the candidate: technologies used, numbers and "
    "metrics, responsibilities, outcomes and results, roles, dates, education and awards. Skip pure style "
    "words. Label each claim:\n"
    "- supported: stated in, or directly implied by, the original resume (rewording is fine; a percentage "
    "correctly calculated from numbers in the original counts as supported)\n"
    "- unsupported: not in the original resume at all (new tools, numbers, outcomes, responsibilities, scale)\n"
    "- contradictory: conflicts with the original resume\n"
    "- inaccurate: based on an original fact but misstated (wrong number, inflated role or scope)\n"
    "Be strict: a plausible-sounding addition that the original doesn't state is unsupported.")


def audit(original: str, tailored: str) -> dict:
    result, model = judge(AUDIT_RULES, f"ORIGINAL RESUME:\n{original}\n\nTAILORED RESUME:\n{tailored}", Audit)
    claims = [c.model_dump() for c in result.claims]
    counts = {label: sum(c["label"] == label for c in claims) for label in LABELS}
    return {"judge": model, "claims": claims, "counts": counts, "total": len(claims),
            "bad": counts["unsupported"] + counts["contradictory"] + counts["inaccurate"]}


def code_check(pair: dict, tailored: str) -> list[str]:
    """Deterministic: lines stating a number or technology that appears nowhere in the student's facts."""
    texts = facts_text(pair["items"], pair["skills"])
    everything = " ".join(texts.values()) + " " + pair["resume_text"]
    problems = []
    for line in tailored.splitlines():
        line = line.lstrip("- ").strip()
        if len(line) > 25:
            problems += [f"{p} :: {line[:90]}" for p in truth_violations(line, everything, texts["*"])]
    return problems


def coverage(brief: dict, text: str) -> dict:
    b = JobBrief(**brief)
    found, missing = ats._skill_match(text.lower(), b.must_have)
    return {"required": len(b.must_have), "found": found, "missing": missing,
            "share": round(len(found) / len(b.must_have), 2) if b.must_have else 1.0}


class Scores(BaseModel):
    jd_alignment: int = Field(ge=1, le=10, description="How well it targets this job's requirements")
    relevance: int = Field(ge=1, le=10, description="How relevant the chosen experience and bullets are")
    clarity: int = Field(ge=1, le=10, description="Specific, readable, well-structured")
    credibility: int = Field(ge=1, le=10, description="Believable for a fresher; no inflated claims")


class Comparison(BaseModel):
    resume_a: Scores
    resume_b: Scores
    preferred: Literal["A", "B", "tie"]
    reason: str


JUDGE_RULES = (
    "You are an experienced tech recruiter in India screening fresher resumes. Two resumes were written for the "
    "same candidate and the same job. Score each 1-10 on each criterion, then say which one you would rather "
    "receive, and why in one or two sentences. Judge only what is on the page; length is not quality.")


def blind_compare(pair: dict, baseline_text: str, placemates_text: str) -> dict:
    flip = random.Random(pair["id"]).random() < 0.5  # same order every run for the same pair
    a, b = (placemates_text, baseline_text) if flip else (baseline_text, placemates_text)
    job = pair["job"]
    result, model = judge(JUDGE_RULES, f"JOB: {job['title']} at {job['company']}\n{job['description'][:3000]}\n\n"
                                       f"RESUME A:\n{a}\n\nRESUME B:\n{b}", Comparison)
    pm, base = (result.resume_a, result.resume_b) if flip else (result.resume_b, result.resume_a)
    winner = {"tie": "tie", "A": "placemates" if flip else "baseline", "B": "baseline" if flip else "placemates"}
    return {"judge": model, "placemates": pm.model_dump(), "baseline": base.model_dump(),
            "preferred": winner[result.preferred], "reason": result.reason, "placemates_was": "A" if flip else "B"}
