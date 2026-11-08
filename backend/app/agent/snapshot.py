"""Compact, model-friendly view of a profile, and a hash to detect changes."""

import hashlib
import json

from app.models import Profile


def profile_snapshot(profile: Profile) -> dict:
    return {
        "headline": profile.headline,
        "skills": sorted(s.name for s in profile.skills),
        "items": [
            {
                "item_id": str(i.id),
                "kind": i.kind,
                "title": i.title,
                "organization": i.organization,
                "dates": " - ".join(d for d in (i.start_date, i.end_date) if d) or None,
                "facts": [{"field": f.field, "value": f.value, "source": f.source} for f in i.facts],
            }
            for i in profile.items
        ],
    }


def snapshot_hash(snapshot: dict, prompt_version: str) -> str:
    raw = json.dumps(snapshot, sort_keys=True, default=str) + prompt_version
    return hashlib.sha256(raw.encode()).hexdigest()
