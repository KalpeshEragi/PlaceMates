"""Render a tailored resume to PDF: one column, real text, standard headings.

Parser-friendly on purpose (KB INT-005; Workday can't score unsupported or image resumes):
no tables, columns, icons or images. Rendered with PyMuPDF's HTML engine (already a dependency).
"""

import html
import io
import re
from collections import defaultdict

import pymupdf as fitz

from app.models import Profile

CSS = """
* { font-family: sans-serif; }
body { font-size: 10pt; line-height: 1.3; color: #111; }
h1 { font-size: 18pt; margin: 0 0 2pt 0; }
.contact { font-size: 9pt; color: #333; margin-bottom: 6pt; }
h2 { font-size: 10.5pt; margin: 9pt 0 3pt 0; padding-bottom: 1pt; border-bottom: 0.6pt solid #444;
     text-transform: uppercase; letter-spacing: 0.5pt; }
.head { margin: 5pt 0 1pt 0; }
.title { font-weight: bold; }
.meta { color: #444; }
ul { margin: 1pt 0 0 0; padding-left: 12pt; }
li { margin: 0 0 1.5pt 0; }
p { margin: 0; }
"""
SECTIONS = (("experience", "Experience"), ("research", "Research"), ("project", "Projects"),
            ("award", "Achievements"), ("certification", "Certifications"), ("other", "Other"))


def _e(value) -> str:
    return html.escape(str(value)) if value else ""


def _grade(item: dict) -> str | None:
    for f in item.get("facts", []):
        if f["field"].lower() in ("cgpa", "gpa", "grade", "percentage", "score"):
            return str(f["value"])
    return None


def header_links(links: list[str]) -> list[str]:
    """LinkedIn, the GitHub profile and one other site, shortened. Repo links belong next to their project,
    and mailto:/tel: repeat the email and phone."""
    clean = []
    for link in links or []:
        if not link or link.startswith(("mailto:", "tel:")):
            continue
        short = re.sub(r"^https?://(www\.)?", "", link).rstrip("/")
        clean.append(short)
    linkedin = [c for c in clean if "linkedin.com/" in c][:1]
    github = [c for c in clean if re.fullmatch(r"github\.com/[^/]+", c)][:1]
    other = [c for c in clean if "linkedin.com" not in c and "github.com" not in c][:1]
    return linkedin + github + other


def resume_html(profile: Profile, draft: dict, items: dict[str, dict], education: list[dict]) -> str:
    links = header_links(profile.links)
    contact = " | ".join(_e(x) for x in (profile.email, profile.phone, profile.location, *links) if x)
    out = [f"<h1>{_e(profile.full_name) or 'Your name'}</h1>", f"<p class='contact'>{contact}</p>"]
    if draft.get("summary"):
        out += ["<h2>Summary</h2>", f"<p>{_e(draft['summary'])}</p>"]
    if education:
        out.append("<h2>Education</h2>")
        for ed in education:
            meta = " | ".join(_e(x) for x in (ed.get("organization"), ed.get("dates")) if x)
            grade = _grade(ed)
            out.append(f"<p class='head'><span class='title'>{_e(ed.get('title'))}</span>"
                       f"{' | ' + meta if meta else ''}{' | CGPA/Grade: ' + _e(grade) if grade else ''}</p>")
    if draft.get("skills"):
        out += ["<h2>Skills</h2>", f"<p>{', '.join(_e(s) for s in draft['skills'])}</p>"]
    by_kind = defaultdict(list)
    for d in draft.get("items", []):
        if d["item_id"] in items:
            by_kind[items[d["item_id"]]["kind"]].append(d)
    for kind, label in SECTIONS:
        if not by_kind.get(kind):
            continue
        out.append(f"<h2>{label}</h2>")
        for d in by_kind[kind]:
            it = items[d["item_id"]]
            meta = " | ".join(_e(x) for x in (it.get("organization"), it.get("dates")) if x)
            out.append(f"<p class='head'><span class='title'>{_e(it.get('title'))}</span>"
                       f"{' <span class=meta>| ' + meta + '</span>' if meta else ''}</p>")
            bullets = [b["text"] if isinstance(b, dict) else b for b in d.get("bullets", [])]
            out.append("<ul>" + "".join(f"<li>{_e(b)}</li>" for b in bullets) + "</ul>")
    return "<body>" + "\n".join(out) + "</body>"


def render_pdf(profile: Profile, draft: dict, items: dict[str, dict], education: list[dict]) -> bytes:
    story = fitz.Story(html=resume_html(profile, draft, items, education), user_css=CSS)
    buf = io.BytesIO()
    writer = fitz.DocumentWriter(buf)
    page = fitz.paper_rect("a4")
    area = page + (40, 36, -40, -36)  # margins: left, top, right, bottom
    more = True
    while more:
        device = writer.begin_page(page)
        more, _ = story.place(area)
        story.draw(device)
        writer.end_page()
    writer.close()
    return buf.getvalue()
