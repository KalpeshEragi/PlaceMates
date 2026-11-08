"""Find weak points in profile items, with plain rules (no AI, no cost).

Each experience/project is checked on five dimensions. A dimension is
covered by a fact the user gave, or by a resume bullet that already shows it.
When picking questions, a dimension already asked about is skipped (even if
the answer was "not measured"), so we never ask twice.
"""

import re
from dataclasses import dataclass

from app.models import Profile, ProfileItem

DIMENSIONS = ["action", "tech", "scale", "outcome", "role"]
SCORED_KINDS = {"experience", "project"}

VAGUE_START = re.compile(r"^(worked on|helped|assisted|involved in|responsible for|part of|did)\b", re.I)
OUTCOME_WORDS = re.compile(
    r"\b(reduc\w*|increas\w*|improv\w*|sav\w*|cut|boost\w*|grew|faster|users?|customers?|adopt\w*)\b|%", re.I
)


@dataclass
class ItemGaps:
    item: ProfileItem
    missing: list[str]

    @property
    def score(self) -> float:
        return 1 - len(self.missing) / len(DIMENSIONS)


def _bullets(item: ProfileItem) -> list[str]:
    return [str(f.value) for f in item.facts if f.field == "bullet"]


def _has_fact(item: ProfileItem, field: str) -> bool:
    return any(f.field == field and f.value not in (None, "", []) for f in item.facts)


def item_gaps(item: ProfileItem, asked: set[tuple[str, str]]) -> ItemGaps:
    bullets = _bullets(item)
    covered = {
        "action": bool(bullets)
        and all(len(b.split()) >= 6 and not VAGUE_START.search(b) for b in bullets),
        "tech": _has_fact(item, "tech"),
        "scale": _has_fact(item, "scale") or any(re.search(r"\d", b) for b in bullets),
        "outcome": _has_fact(item, "outcome") or any(OUTCOME_WORDS.search(b) for b in bullets),
        # A job title already says what your role was.
        "role": _has_fact(item, "role") or item.kind == "experience",
    }
    missing = [
        d for d in DIMENSIONS
        if not covered[d] and (str(item.id), d) not in asked
    ]
    return ItemGaps(item, missing)


def profile_gaps(profile: Profile, asked: set[tuple[str, str]]) -> list[ItemGaps]:
    """Scored items, weakest first; ties keep resume order (most recent first)."""
    gaps = [item_gaps(i, asked) for i in profile.items if i.kind in SCORED_KINDS]
    return sorted(gaps, key=lambda g: g.score)


def strength(profile: Profile) -> int:
    """0-100. Ignores what was asked: "not measured" doesn't make a profile stronger."""
    gaps = [item_gaps(i, set()) for i in profile.items if i.kind in SCORED_KINDS]
    if not gaps:
        return 0
    return round(100 * sum(g.score for g in gaps) / len(gaps))
