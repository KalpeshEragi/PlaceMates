"""Profile -> ordered entities (one per project, experience, ... plus personal and skills)."""

import hashlib
import json

from app.agent.domain import KIND_SECTION, SECTIONS
from app.models import Profile

SECTION_ORDER = [key for key, _ in SECTIONS]


def entity_list(profile: Profile) -> list[dict]:
    """All entities in section order, then resume order inside a section."""
    entities = [{"id": "personal", "section": "personal", "type": "personal", "title": "Personal information"},
                {"id": "skills", "section": "skills", "type": "skills", "title": "Skills"}]
    for item in profile.items:
        section, rubric = KIND_SECTION.get(item.kind, ("additional", "other"))
        entities.append({"id": str(item.id), "section": section, "type": rubric, "title": item.title})
    return sorted(entities, key=lambda e: SECTION_ORDER.index(e["section"]))  # stable: keeps item order


def entity_context(profile: Profile, entity_id: str) -> dict | None:
    """What the agent may see about one entity. Personal details are sent as present/absent only."""
    meta = next((e for e in entity_list(profile) if e["id"] == entity_id), None)
    if not meta:
        return None
    if entity_id == "personal":
        data = {
            "name_provided": bool(profile.full_name), "email_provided": bool(profile.email),
            "phone_provided": bool(profile.phone), "location": profile.location,
            "headline": profile.headline, "links": profile.links or [],
        }
    elif entity_id == "skills":
        data = {
            "skills": sorted(s.name for s in profile.skills),
            "tech_used_in_items": sorted({t for i in profile.items for f in i.facts if f.field == "tech"
                                          for t in (f.value if isinstance(f.value, list) else [f.value])}),
        }
    else:
        item = next(i for i in profile.items if str(i.id) == entity_id)
        data = {
            "kind": item.kind, "title": item.title, "organization": item.organization,
            "dates": " - ".join(d for d in (item.start_date, item.end_date) if d) or None,
            "facts": [{"field": f.field, "value": f.value, "source": f.source} for f in item.facts],
        }
    return {**meta, "data": data}


def entity_hash(context: dict, prompt_version: str) -> str:
    raw = json.dumps(context["data"], sort_keys=True, default=str) + prompt_version
    return hashlib.sha256(raw.encode()).hexdigest()
