"""The resume crew (CrewAI): job analyst -> evidence selector -> writer -> critic.

    LangGraph/API decides WHICH jobs get a resume; this crew writes ONE tailored resume.
    Agents pass structured outputs (pydantic). The writer has one tool:
        search_exemplars   strong bullets from real resumes that passed screens (style only)
    Keyword coverage is measured in code and handed to the critic (more reliable than a tool call).
    If the critic fails the draft, the writer revises (at most MAX_REVISIONS times).
    Finally code enforces truth: no number or technology that isn't in the student's facts.
"""

import json
import logging
import os
import time

os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

from crewai import LLM, Agent, Crew, Task  # noqa: E402
from crewai.tools import tool  # noqa: E402

from app.agent.domain import DOMAIN_CONTEXT  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.services.matching import exemplars  # noqa: E402
from app.services.resume.checks import enforce_truth, keyword_coverage, resume_text, score  # noqa: E402
from app.services.resume.schemas import Critique, JobBrief, ResumeDraft, Selection  # noqa: E402

log = logging.getLogger(__name__)
MAX_REVISIONS = 1  # more rounds rarely help without new facts, and each costs ~40-60 s

HONESTY = ("Use ONLY the student's facts given to you. Never add a number, tool, user count or result that is not in "
           "the facts. Rephrasing is fine; inventing is not. If a fact is missing, write the bullet without it.")


def _groq(model: str) -> LLM:
    # Groq speaks the OpenAI API, so CrewAI's OpenAI provider is pointed at Groq's endpoint.
    return LLM(model=f"openai/{model}", base_url=settings.groq_base_url, api_key=settings.groq_api_key,
               temperature=0.2, max_tokens=6000)  # structured output can be long; avoid cut-off JSON


# When Gemini reports its daily quota used up, skip it until this time (epoch seconds).
_gemini_blocked_until = 0.0


def _gemini_ok() -> bool:
    return bool(settings.gemini_api_key) and time.time() >= _gemini_blocked_until


def _quota_error(err: Exception) -> bool:
    text = str(err)
    return "RESOURCE_EXHAUSTED" in text or "429" in text or "quota" in text.lower()


def _writer_llm(use_gemini: bool = True) -> LLM:
    # Gemini writes best, but its free tier allows only ~20 requests/day; Groq is the fallback.
    if use_gemini and settings.gemini_api_key:
        try:
            # Tool calling needs Gemini's v1beta API; this CrewAI version otherwise ends up on v1.
            return LLM(model="gemini/gemini-2.5-flash", api_key=settings.gemini_api_key, temperature=0.4,
                       client_params={"http_options": {"api_version": "v1beta"}})
        except Exception as err:  # noqa: BLE001 - provider package missing etc.: fall back
            log.warning("Gemini writer unavailable (%s); using Groq", err)
    return _groq(settings.model_extract)


@tool("search_exemplars")
def search_exemplars(query: str, section: str = "project") -> str:
    """Find strong bullets from real resumes that passed screens, similar to `query`.
    section is 'project' or 'experience'. Use them for STYLE only (structure, verbs, specificity);
    never copy their facts or numbers."""
    with SessionLocal() as db:
        found = exemplars.search(db, query, section=section if section in ("project", "experience") else None, k=4)
        return "\n".join(f"- {b.text}" for b in found) or "(no examples found)"


def _agents(use_gemini: bool = True) -> tuple[Agent, Agent, Agent, Agent]:
    analyst = Agent(
        role="Job analyst",
        goal="Understand exactly what this job needs from an entry-level candidate",
        backstory=f"{DOMAIN_CONTEXT}\nYou read job descriptions the way a technical recruiter does.",
        llm=_groq(settings.model_questions), allow_delegation=False, verbose=False)
    selector = Agent(
        role="Evidence selector",
        goal="Choose the student's projects, experience and skills that best prove fit for this job",
        backstory="You know which past work convinces a recruiter for a given role. You only choose; you never write.",
        llm=_groq(settings.model_questions), allow_delegation=False, verbose=False)
    writer = Agent(
        role="Resume writer",
        goal="Write a tailored, specific, honest one-page resume for this job",
        backstory=("You write bullets like the best real resumes that passed screens at top companies: a specific "
                   "action verb, what was built, the tools, and the scale or result. You always improve weak "
                   "wording (never 'Worked on', 'Helped', 'Made'), using only facts you were given. " + HONESTY),
        llm=_writer_llm(use_gemini), tools=[search_exemplars], allow_delegation=False, verbose=False)
    critic = Agent(
        role="Recruiter and fact checker",
        goal="Decide whether a recruiter for this job would shortlist the draft, and list concrete fixes",
        backstory=("You are a technical recruiter who screens hundreds of entry-level resumes. You are strict about "
                   "vague bullets, missing must-have skills, and any claim not supported by the student's facts. "
                   "Your fixes must use only the student's facts: never suggest a number, tool or result they don't "
                   "have. If a bullet needs a detail that isn't in the facts, say 'ask the student for X'."),
        llm=_groq(settings.model_extract), allow_delegation=False, verbose=False)
    return analyst, selector, writer, critic


def review(critic: Agent, draft: ResumeDraft, brief: JobBrief, profile: str) -> Critique:
    """The critic judges the draft; keyword coverage is measured in code and handed to it."""
    coverage = keyword_coverage(resume_text(draft), brief)
    task = Task(
        description=(
            "Review this draft for the job.\n"
            f"Job brief:\n{brief.model_dump_json()}\n"
            f"Draft:\n{draft.model_dump_json()}\n"
            f"Must-have coverage (measured by code): {json.dumps(coverage)}\n"
            "Flag vague bullets, missing must-haves the student actually has (check the profile), irrelevant items, "
            f"and any claim not in the student's facts.\nStudent profile:\n{profile}"),
        expected_output="A Critique", agent=critic, output_pydantic=Critique)
    Crew(agents=[critic], tasks=[task], verbose=False).kickoff()
    return task.output.pydantic


