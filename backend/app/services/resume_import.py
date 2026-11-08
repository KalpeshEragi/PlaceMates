"""Resume PDF -> structured profile.

1. PyMuPDF pulls the text (in reading order) and the hidden link targets.
2. The cheap model organizes that text into ParsedResume. It must not invent.
3. merge_into_profile adds what's new and never overwrites user edits.
"""

import pymupdf
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ItemFact, Profile, ProfileItem, Skill
from app.schemas import ParsedResume
from app.services.llm import complete_json


class ResumeReadError(Exception):
    pass


def extract_pdf(data: bytes) -> tuple[str, list[str]]:
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as err:
        raise ResumeReadError("Not a readable PDF") from err

    pages, links = [], []
    for page in doc:
        pages.append(page.get_text("text", sort=True))
        links += [link["uri"] for link in page.get_links() if link.get("uri")]

    text = "\n".join(pages).strip()
    if len(text) < 50:
        raise ResumeReadError("No text found. Please upload a text-based PDF, not a scan.")
    return text, list(dict.fromkeys(links))


SYSTEM_PROMPT = """You convert resume text into structured data.
Rules:
- Copy facts only. Never invent, guess or improve wording.
- One item per job, project, degree, certification or award.
- kind is one of: experience, project, education, certification, award.
- bullets: each original bullet point, copied as written.
- For education, put the grade as a bullet exactly as written (e.g. "CGPA 8.4", "87%").
- tech: technologies named in that item only.
- skills: the resume's skills section, one entry per skill.
- Missing values are null or empty lists."""


def parse_resume(text: str, links: list[str]) -> ParsedResume:
    user = f"Resume text:\n{text}\n\nLinks found in the PDF:\n" + "\n".join(links)
    parsed = complete_json(settings.model_extract, SYSTEM_PROMPT, user, ParsedResume)
    # Links from the PDF itself are reliable; make sure none are lost.
    parsed.basics.links = list(dict.fromkeys([*parsed.basics.links, *links]))
    return parsed


def _key(kind: str, title: str, org: str | None) -> tuple[str, str, str]:
    return kind, title.strip().lower(), (org or "").strip().lower()


def merge_into_profile(db: Session, profile: Profile, parsed: ParsedResume) -> None:
    # Basics: fill empty fields only, so a re-upload never undoes user edits.
    for field, value in parsed.basics.model_dump().items():
        if field == "links":
            profile.links = list(dict.fromkeys([*(profile.links or []), *value]))
        elif value and not getattr(profile, field):
            setattr(profile, field, value)

    have_skills = {s.name.lower() for s in profile.skills}
    for name in parsed.skills:
        if name.strip() and name.strip().lower() not in have_skills:
            profile.skills.append(Skill(name=name.strip(), source="resume"))
            have_skills.add(name.strip().lower())

    existing = {_key(i.kind, i.title, i.organization): i for i in profile.items}
    for p in parsed.items:
        item = existing.get(_key(p.kind, p.title, p.organization))
        if not item:
            item = ProfileItem(
                kind=p.kind, title=p.title, organization=p.organization,
                start_date=p.start_date, end_date=p.end_date,
                original_text="\n".join(p.bullets) or None,
                position=len(profile.items),
            )
            profile.items.append(item)

        have_facts = {(f.field, str(f.value)) for f in item.facts}
        bullets = [b.strip().lstrip("-•*·▪– ").strip() for b in p.bullets]
        new_facts = [("bullet", b) for b in bullets if b] + ([("tech", p.tech)] if p.tech else [])
        for field, value in new_facts:
            if (field, str(value)) not in have_facts:
                item.facts.append(ItemFact(field=field, value=value, source="resume"))

    db.commit()
