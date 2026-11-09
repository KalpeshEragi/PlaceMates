"""Code-level checks on a draft: truthfulness and bullet quality.

The truth check is the honesty guarantee: a bullet may only mention numbers and technologies
that exist in the student's saved facts and skills. Prompts ask for this; code enforces it.
"""

import re

from app.services.matching.exemplars import TECH, bullet_parts, bullet_quality
from app.services.resume.schemas import ResumeDraft

NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")
# Describing an API as REST isn't claiming a new technology.
GENERIC_TECH = {"rest", "restful"}
# Result and quality words a writer tends to add on its own ("ensuring accurate settlement").
# Flagged when the item's facts don't say anything like it (KB INT-019, INT-039).
CLAIM = re.compile(
    r"\b(ensur\w*|prevent\w*|reduc\w*|improv\w*|increas\w*|boost\w*|accelerat\w*|optimi[sz]\w*|scalab\w*|robust|"
    r"reliab\w*|accura\w*|efficien\w*|seamless\w*|comprehensive|high[- ]performance|production[- ]grade|"
    r"real[- ]time|across multiple|significant\w*|enhanc\w*|streamlin\w*|faster)\b", re.I)
# A claim is supported when the facts say it in other words ("grew traffic by 20%" supports "increased").
SAME_AS = {
    "incre": ("incre", "grew", "grow", "rais", "boost", "improv", "%"),
    "boost": ("boost", "incre", "grew", "grow", "improv", "%"),
    "impro": ("impro", "incre", "grew", "boost", "better", "%"),
    "reduc": ("reduc", "cut", "lower", "decre", "sav", "%"),
    "accel": ("accel", "faster", "speed", "%"),
    "faste": ("faste", "accel", "speed", "%"),
    "accur": ("accur", "%"),
}


def _supported(word: str, known: str) -> bool:
    stem = word.lower()[:5]
    return any(s in known for s in SAME_AS.get(stem, (stem,)))


def unsupported_claims(draft: ResumeDraft, items: dict[str, dict]) -> list[dict]:
    """Bullets claiming a result or quality that the item's facts don't mention. Flagged, not dropped:
    the student may confirm it."""
    texts = facts_text(items, [])
    out = []
    for d in draft.items:
        known = texts.get(d.item_id, "").lower()
        for b in d.bullets:
            words = sorted({m.lower() for m in CLAIM.findall(b.text) if not _supported(m, known)})
            if words:
                out.append({"item_id": d.item_id, "bullet": b.text, "words": words})
    return out


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
            problems = truth_violations(b.text, texts.get(d.item_id, ""), texts["*"])
            if problems:
                dropped.append({"item_id": d.item_id, "bullet": b.text, "problems": problems})
            else:
                kept.append(b)
        d.bullets = kept
    draft.items = [d for d in draft.items if d.item_id in items and d.bullets]
    known_skills = {s.lower() for s in skills} | {t.lower() for t in TECH.findall(" ".join(texts.values()))}
    draft.skills = [s for s in draft.skills if s.lower() in known_skills or s.lower() in " ".join(texts.values()).lower()]
    return draft, dropped


def resume_text(draft: ResumeDraft) -> str:
    return "\n".join([draft.summary, ", ".join(draft.skills), *(b.text for d in draft.items for b in d.bullets)])


def avg_bullet_quality(draft: ResumeDraft) -> float:
    q = [bullet_quality(bullet_parts(b.text)) for d in draft.items for b in d.bullets]
    return round(sum(q) / len(q), 2) if q else 0.0