def _needs_student(issue) -> bool:
    return "ask the student" in f"{issue.fix} {issue.problem}".lower()


def _fixable(critique: Critique) -> bool:
    """True if at least one issue is something the writer can fix with the facts it already has."""
    return any(not _needs_student(i) for i in critique.issues)


def tailor(job: dict, items: dict[str, dict], skills: list[str]) -> dict:
    """job: {title, company, description}; items: item_id -> {item_id, kind, title, organization, dates, facts}.
    Tries the Gemini writer first; if Gemini's quota is used up, runs again with the Groq writer."""
    global _gemini_blocked_until
    if not _gemini_ok():
        return _tailor(job, items, skills, use_gemini=False)
    try:
        return _tailor(job, items, skills, use_gemini=True)
    except Exception as err:  # noqa: BLE001
        if not _quota_error(err):
            raise
        _gemini_blocked_until = time.time() + 3 * 3600  # free-tier daily quota: don't retry for a while
        log.warning("Gemini quota exhausted; using the Groq writer for the next 3 hours")
        return _tailor(job, items, skills, use_gemini=False)


def _tailor(job: dict, items: dict[str, dict], skills: list[str], use_gemini: bool) -> dict:
    started = time.time()
    analyst, selector, writer, critic = _agents(use_gemini)
    profile = json.dumps({"skills": skills, "items": list(items.values())}, default=str)
    job_text = f"{job['title']} at {job['company']}\n\n{job['description'][:4000]}"

    t_brief = Task(description=f"Analyse this job posting:\n{job_text}",
                   expected_output="A JobBrief", agent=analyst, output_pydantic=JobBrief)
    t_select = Task(
        description=("Using the job brief, choose 3-5 of the student's items (by item_id) and up to 14 skills that "
                     f"best prove fit. Leave out items unrelated to the job.\nStudent profile:\n{profile}"),
        expected_output="A Selection", agent=selector, output_pydantic=Selection, context=[t_brief])
    t_write = Task(
        description=("Write the tailored resume content for the selected items. For each item, first call "
                     "search_exemplars with a short description of it to see how strong real bullets are written. "
                     f"{HONESTY}\nStudent profile:\n{profile}"),
        expected_output="A ResumeDraft", agent=writer, output_pydantic=ResumeDraft, context=[t_brief, t_select])

    Crew(agents=[analyst, selector, writer], tasks=[t_brief, t_select, t_write], verbose=False).kickoff()
    brief, selection, draft = t_brief.output.pydantic, t_select.output.pydantic, t_write.output.pydantic
    chosen = {i.item_id for i in selection.items}

    def keep_selected(d: ResumeDraft) -> ResumeDraft:
        d.items = [i for i in d.items if i.item_id in chosen] or d.items  # the selector decides what's shown
        return d

    draft = keep_selected(draft)
    critique = review(critic, draft, brief, profile)
    rounds = [{"round": 0, "critic_passed": critique.passed, "issues": [i.model_dump() for i in critique.issues]}]

    for round_no in range(1, MAX_REVISIONS + 1):
        if critique.passed or not _fixable(critique):
            break  # nothing the writer can fix without new facts from the student
        t_fix = Task(
            description=("Revise this draft to fix the recruiter's issues. Where an issue needs a detail only the "
                         "student can give, still write the strongest honest bullet from the facts you have (specific "
                         "verb, what was built, the item's tech stack) - just don't invent the missing detail. Never "
                         f"start a bullet with 'Worked on' or 'Helped'. {HONESTY}\n"
                         f"Draft:\n{draft.model_dump_json()}\nIssues:\n{critique.model_dump_json()}\n"
                         f"Job brief:\n{brief.model_dump_json()}\nStudent profile:\n{profile}"),
            expected_output="A revised ResumeDraft", agent=writer, output_pydantic=ResumeDraft)
        Crew(agents=[writer], tasks=[t_fix], verbose=False).kickoff()
        revised = keep_selected(t_fix.output.pydantic)
        if resume_text(revised) == resume_text(draft):
            break  # the writer can't improve it further without new facts
        draft = revised
        critique = review(critic, draft, brief, profile)
        rounds.append({"round": round_no, "critic_passed": critique.passed,
                       "issues": [i.model_dump() for i in critique.issues]})

    draft, dropped = enforce_truth(draft, items, skills)
    # Details only the student can supply: shown to them, and a hint for the profile agent.
    # Explicit "ask the student" notes, plus bullet problems still open after the writer's revisions.
    final_text = resume_text(draft)
    ask_student = [i.fix if _needs_student(i) else i.problem for i in critique.issues
                   if _needs_student(i) or (not critique.passed and i.where and i.where in final_text)]
    return {"brief": brief.model_dump(), "selection": selection.model_dump(), "draft": draft.model_dump(),
            "critic": critique.model_dump(), "dropped_for_truth": dropped, "ask_student": ask_student,
            "score": score(draft, brief, dropped), "rounds": rounds,
            "writer_model": "gemini-2.5-flash" if use_gemini and settings.gemini_api_key else settings.model_extract,
            "seconds": round(time.time() - started, 1), "text": resume_text(draft)}
