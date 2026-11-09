"""ATS stage: what documented applicant tracking systems compute, in plain code (see docs/resume-evaluation.md).

    required skills   Workday Skills Match weights required skills higher; HiredScore grades on them
    preferred skills  HiredScore "most preferred qualifications"
    designation       Naukri RMS sub-score; Textkernel job-title category
    experience        Naukri RMS sub-score (years asked vs fresher)
    education         Naukri RMS / Textkernel category
Real ATSs mostly rank rather than auto-reject; this score says where a recruiter's list would put the resume.
"""

import re

from app.models import Job
from app.services.matching.exemplars import TECH
from app.services.matching.matcher import years_required
from app.services.resume.schemas import JobBrief

WEIGHTS = {"required": 0.45, "preferred": 0.15, "designation": 0.15, "experience": 0.15, "education": 0.10}
TITLE_STOP = {"developer", "engineer", "engineering", "software", "intern", "junior", "senior", "the", "and", "i",
              "ii", "trainee", "associate", "graduate", "fresher", "role", "-", "&", "of", "for", "sde"}


def _hit(text: str, term: str) -> bool:
    return re.search(rf"(?<![\w.+#]){re.escape(term.lower())}(?![\w+#])", text) is not None


def _present(text: str, phrase: str) -> bool:
    """'Strong proficiency in React.js' -> look for 'react.js'; phrases with no known tech are matched as written."""
    terms = TECH.findall(phrase)
    return any(_hit(text, t) for t in terms) if terms else _hit(text, phrase)


def _skill_match(text: str, terms: list[str]) -> tuple[list[str], list[str]]:
    terms = [t for t in terms if t.strip()]
    found = [t for t in terms if _present(text, t)]
    return found, [t for t in terms if t not in found]




def evaluate(resume_text: str, headings: str, brief: JobBrief, job_title: str, job_description: str,
             has_degree: bool) -> dict:
    text = resume_text.lower()
    req_found, req_missing = _skill_match(text, brief.must_have)
    pref_found, pref_missing = _skill_match(text, brief.nice_to_have)
    required = len(req_found) / len(brief.must_have) if brief.must_have else 1.0
    preferred = len(pref_found) / len(brief.nice_to_have) if brief.nice_to_have else 1.0

    title_words = {w for w in re.findall(r"[a-z.+#]+", job_title.lower()) if w not in TITLE_STOP and len(w) > 1}
    head = f"{headings} {resume_text}".lower()
    title_hits = [w for w in title_words if _hit(head, w)]
    designation = len(title_hits) / len(title_words) if title_words else 1.0

    asked = years_required(Job(title=job_title, description=job_description))
    experience = 1.0 if asked is None or asked <= 1 else 0.5 if asked == 2 else 0.0

    sub = {"required": required, "preferred": preferred, "designation": designation,
           "experience": experience, "education": 1.0 if has_degree else 0.0}
    total = sum(WEIGHTS[k] * v for k, v in sub.items())
    tier = "Strong" if total >= 0.8 else "Good" if total >= 0.6 else "Fair" if total >= 0.4 else "Low"
    # HiredScore-style grade on required ("basic") and preferred qualifications.
    if required == 1.0 and preferred >= 0.5 and total >= 0.75:
        grade = "A"
    elif required == 1.0:
        grade = "B"
    elif required >= 0.6:
        grade = "C"
    else:
        grade = "D"
    evidence = ([f"found required: {t}" for t in req_found] + [f"not found required: {t}" for t in req_missing]
                + [f"found preferred: {t}" for t in pref_found] + [f"not found preferred: {t}" for t in pref_missing]
                + [f"title words found: {', '.join(title_hits) or 'none'} of {', '.join(sorted(title_words)) or '-'}",
                   f"years asked: {asked if asked is not None else 'not stated'}",
                   f"degree on profile: {'yes' if has_degree else 'no'}"])
    return {"score": round(total * 100), "tier": tier, "grade": grade,
            "sub_scores": {k: round(v, 2) for k, v in sub.items()}, "weights": WEIGHTS,
            "required_missing": req_missing, "preferred_missing": pref_missing, "evidence": evidence,
            "note": "Most ATSs rank rather than auto-reject; a low match moves you down the recruiter's list."}
