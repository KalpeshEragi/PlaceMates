"""The resume crew (CrewAI): four agents write and judge ONE tailored resume.

    1. Resume Analysis Agent    reads the job and the student's facts: must-haves, strengths, gaps, questions
    2. Resume Strategy Agent    decides what to show, in what order, with what angle, for this job and market
    3. Resume Generation Agent  writes the bullets (style from real resumes via search_exemplars), each with
                                the fact it rests on
    4. Resume Evaluation Agent  an ATS stage in code, then a panel of HR persona agents (docs/resume-evaluation.md)

Every agent gets only the knowledge-base rules for its job and the role family (app.intelligence.kb).
The strategy agent also sees live market signals from fetched jobs (app.intelligence.market).
Code checks (truth, unconfirmed claims, weak bullets, ATS) drive one revision; the HR panel then judges
the final version once (a panel per revision cost twice the tokens and did not raise the panel score).
Finally code enforces truth: no number or technology that isn't in the student's facts.
"""

import json
import logging
import os
import re
import tempfile
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

from crewai import LLM, Agent, Crew, Task  # noqa: E402
from crewai.tools import tool  # noqa: E402

from app.agent.domain import DOMAIN_CONTEXT  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.intelligence import kb, market  # noqa: E402
from app.intelligence.personas import Persona, panel_for  # noqa: E402
from app.services.matching import exemplars  # noqa: E402
from app.services.resume import ats  # noqa: E402
from app.services.resume.checks import (avg_bullet_quality, enforce_truth, facts_text, resume_text,  # noqa: E402
                                        unsupported_claims)
from app.services.resume.schemas import (Analysis, Bullet, DraftItem, PersonaVerdict,  # noqa: E402
                                         ResumeDraft, Strategy)

log = logging.getLogger(__name__)
MAX_REVISIONS = 1  # more rounds rarely help without new facts

HONESTY = ("Use ONLY the student's facts given to you. Never add a number, tool, user count or result that is not in "
           "the facts. Rephrasing is fine; inventing is not. If a fact is missing, write the bullet without it. "
           "Keep every number the facts give (e.g. '20%', '25 patents'): verified numbers are the strongest "
           "evidence on the page. Verified student facts always override general hiring advice.")


def _groq(model: str, temperature: float = 0.2, reasoning: str | None = None) -> LLM:
    # Groq speaks the OpenAI API, so CrewAI's OpenAI provider is pointed at Groq's endpoint.
    # gpt-oss "thinking" tokens count toward Groq's free 200k tokens/day per model, so judges and
    # planners think "low"; the writer keeps the default.
    extra = {"reasoning_effort": reasoning} if reasoning else {}
    return LLM(model=f"openai/{model}", base_url=settings.groq_base_url, api_key=settings.groq_api_key,
               temperature=temperature, max_tokens=6000, **extra)  # long structured output: avoid cut-off JSON


# When Gemini reports its daily quota used up, skip it until this time (epoch seconds).
# Kept in a temp file so a restart doesn't burn ~10 failing calls finding out again.
_BLOCK_FILE = Path(tempfile.gettempdir()) / "placemates_gemini_blocked_until"


def _blocked_until() -> float:
    try:
        return float(_BLOCK_FILE.read_text())
    except (OSError, ValueError):
        return 0.0


def _block_gemini(hours: float) -> None:
    _BLOCK_FILE.write_text(str(time.time() + hours * 3600))


def _gemini_ok() -> bool:
    return bool(settings.gemini_api_key) and time.time() >= _blocked_until()


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
    """Find strong bullets from real 2024-2026 resumes that got interviews or offers, similar to `query`.
    section is 'project' or 'experience'. Use them for STYLE only (structure, verbs, specificity);
    never copy their facts or numbers."""
    with SessionLocal() as db:
        found = exemplars.search(db, query, section=section if section in ("project", "experience") else None, k=4)
        return "\n".join(f"- {b.text}" for b in found) or "(no examples found)"


def evidence_map(items: dict[str, dict], skills: list[str]) -> dict[str, list[str]]:
    """skill -> item_ids whose facts mention it (KB INT-001: every listed skill needs a place it was used)."""
    texts = {k: v.lower() for k, v in facts_text(items, skills).items() if k != "*"}
    return {s: [i for i, t in texts.items() if re.search(rf"(?<![\w.+#]){re.escape(s.lower())}(?![\w+#])", t)]
            for s in skills}


