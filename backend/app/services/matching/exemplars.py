"""Example bullets from real resumes that passed screens: parse, score, search.

Scoring is plain code, so it's repeatable and explainable. A strong bullet has:
    action   starts with a specific verb (not "worked on", "helped", "responsible for")
    tech     names the tools it used
    metric   has a number (scale, %, time, users, $)
    outcome  says what changed (reduced, improved, enabled, ...)
    length   12-35 words: enough detail, still one or two lines
"""

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ExemplarBullet
from app.services.matching.embeddings import QUERY_PREFIX, embed

WEAK_START = re.compile(r"^(worked|helped|assisted|responsible|involved|participated|was|did|tasked|exposure)\b", re.I)
VERB_START = re.compile(r"^[A-Z][a-z]+(ed|ing|t|ilt|ote|ew|ade|ught|ent|ound)\b|^(Led|Built|Ran|Won|Cut|Set|Shipped|Wrote|Made|Drove|Grew)\b")
METRIC = re.compile(r"\d")
OUTCOME = re.compile(r"\b(reduc\w*|improv\w*|increas\w*|sav\w*|cut|boost\w*|enabl\w*|achiev\w*|decreas\w*|"
                     r"accelerat\w*|eliminat\w*|resulting|lower\w*|rais\w*|grow|grew|faster|serving|used by|adopted)\b", re.I)
TECH = re.compile(
    r"(?<![\w.])(python|java(?:script)?|typescript|c\+\+|c#|go(?:lang)?|rust|kotlin|swift|sql|nosql|postgres\w*|mysql|"
    r"mongodb|redis|kafka|spark|pyspark|hadoop|airflow|dbt|snowflake|bigquery|databricks|aws|gcp|azure|lambda|s3|ec2|"
    r"docker|kubernetes|terraform|jenkins|github actions|ci/cd|linux|bash|react(?:\.js)?|next\.js|node(?:\.js)?|"
    r"express|angular|vue(?:\.js)?|django|flask|fastapi|spring(?: boot)?|\.net|graphql|rest(?:ful)?|grpc|websocket\w*|"
    r"pytorch|tensorflow|keras|scikit-learn|sklearn|pandas|numpy|opencv|llm|rag|langchain|bert|transformer\w*|"
    r"yolo\w*|faiss|power bi|tableau|grafana|prometheus|elasticsearch|firebase|supabase|tailwind|jest|selenium|"
    r"unity|unreal|matlab|r)(?![\w+#])", re.I)


def bullet_parts(text: str) -> dict:
    words = len(text.split())
    first = text.split()[0] if text.split() else ""
    return {
        "action": bool(VERB_START.match(text)) and not WEAK_START.match(text),
        "weak_start": bool(WEAK_START.match(text)),
        "tech": sorted({t.lower() for t in TECH.findall(text)})[:6],
        "metric": bool(METRIC.search(text)),
        "outcome": bool(OUTCOME.search(text)),
        "words": words,
        "first_word": first,
    }


def bullet_quality(parts: dict, resume_weight: float = 1.0) -> float:
    score = (0.30 * parts["action"] + 0.25 * bool(parts["tech"]) + 0.25 * parts["metric"]
             + 0.10 * parts["outcome"] + 0.10 * (12 <= parts["words"] <= 35))
    if parts["weak_start"]:
        score -= 0.2
    return round(max(score, 0) * resume_weight, 3)


HEADING = re.compile(r"^(experience|professional experience|work experience|projects?|project experience|"
                     r"research|research experience|leadership|education|skills|technical skills|summary|"
                     r"achievements|certifications|skills and achievements|achievements and certifications|"
                     r"objective|activities|awards)\b", re.I)
SECTION_OF = {"experience": "experience", "professional experience": "experience", "work experience": "experience",
              "research": "experience", "research experience": "experience", "leadership": "experience",
              "project": "project", "projects": "project", "project experience": "project"}


def split_bullets(transcript: str) -> list[tuple[str, str | None, str]]:
    """-> [(section, heading line above the bullet, bullet text)] for experience/project bullets only."""
    out, section, heading = [], None, None
    for raw in transcript.splitlines():
        line = raw.strip()
        if not line:
            continue
        if HEADING.match(line) and len(line) < 40 and not line.startswith("-"):
            section = SECTION_OF.get(line.lower().rstrip(":"), None)
            heading = None
            continue
        if line.startswith(("- ", "• ", "* ")):
            text = re.sub(r"\*\*|__", "", line[2:]).strip()  # transcripts may carry markdown bold
            if section and len(text.split()) >= 6 and "[REDACTED" not in text:
                out.append((section, heading, text))
        elif section:
            heading = line[:200]
    return out


def search(db: Session, query: str, section: str | None = None, levels: list[str] | None = None,
           k: int = 5, min_quality: float = 0.6) -> list[ExemplarBullet]:
    """Strong bullets most similar in meaning to `query` (e.g. a student's project description)."""
    vec = embed([QUERY_PREFIX + query])[0]
    similarity = (1 - ExemplarBullet.embedding.cosine_distance(vec)).label("similarity")
    stmt = select(ExemplarBullet, similarity).where(ExemplarBullet.quality >= min_quality)
    if section:
        stmt = stmt.where(ExemplarBullet.section == section)
    if levels:
        stmt = stmt.where(ExemplarBullet.level.in_(levels))
    stmt = stmt.order_by(ExemplarBullet.embedding.cosine_distance(vec)).limit(k * 3)
    candidates = db.execute(stmt).all()
    # Relevance first, quality second; keep variety across source resumes.
    ranked = sorted(candidates, key=lambda row: -(0.7 * float(row[1]) + 0.3 * row[0].quality))
    picked, sources = [], set()
    for b, _ in ranked:
        if b.source_file in sources and len(candidates) > k:
            continue
        picked.append(b)
        sources.add(b.source_file)
        if len(picked) == k:
            break
    return picked
