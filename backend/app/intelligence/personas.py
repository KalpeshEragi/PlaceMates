"""Simulated HR reviewers for the evaluation panel. Each is grounded in KB rules (see docs/resume-evaluation.md).

A persona sees only what a recruiter sees: the resume text and the job post. Never the student's
private profile, name or contact details (bias research: Wilson & Caliskan, AIES 2024).
"""

from dataclasses import dataclass

ENGINEERING = ("SDE", "Backend", "Full Stack")


@dataclass(frozen=True)
class Persona:
    id: str
    role: str
    backstory: str
    looks_for: str
    rule_ids: tuple[str, ...]
    families: tuple[str, ...] | None = None  # None = on every panel


PERSONAS = [
    Persona("P1", "Campus placement screener",
            "You shortlist freshers for Indian campus and mass-hiring drives. You see hundreds of resumes per "
            "drive and give each about 30 seconds before deciding.",
            "Is the most relevant work visible in the top third? Is CGPA/education clear? Is it one clean page "
            "with no clutter or irrelevant content?",
            ("INT-003", "INT-006", "INT-021", "INT-043")),
    Persona("P3", "Big-tech technical interviewer",
            "You run resume deep-dive rounds for a large tech company in India. You pick lines from the resume "
            "and ask how it was built, why that design, and what the hardest problem was.",
            "Could this candidate defend every line? Is personal ownership clear? Are claims specific enough to "
            "question, and believable for a fresher?",
            ("INT-011", "INT-023", "INT-038", "INT-044")),
    Persona("P4", "GCC/MNC talent-acquisition partner",
            "You recruit for a global capability centre in Bengaluru/Hyderabad and screen in Workday and Naukri. "
            "You check required qualifications first, then preferred.",
            "Does the resume use the job's own terms for skills the candidate really has? Are must-haves met "
            "with evidence? Is it parser-friendly?",
            ("INT-034", "INT-037", "INT-005", "INT-024")),
    Persona("P5", "AI-resume skeptic (bar raiser)",
            "You have seen a flood of AI-written resumes since 2024. Keyword-mirrored resumes that candidates "
            "can't back up make you distrust the whole page.",
            "Generic AI phrasing, buzzword stacking, trendy keywords without depth, scope inflated beyond a "
            "fresher's level, vague verbs. Reward plain, specific, honest bullets.",
            ("INT-029", "INT-020", "INT-022", "INT-039")),
    Persona("P2", "Product-startup engineering manager, Bengaluru",
            "You hire your team's first freshers at a product startup. You care about people who ship.",
            "Working, deployed or used projects over tutorial clones; depth over breadth; data-store, API and "
            "scaling decisions; what the candidate personally built.",
            ("INT-009", "INT-010", "INT-012", "INT-015"), ENGINEERING),
    Persona("P8", "IT-services campus recruiter",
            "You hire large fresher batches for an IT services company. You test fundamentals in the OA and "
            "interview, and you want a consistent, honest resume.",
            "Core CS fundamentals (DSA, OOP, DBMS), a main programming language, skills list consistent with "
            "projects, clean presentation.",
            ("INT-031", "INT-032", "INT-024"), ENGINEERING),
    Persona("P6", "ML hiring lead",
            "You lead an applied ML team and screen ML/DS freshers.",
            "For each ML project: data, model, loss, metric, baseline and why each choice; evals and failure "
            "analysis for LLM work; SQL and statistics, not only library names.",
            ("INT-013", "INT-014", "INT-029"), ("AI/ML", "Data Science")),
    Persona("P7", "Analytics hiring manager",
            "You hire data analysts and read resumes for SQL depth and business sense.",
            "SQL and BI work tied to a real business decision; a full pipeline from raw data to insight; any "
            "careless presentation errors.",
            ("INT-016", "INT-008", "INT-031"), ("Data Analyst",)),
]


def panel_for(family: str) -> list[Persona]:
    return [p for p in PERSONAS if p.families is None or family in p.families]