def render(draft: ResumeDraft, items: dict[str, dict], education: list[dict]) -> tuple[str, str]:
    """Plain single-column resume text as a recruiter would read it, plus the headings line (for ATS titles)."""
    lines, headings = ["SUMMARY", draft.summary, "", "SKILLS", ", ".join(draft.skills), ""], []
    by_kind = defaultdict(list)
    for d in draft.items:
        if d.item_id in items:
            by_kind[items[d.item_id]["kind"]].append(d)
    for kind, label in (("experience", "EXPERIENCE"), ("research", "RESEARCH"), ("project", "PROJECTS")):
        if not by_kind.get(kind):
            continue
        lines.append(label)
        for d in by_kind[kind]:
            it = items[d.item_id]
            head = " | ".join(x for x in (it.get("title"), it.get("organization"), it.get("dates")) if x)
            headings.append(head)
            lines += [head, *(f"- {b.text}" for b in d.bullets)]
        lines.append("")
    if education:
        lines.append("EDUCATION")
        for e in education:
            grade = next((f["value"] for f in e.get("facts", []) if f["field"].lower() in ("cgpa", "gpa", "grade",
                                                                                           "percentage", "score")), None)
            lines.append(" | ".join(str(x) for x in (e.get("title"), e.get("organization"), e.get("dates"), grade) if x))
    return "\n".join(lines).strip(), " ".join(headings)


# ---------- 4. Evaluation: ATS stage + HR persona panel ----------

def _persona_agent(p: Persona, model: str) -> Agent:
    rules = "\n".join(f"- {r['principle']}: {r['rule']}" for r in kb.rules_by_id(list(p.rule_ids)))
    return Agent(
        role=p.role, goal="Decide, as you really would, whether to move this fresher forward for this job",
        backstory=(f"{p.backstory}\nYou look for: {p.looks_for}\nWhat recent hiring evidence says about your "
                   f"priorities:\n{rules}\nYou only see the resume and the job. Judge fairly; do not reward length "
                   "or buzzwords. Your fixes may only rearrange or reword what is on the page; if a fix needs a "
                   "detail that isn't there, write 'ask the student for X'. Never invent numbers or tools."),
        llm=_groq(model, temperature=0.3, reasoning="low"), allow_delegation=False, verbose=False)


def _judge(p: Persona, model: str, resume: str, job: dict, brief_json: str, ats_line: str) -> dict:
    agent = _persona_agent(p, model)
    extra = f"\nYour ATS shows: {ats_line}" if p.id == "P4" else ""
    task = Task(
        description=(f"Job: {job['title']} at {job['company']}\nKey requirements (parsed): {brief_json}\n"
                     f"Job post (start):\n{job['description'][:1500]}\n{extra}\n\nResume:\n{resume}\n\n"
                     "Give your decision, 1-10 scores, strengths, up to 4 concerns (quote the exact bullet in "
                     "'where'), and 2-3 interview questions you would ask."),
        expected_output="A PersonaVerdict", agent=agent, output_pydantic=PersonaVerdict)
    try:
        Crew(agents=[agent], tasks=[task], verbose=False).kickoff()
        return {"id": p.id, "role": p.role, "model": model, "verdict": task.output.pydantic.model_dump()}
    except Exception as err:  # noqa: BLE001 - one reviewer failing shouldn't sink the panel
        log.warning("Persona %s failed: %s", p.id, err)
        return {"id": p.id, "role": p.role, "model": model, "error": str(err)[:200]}


def _needs_student(issue: dict) -> bool:
    return "ask the student" in f"{issue['fix']} {issue['problem']}".lower()


def _norm(where: str) -> str:
    return re.sub(r"\W+", " ", where.lower()).strip()[:80]


