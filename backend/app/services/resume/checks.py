"""Code-level checks on a draft: truthfulness, keyword coverage, bullet quality, and the score.

The truth check is the honesty guarantee: a bullet may only mention numbers and technologies
that exist in the student's saved facts and skills. Prompts ask for this; code enforces it.
"""

import re

from app.services.matching.exemplars import TECH, bullet_parts, bullet_quality
from app.services.resume.schemas import JobBrief, ResumeDraft

NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")
# Describing an API as REST isn't claiming a new technology.
GENERIC_TECH = {"rest", "restful"}


def _norm_num(n: str) -> str:
    """'1,000' -> '1000', '2.50' -> '2.5', '10' stays '10'."""
    n = n.replace(",", "")
    if "." in n:
        n = n.rstrip("0").rstrip(".")
    return n or "0"


def facts_text(items: dict[str, dict], skills: list[str]) -> dict[str, str]:
    """item_id -> all text we know about that item (facts + title/org), plus '*' for profile-wide skills."""
    out = {}
    for item_id, item in items.items():
        parts = [item.get("title") or "", item.get("organization") or "", item.get("dates") or ""]
        for f in item.get("facts", []):
            v = f["value"]
            parts.append(" ".join(map(str, v)) if isinstance(v, list) else str(v))
        out[item_id] = " ".join(parts)
    out["*"] = " ".join(skills)
    return out


def truth_violations(bullet: str, item_text: str, profile_text: str) -> list[str]:
    """Numbers must come from the item's facts; technologies from the item or the student's skills."""
    problems = []
    known_nums = {_norm_num(n) for n in NUM.findall(item_text)}
    for n in NUM.findall(bullet):
        if _norm_num(n) not in known_nums:
            problems.append(f"number '{n}' is not in your saved facts")
    known = (item_text + " " + profile_text).lower()
    for tech in {t.lower() for t in TECH.findall(bullet)} - GENERIC_TECH:
        if tech not in known:
            problems.append(f"'{tech}' is not in your saved facts or skills")
    return problems


def enforce_truth(draft: ResumeDraft, items: dict[str, dict], skills: list[str]) -> tuple[ResumeDraft, list[dict]]:
    """Drop bullets that state anything not backed by facts. Returns the cleaned draft and what was dropped."""
    texts = facts_text(items, skills)
    dropped = []
    for d in draft.items:
        kept = []
        for b in d.bullets:
            problems = truth_violations(b, texts.get(d.item_id, ""), texts["*"])
            if problems:
                dropped.append({"item_id": d.item_id, "bullet": b, "problems": problems})
            else:
                kept.append(b)
        d.bullets = kept
    draft.items = [d for d in draft.items if d.item_id in items and d.bullets]
    known_skills = {s.lower() for s in skills} | {t.lower() for t in TECH.findall(" ".join(texts.values()))}
    draft.skills = [s for s in draft.skills if s.lower() in known_skills or s.lower() in " ".join(texts.values()).lower()]
    return draft, dropped


def resume_text(draft: ResumeDraft) -> str:
    return "\n".join([draft.summary, ", ".join(draft.skills), *(b for d in draft.items for b in d.bullets)])


def keyword_coverage(text: str, brief: JobBrief) -> dict:
    low = text.lower()
    def hit(term: str) -> bool:
        return re.search(rf"(?<![\w.+#]){re.escape(term.lower())}(?![\w+#])", low) is not None
    must = [t for t in brief.must_have if t.strip()]
    # "Strong proficiency in React.js" -> look for "react.js"; phrases with no known tech are matched as written.
    def present(phrase: str) -> bool:
        terms = TECH.findall(phrase)
        return any(hit(t) for t in terms) if terms else hit(phrase)
    found = [t for t in must if present(t)]
    return {"must_have_found": found, "must_have_missing": [t for t in must if t not in found],
            "coverage": round(len(found) / len(must), 2) if must else 1.0}


def score(draft: ResumeDraft, brief: JobBrief, dropped: list[dict]) -> dict:
    """0-100, from parts anyone can check. Weights are a first version, to be calibrated on real outcomes."""
    bullets = [b for d in draft.items for b in d.bullets]
    qualities = [bullet_quality(bullet_parts(b)) for b in bullets]
    cov = keyword_coverage(resume_text(draft), brief)
    avg_quality = sum(qualities) / len(qualities) if qualities else 0
    enough = min(len(bullets) / 8, 1.0)  # a fresher page has roughly 8-12 bullets
    truth_penalty = min(len(dropped) * 0.05, 0.2)
    total = 100 * max(0.45 * cov["coverage"] + 0.40 * avg_quality + 0.15 * enough - truth_penalty, 0)
    return {"score": round(total), "keyword_coverage": cov, "avg_bullet_quality": round(avg_quality, 2),
            "bullets": len(bullets), "dropped_for_truth": len(dropped),
            "band": "Strong" if total >= 75 else "Good" if total >= 55 else "Needs work"}
