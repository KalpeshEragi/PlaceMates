"""Turn source postings into one shape, and decide which ones PlaceMates keeps. Plain code."""

import html
import re
from dataclasses import dataclass, field
from datetime import datetime

INDIA = re.compile(r"\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|gurgaon|gurugram|noida|delhi|"
                   r"chennai|kolkata|ahmedabad|jaipur|kochi|coimbatore|indore|chandigarh|thiruvananthapuram)\b", re.I)
REMOTE = re.compile(r"\bremote\b|\banywhere\b|\bwork from home\b", re.I)
# Remote roles we keep must be open to India: India/APAC/Asia/global, or just "Remote" with no region.
REMOTE_OPEN_TO_INDIA = re.compile(r"\b(india|apac|asia|global|worldwide|anywhere)\b", re.I)
REMOTE_ELSEWHERE = re.compile(r"\b(us|usa|united states|americas|north america|canada|emea|europe|uk|"
                              r"united kingdom|germany|latam|brazil|mexico|australia|japan|singapore|ireland|"
                              r"france|spain|netherlands|poland)\b", re.I)

# Software and IT roles only (PlaceMates' audience).
TECH_TITLE = re.compile(
    r"\b(engineer|engineering|developer|sde|swe|programmer|software|data|machine learning|ml|ai|"
    r"devops|sre|site reliability|cloud|platform|infrastructure|security|qa|test|quality (?:assurance|engineer)|"
    r"analyst|scientist|architect|frontend|front-end|backend|back-end|full[- ]?stack|mobile|"
    r"android|ios|database|dba|network|it support|technical support|support engineer|intern)\b", re.I)
NON_TECH = re.compile(r"\b(sales|account executive|recruiter|legal|counsel|marketing manager|"
                      r"account manager|business development|hr\b|finance manager|paralegal)\b", re.I)

SENIOR = re.compile(r"\b(senior|sr\.?|staff|principal|lead|manager|director|head|architect|vp|iii|iv)\b", re.I)
ENTRY = re.compile(r"\b(junior|jr\.?|associate|entry|graduate|new grad|fresher|trainee|apprentice|i)\b", re.I)
INTERN = re.compile(r"\bintern(ship)?\b", re.I)


@dataclass
class Posting:
    source: str
    source_id: str
    company: str
    title: str
    location: str
    description: str
    apply_url: str
    posted_at: datetime
    employment_type: str | None = None
    remote_flag: bool = False
    seniority_hint: str | None = None  # from the source's own experience field, when it has one
    drop_reason: str | None = None     # source-specific red flag (agency, expired, unpaid...)
    raw: dict = field(default_factory=dict)


def html_to_text(raw: str | None) -> str:
    text = html.unescape(raw or "")
    text = re.sub(r"<\s*(br|/p|/li|/h\d|/div)\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<\s*li[^>]*>", "• ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)  # Greenhouse double-escapes content
    text = re.sub(r"[ \t ]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def where(p: Posting) -> tuple[bool, bool]:
    """-> (keep, remote). India locations are kept; remote only if open to India."""
    loc = p.location or ""
    if INDIA.search(loc):
        return True, bool(REMOTE.search(loc)) or p.remote_flag
    if REMOTE.search(loc) or p.remote_flag:
        if REMOTE_OPEN_TO_INDIA.search(loc):
            return True, True
        # Plain "Remote" (or a remote flag with no location) is kept; a remote role pinned
        # to some other place ("San Francisco, CA", "Remote - US") is not.
        leftover = REMOTE.sub("", loc).strip(" ,-/()|")
        if not leftover and not REMOTE_ELSEWHERE.search(loc):
            return True, True
    return False, False


def is_tech(title: str) -> bool:
    return bool(TECH_TITLE.search(title)) and not NON_TECH.search(title)


def seniority(title: str) -> str:
    if INTERN.search(title):
        return "intern"
    if SENIOR.search(title):
        return "senior"
    if ENTRY.search(title):
        return "entry"
    if re.search(r"\b(ii|2)\b", title, re.I):
        return "mid"
    return "unknown"


def dedupe_key(company: str, title: str, location: str) -> str:
    def norm(s: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
    city = INDIA.search(location or "")
    return f"{norm(company)}|{norm(title)}|{city.group().lower() if city else 'remote'}"


# ── Genuineness: fewer, real jobs beat many questionable ones ────────
AGENCY = re.compile(r"\b(staffing|recruit\w*|placements?|manpower|talent\w*|hiring|hr solutions|hr services|"
                    r"outsourcing|jobs|careers|headhunt\w*)\b|flexiple|scoutit|joblet", re.I)
SCAM = re.compile(r"registration fee|training fee|security deposit|processing fee|pay (?:rs\.?|₹|inr)\s*\d|"
                  r"earn (?:up ?to|upto)|whats ?app (?:us|me|on)|no interview|100% job guarantee|"
                  r"guaranteed (?:job|placement)", re.I)
MIN_DESCRIPTION = 200


def not_genuine(p: Posting) -> str | None:
    """Why this posting shouldn't reach a student, or None if it looks genuine."""
    if p.drop_reason:
        return p.drop_reason
    company = (p.company or "").strip()
    if not company or company.lower() in {"unknown", "confidential", "company"}:
        return "unknown company"
    if AGENCY.search(company):
        return "staffing or recruitment agency"
    if len(p.description or "") < MIN_DESCRIPTION:
        return "description too short"
    if SCAM.search(p.description):
        return "payment or spam signals"
    return None