def evaluate(draft: ResumeDraft, items: dict, education: list[dict], analysis: Analysis, job: dict,
             family: str) -> dict:
    text, headings = render(draft, items, education)
    stage1 = ats.evaluate(text, headings, analysis.job, job["title"], job["description"], bool(education))
    ats_line = f"{stage1['tier']} match, grade {stage1['grade']}, required skills not found: " \
               f"{', '.join(stage1['required_missing']) or 'none'}"
    panel = panel_for(family)
    # Two Groq models have separate rate limits: split the panel across them and run both halves at once.
    models = [settings.model_questions, settings.model_extract]
    halves = [[(p, models[i % 2]) for i, p in enumerate(panel) if i % 2 == h] for h in (0, 1)]
    brief_json = analysis.job.model_dump_json()

    def run(half):
        return [_judge(p, m, text, job, brief_json, ats_line) for p, m in half]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [r for half in pool.map(run, halves) for r in half]
    results.sort(key=lambda r: r["id"])
    ok = [r for r in results if "verdict" in r]

    criteria = ["relevance", "evidence", "depth", "credibility", "clarity"]
    avg = {c: round(sum(r["verdict"]["scores"][c] for r in ok) / len(ok), 1) for c in criteria} if ok else {}
    panel_score = round(sum(avg.values()) / len(avg) * 10) if avg else 0
    votes = {d: sum(r["verdict"]["decision"] == d for r in ok) for d in ("shortlist", "maybe", "reject")}

    grouped: dict[str, dict] = {}
    for r in ok:
        for c in r["verdict"]["concerns"]:
            g = grouped.setdefault(_norm(c["where"]), {**c, "raised_by": []})
            if r["id"] not in g["raised_by"]:
                g["raised_by"].append(r["id"])
    concerns = sorted(grouped.values(), key=lambda g: -len(g["raised_by"]))
    questions = list(dict.fromkeys(q for r in ok for q in r["verdict"]["interview_questions"]))
    return {"ats": stage1, "text": text,
            "panel": {"reviewers": results, "votes": votes, "criteria": avg, "score": panel_score,
                      "consensus": [c for c in concerns if len(c["raised_by"]) >= 2], "concerns": concerns},
            "interview_prep": questions[:10]}


def final_score(ev: dict, dropped: list[dict], draft: ResumeDraft, claims: list[dict] | None = None) -> dict:
    # Dropped bullets (invented numbers/tech) cost 5; unconfirmed result claims cost 3. At most 20.
    penalty = min(len(dropped) * 5 + len(claims or []) * 3, 20)
    total = max(round(0.3 * ev["ats"]["score"] + 0.7 * ev["panel"]["score"]) - penalty, 0)
    return {"score": total, "band": "Strong" if total >= 75 else "Good" if total >= 55 else "Needs work",
            "ats": ev["ats"]["score"], "panel": ev["panel"]["score"], "truth_penalty": penalty,
            "weights": {"ats": 0.3, "panel": 0.7}, "shortlist_votes": ev["panel"]["votes"],
            "avg_bullet_quality": avg_bullet_quality(draft)}


# ---------- the run ----------

def _agents(family: str, use_gemini: bool) -> tuple[Agent, Agent, Agent]:
    analyst = Agent(
        role="Resume Analysis Agent",
        goal="Understand exactly what this job needs and what verified evidence the student has for it",
        backstory=(f"{DOMAIN_CONTEXT}\nYou read job posts like a technical recruiter and a student's record like a "
                   f"careful mentor. Hiring evidence you follow:\n{kb.render(kb.rules_for('analysis', family, 8))}"),
        llm=_groq(settings.model_questions, reasoning="low"), allow_delegation=False, verbose=False)
    strategist = Agent(
        role="Resume Strategy Agent",
        goal="Decide what this resume shows, in what order and with what emphasis, for this job in this market",
        backstory=("You plan resumes for Indian fresher tech hiring. You tailor by choosing the right evidence, not by "
                   "rewording. You only plan; you never write bullets. Hiring evidence you follow:\n"
                   f"{kb.render(kb.rules_for('strategy', family, 10))}"),
        llm=_groq(settings.model_questions, reasoning="low"), allow_delegation=False, verbose=False)
    writer = Agent(
        role="Resume Generation Agent",
        goal="Write a tailored, specific, honest one-page resume following the strategy",
        backstory=("You write bullets like the best real resumes that got interviews: a specific action verb, what "
                   "was built, how (key tech or decision), and the verified result or scope. You always improve weak "
                   "wording (never 'Worked on', 'Helped', 'Made'). Hiring evidence you follow:\n"
                   f"{kb.render(kb.rules_for('generation', family, 10))}\nHard rules: "
                   f"{' '.join(kb.hard_constraints())} {HONESTY}"),
        llm=_writer_llm(use_gemini), tools=[search_exemplars], allow_delegation=False, verbose=False)
    return analyst, strategist, writer


