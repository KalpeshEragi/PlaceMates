"""Shared context every agent step receives.

Bump PROMPT_VERSION whenever this file or a step prompt changes in a way that
affects output. Facts and briefs record it, so versions can be compared.
"""

PROMPT_VERSION = "profile-agent-v2"

# ── Sections, in the order the agent walks through them ──────────────
SECTIONS: list[tuple[str, str]] = [
    ("personal", "Personal information"),
    ("education", "Education"),
    ("skills", "Skills"),
    ("projects", "Projects"),
    ("experience", "Professional experience"),
    ("research", "Research experience"),
    ("achievements", "Achievements and certifications"),
    ("additional", "Additional information"),
]
SECTION_LABEL = dict(SECTIONS)

# Profile item kind -> (section, rubric type)
KIND_SECTION: dict[str, tuple[str, str]] = {
    "education": ("education", "education"),
    "project": ("projects", "project"),
    "experience": ("experience", "experience"),
    "research": ("research", "research"),
    "certification": ("achievements", "achievement"),
    "award": ("achievements", "achievement"),
    "other": ("additional", "other"),
}

# ── Completeness rubrics: POSSIBLE dimensions per entity type ────────
# Canonical keys. The analyst picks the ones relevant to each entity and may add
# up to 3 entity-specific keys (e.g. agent_communication for a multi-agent system).
# Facts are stored as "<dimension>.<name>", e.g. "evaluation.metric".
RUBRICS: dict[str, dict[str, str]] = {
    "project": {
        "problem_statement": "Problem statement",
        "objective": "Project objective",
        "core_functionality": "Core functionality",
        "architecture": "Architecture and component interactions",
        "tech_usage": "How each technology is used",
        "individual_contribution": "Your individual contribution",
        "challenges": "Engineering challenges",
        "design_decisions": "Technical decisions and trade-offs",
        "evaluation": "Evaluation methodology",
        "dataset_or_testing": "Dataset or testing setup",
        "results_metrics": "Results and performance metrics",
        "scale_usage": "Scale and actual usage",
        "deployment": "Deployment and production readiness",
        "limitations": "Limitations and possible improvements",
    },
    "experience": {
        "responsibilities": "Role and responsibilities",
        "systems_built": "Systems or features developed",
        "individual_contribution": "Your individual contribution",
        "tech_usage": "How technologies were used",
        "architecture_decisions": "Architecture and engineering decisions",
        "challenges": "Challenges solved",
        "scale_impact": "Scale and business impact",
        "results_metrics": "Performance and measurable outcomes",
        "deployment_operations": "Deployment and operational results",
    },
    "research": {
        "research_question": "Research question",
        "methodology": "Methodology",
        "dataset": "Dataset or corpus",
        "data_sources": "Data sources",
        "experimental_setup": "Experimental setup",
        "baselines": "Baselines",
        "evaluation_metrics": "Evaluation metrics",
        "results": "Results",
        "limitations": "Limitations",
        "reproducibility": "Reproducibility",
    },
    "education": {
        "qualification": "Degree, branch and institution",
        "grades": "Grades (CGPA or percentage)",
        "graduation": "Graduation year or expected date",
        "academic_history": "Academic history (e.g. backlogs, if relevant)",
        "coursework": "Relevant coursework",
    },
    "personal": {
        "professional_links": "GitHub, LinkedIn or portfolio links",
        "location": "Current location or preferred locations",
        "headline": "Professional headline",
    },
    "skills": {
        "coverage": "Skills you actually use",
        "proficiency": "Comfort level with key skills",
        "tools_platforms": "Tools and platforms",
    },
    "achievement": {
        "what": "What it recognises",
        "issuer_event": "Issuer or event",
        "date": "Date",
        "significance": "Selectivity or rank",
    },
    "other": {
        "relevance": "Relevance to tech roles",
        "details": "Details",
    },
}

# Information state of a dimension (what we know) vs conversation state (what we discussed).
INFO_STATES = ("COMPLETE", "PARTIAL", "MISSING", "SKIPPED", "NOT_APPLICABLE")
CONVO_STATES = ("NOT_EXPLORED", "SUGGESTED", "SELECTED", "IN_PROGRESS", "EXPLORED", "SKIPPED")

# What recruiters look for in entry-level candidates, per role. Kept as data so
# it can later be refreshed from real job descriptions.
ROLE_SIGNALS: dict[str, str] = {
    "Backend": "APIs, databases and schema design, scale (users, requests, data), performance, reliability, auth",
    "Frontend": "framework depth, UI complexity, performance (load time), accessibility, state management, real users",
    "Full-stack": "end-to-end ownership, API + UI, deployment, auth, database, real users",
    "Mobile": "platform (Android/iOS/Flutter/React Native), offline/sync, store release, installs, performance",
    "Data / ML / AI": "dataset (source, size), model choice, metrics (accuracy, F1, etc.), baseline comparison, deployment",
    "DevOps / Cloud": "CI/CD, containers, cloud services, infrastructure as code, monitoring, uptime, automation saved time",
    "QA / Test": "test types (unit, integration, e2e), automation frameworks, coverage, bugs found, CI integration",
    "Cybersecurity": "tools (Burp, Wireshark, nmap), vulnerabilities found, CTFs, certifications, secure design",
    "Data Engineering": "pipelines, batch vs streaming, data volume, tools (Spark, Airflow, Kafka), data quality",
    "IT Support": "systems supported, ticket volume, tools, users helped, uptime, documentation",
}

DOMAIN_CONTEXT = f"""You are part of PlaceMates, which helps software and IT students and freshers
(0-2 years, mostly in India) build strong, honest resumes for internships and
entry-level roles.

Roles we cover and what recruiters look for in each:
{chr(10).join(f"- {role}: {signals}" for role, signals in ROLE_SIGNALS.items())}

Indian context: CGPA or percentage matters. Internships, hackathons (e.g. SIH),
open source (e.g. GSoC) and competitive coding ratings are strong signals.

Non-tech items (volunteering, part-time jobs, clubs): only care about
transferable skills - leadership, teamwork, communication. Keep it light.

Philosophy: this is NOT truth verification. You help students articulate work they
really did. Understand what already exists; ask only for what is genuinely worth adding.
Never re-ask what the profile already says. Optional details are never mandatory.

Honesty rules (never break these):
- Never suggest, assume or record a claim the user did not give.
- Prefer ranges to exact numbers. "Not measured" is a perfectly fine answer.
- Never invent numbers or percentages in options or facts.
- Do not collect personal information beyond what a resume needs.

Tone: short, warm, plain words a student would use. Say "adding X could make Y clearer",
never "your project is incomplete" or "you must"."""