def tailor(job: dict, items: dict[str, dict], skills: list[str], education: list[dict] | None = None) -> dict:
    """job: {title, company, description}; items: item_id -> {item_id, kind, title, organization, dates, facts}.
    Tries the Gemini writer first; if Gemini's quota is used up, runs again with the Groq writer."""
    education = education or []
    if not _gemini_ok():
        return _tailor(job, items, skills, education, use_gemini=False)
    try:
        return _tailor(job, items, skills, education, use_gemini=True)
    except Exception as err:  # noqa: BLE001
        if not _quota_error(err):
            raise
        _block_gemini(3)  # free-tier daily quota: don't retry for a while
        log.warning("Gemini quota exhausted; using the Groq writer for the next 3 hours")
        return _tailor(job, items, skills, education, use_gemini=False)


def _tailor(job: dict, items: dict[str, dict], skills: list[str], education: list[dict], use_gemini: bool) -> dict:
    started = time.time()
    family = kb.role_family(job["title"], job["description"])
    with SessionLocal() as db:
        signals = market.signals(db, family)
    analyst, strategist, writer = _agents(family, use_gemini)
    profile = json.dumps({"skills": skills, "items": list(items.values())}, default=str)
    evidence = evidence_map(items, skills)
    job_text = f"{job['title']} at {job['company']}\n\n{job['description'][:4000]}"

    t_analysis = Task(
        description=(f"Analyse this job posting and the student's record.\nJob:\n{job_text}\n\nStudent profile:\n"
                     f"{profile}\nWhere each listed skill was used (computed): {json.dumps(evidence)}\n"
                     "Questions that usually uncover missing detail:\n- " + "\n- ".join(kb.question_bank())),
        expected_output="An Analysis", agent=analyst, output_pydantic=Analysis)
    t_strategy = Task(
        description=("Plan this one-page resume. Choose items by item_id: EVERY internship/experience and EVERY award "
                     "(recruiters weigh them most for freshers; KB INT-002), plus the 2-3 projects most relevant to the "
                     "job, internships first. Pick the skills to list (only skills with evidence, using the job's "
                     "wording for the same skill), and the angle for each item. Cite the rule ids you followed.\n"
                     f"Market right now: {market.render(signals)}\nStudent profile:\n{profile}\n"
                     f"Where each skill was used: {json.dumps(evidence)}"),
        expected_output="A Strategy", agent=strategist, output_pydantic=Strategy, context=[t_analysis])
    t_write = Task(
        description=("Write the resume content following the strategy. For each item, first call search_exemplars "
                     "with a short description of it to see how strong real bullets are written. For every bullet, "
                     f"say in based_on which fact supports it. {HONESTY}\nStudent profile:\n{profile}"),
        expected_output="A ResumeDraft", agent=writer, output_pydantic=ResumeDraft, context=[t_analysis, t_strategy])

    Crew(agents=[analyst, strategist, writer], tasks=[t_analysis, t_strategy, t_write], verbose=False).kickoff()
    analysis, strategy, draft = t_analysis.output.pydantic, t_strategy.output.pydantic, t_write.output.pydantic
    # Internships and awards always appear (KB INT-002), whatever the strategist picked.
    always = {i for i, it in items.items() if it["kind"] in ("experience", "award", "certification")}
    chosen = {i.item_id for i in strategy.items} | always

    # Job terms the student really has (in their skills list): always listed (KB INT-034), first.
    wanted = analysis.job.must_have + analysis.job.nice_to_have
    owned = [s for s in skills if any(s.lower() == w.lower() or s.lower() in w.lower().split() for w in wanted)]

    def keep_planned(d: ResumeDraft) -> ResumeDraft:
        d.items = [i for i in d.items if i.item_id in chosen] or d.items  # the strategy decides what's shown
        # A must-show item the writer skipped gets the student's own bullets, word for word.
        written = {i.item_id for i in d.items}
        for item_id in sorted(always - written, key=lambda i: list(items).index(i)):
            own = [str(f["value"]) for f in items[item_id]["facts"] if f["field"] in ("bullet", "detail")]
            if own:
                d.items.append(DraftItem(item_id=item_id, bullets=[Bullet(text=t, based_on="your own words")
                                                                   for t in own[:3]]))
        listed = {s.lower() for s in d.skills}
        d.skills = ([s for s in owned if s.lower() not in listed] + d.skills)[:20]
        return d

    def code_checks(d: ResumeDraft) -> dict:
        """Free checks (no LLM): truth, unconfirmed claims, weak bullets, ATS. Drive the revision."""
        d, dropped = enforce_truth(keep_planned(d), items, skills)
        claims = unsupported_claims(d, items)
        text, headings = render(d, items, education)
        stage1 = ats.evaluate(text, headings, analysis.job, job["title"], job["description"], bool(education))
        weak = [b.text for i in d.items for b in i.bullets if exemplars.bullet_quality(exemplars.bullet_parts(b.text)) < 0.4]
        issues = ([{"where": c["bullet"], "problem": f"claims {', '.join(c['words'])}, which the facts don't say",
                    "fix": "remove that claim; keep what the facts support"} for c in claims]
                  + [{"where": w, "problem": "weak bullet: vague verb or no tech/scope",
                      "fix": "start with a specific verb, name what was built and the tech, using the facts"}
                     for w in weak])
        # Higher is better: ATS match and bullet quality, minus honesty problems.
        value = stage1["score"] + 20 * avg_bullet_quality(d) - 5 * len(dropped) - 3 * len(claims)
        return {"draft": d, "dropped": dropped, "claims": claims, "ats": stage1, "issues": issues, "value": value}

    checked = code_checks(draft)
    rounds = [{"round": 0, "ats": checked["ats"]["score"], "unsupported_claims": len(checked["claims"]),
               "issues": len(checked["issues"])}]
    # One revision on what code found. (A panel-driven revision was tried: it cost a second full panel
    # and didn't raise the panel's own score, so the panel runs once, on the final version.)
    for round_no in range(1, MAX_REVISIONS + 1):
        if not checked["issues"]:
            break
        t_fix = Task(
            description=("Revise this draft to fix these issues. Where an issue needs a detail only the student can "
                         "give, still write the strongest honest bullet from the facts you have - just don't invent "
                         f"the missing detail. Keep based_on for every bullet. {HONESTY}\n"
                         f"Draft:\n{checked['draft'].model_dump_json()}\nIssues:\n{json.dumps(checked['issues'])}\n"
                         f"Strategy:\n{strategy.model_dump_json()}\nStudent profile:\n{profile}"),
            expected_output="A revised ResumeDraft", agent=writer, output_pydantic=ResumeDraft)
        Crew(agents=[writer], tasks=[t_fix], verbose=False).kickoff()
        revised = code_checks(t_fix.output.pydantic)
        rounds.append({"round": round_no, "ats": revised["ats"]["score"],
                       "unsupported_claims": len(revised["claims"]), "issues": len(revised["issues"])})
        if revised["value"] >= checked["value"]:
            checked = revised

    draft, dropped, claims = checked["draft"], checked["dropped"], checked["claims"]
    ev = evaluate(draft, items, education, analysis, job, family)

    ask = [f"Is this true: \"{c['bullet']}\"? If so, add it to your profile; otherwise we'll remove "
           f"'{', '.join(c['words'])}'." for c in claims]
    ask += [q for q in analysis.questions_for_student]
    ask += [c["fix"] for c in ev["panel"]["concerns"] if _needs_student(c)]
    ask += [f"Do you have experience with {s}? (the job requires it)" for s in ev["ats"]["required_missing"]]
    return {"role_family": family, "market": signals, "analysis": analysis.model_dump(),
            "strategy": strategy.model_dump(), "draft": draft.model_dump(), "evaluation": ev,
            "dropped_for_truth": dropped, "unsupported_claims": claims,
            "ask_student": list(dict.fromkeys(ask))[:12], "score": final_score(ev, dropped, draft, claims),
            "rounds": rounds,
            "writer_model": "gemini-2.5-flash" if use_gemini and settings.gemini_api_key else settings.model_extract,
            "seconds": round(time.time() - started, 1), "text": ev["text"]}
