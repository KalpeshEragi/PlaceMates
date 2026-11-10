"""The review that comes with each tailored resume, as its own PDF: how the resume matches the job,
what's missing, what each simulated recruiter thought, and what to confirm or prepare.
"""

import html

from app.services.resume.pdf import html_to_pdf

CSS = """
* { font-family: sans-serif; }
body { font-size: 10pt; line-height: 1.4; color: #1d1c3f; }
h1 { font-size: 17pt; margin: 0; }
.sub { color: #555; margin: 2pt 0 8pt 0; }
h2 { font-size: 11.5pt; margin: 12pt 0 4pt 0; padding-bottom: 2pt; border-bottom: 0.6pt solid #5a48c6; color: #3a2f8f; }
.score { font-size: 13pt; font-weight: bold; }
.ok { color: #2f6b3a; }
.miss { color: #a2401f; }
.muted { color: #666; }
.reviewer { margin: 6pt 0 2pt 0; }
ul { margin: 2pt 0 0 0; padding-left: 13pt; }
li { margin: 0 0 2pt 0; }
p { margin: 0 0 3pt 0; }
td { padding: 1pt 8pt 1pt 0; vertical-align: top; }
"""
DECISION = {"shortlist": "Would shortlist", "maybe": "Maybe", "reject": "Would not shortlist"}
SUB = {"required": "Required skills", "preferred": "Nice-to-have skills", "designation": "Job title words",
       "experience": "Experience asked", "education": "Education"}


def _e(v) -> str:
    return html.escape(str(v)) if v is not None else ""


def _list(values: list[str], cls: str, empty: str) -> str:
    if not values:
        return f"<p class='muted'>{_e(empty)}</p>"
    return "<ul>" + "".join(f"<li class='{cls}'>{_e(v)}</li>" for v in values) + "</ul>"


def _inline(values: list[str], cls: str, empty: str) -> str:
    """A skills list as one line, e.g. 'Python, LangChain, RAG'."""
    if not values:
        return f"<p class='muted'>{_e(empty)}</p>"
    return f"<p class='{cls}'>{_e(', '.join(values))}</p>"


def review_html(result: dict, job: dict, student: str) -> str:
    score = result.get("score", {})
    ev = result.get("evaluation", {})
    ats = ev.get("ats", {})
    panel = ev.get("panel", {})
    votes = score.get("shortlist_votes", {})
    out = [
        f"<h1>Resume review: {_e(job['title'])}</h1>",
        f"<p class='sub'>{_e(job['company'])} &middot; prepared for {_e(student)}</p>",
        f"<p class='score'>Overall {score.get('score')} / 100 ({_e(score.get('band'))})</p>",
        f"<p>ATS match {score.get('ats')} &middot; recruiter panel {score.get('panel')} &middot; "
        f"{votes.get('shortlist', 0)} shortlist, {votes.get('maybe', 0)} maybe, {votes.get('reject', 0)} reject"
        + (f" &middot; {score.get('truth_penalty')} points off for unconfirmed claims" if score.get("truth_penalty") else "")
        + "</p>",
        "<p class='muted'>Scores are a guide built from documented ATS behaviour and simulated recruiters, "
        "not a prediction of a shortlist.</p>",
    ]

    out.append("<h2>What the job asks for</h2>")
    out.append("<p><b>Required, on your resume</b></p>" + _inline(ats.get("required_found", []), "ok", "None matched yet."))
    out.append("<p><b>Required, missing</b></p>" + _inline(ats.get("required_missing", []), "miss", "Nothing missing."))
    if ats.get("preferred_found") or ats.get("preferred_missing"):
        out.append("<p><b>Nice to have, on your resume</b></p>" + _inline(ats.get("preferred_found", []), "ok", "None."))
        out.append("<p><b>Nice to have, missing</b></p>" + _inline(ats.get("preferred_missing", []), "miss", "None."))
    out.append("<p class='muted'>If you have a missing skill, add where you used it to your profile; the next resume "
               "will include it. Don't add skills you can't discuss in an interview.</p>")

    if ats:
        rows = "".join(f"<tr><td>{_e(SUB.get(k, k))}</td><td>{round(v * 100)}%</td></tr>"
                       for k, v in ats.get("sub_scores", {}).items())
        out.append(f"<h2>ATS check: {_e(ats.get('tier'))} match, grade {_e(ats.get('grade'))}</h2>"
                   f"<table>{rows}</table><p class='muted'>{_e(ats.get('note'))}</p>")

    reviewers = [r for r in panel.get("reviewers", []) if r.get("verdict")]
    if reviewers:
        out.append("<h2>What each recruiter thought</h2>")
        for r in reviewers:
            v = r["verdict"]
            s = v.get("scores", {})
            out.append(f"<p class='reviewer'><b>{_e(r['role'])}</b>: {_e(DECISION.get(v['decision'], v['decision']))}</p>"
                       f"<p>{_e(v.get('one_line'))}</p>"
                       f"<p class='muted'>Relevance {s.get('relevance')} &middot; evidence {s.get('evidence')} &middot; "
                       f"depth {s.get('depth')} &middot; credibility {s.get('credibility')} &middot; clarity {s.get('clarity')} (out of 10)</p>")
            if v.get("strengths"):
                out.append("<p><b>Strong</b></p>" + _list(v["strengths"][:3], "ok", ""))
            if v.get("concerns"):
                out.append("<p><b>Concerns</b></p>" + _list(
                    [f"{c['problem']} Fix: {c['fix']}" for c in v["concerns"][:3]], "miss", ""))

    if result.get("ask_student"):
        out.append("<h2>Confirm or add to your profile</h2>" + _list(result["ask_student"], "", ""))
    if ev.get("interview_prep"):
        out.append("<h2>Questions to prepare for</h2>" + _list(ev["interview_prep"], "", ""))
    dropped = result.get("dropped_for_truth", [])
    if dropped:
        out.append("<h2>Removed because your profile doesn't back them up</h2>"
                   + _list([f"{d['bullet']} ({'; '.join(d['problems'])})" for d in dropped], "muted", ""))
    return "<body>" + "\n".join(out) + "</body>"


def render_review_pdf(result: dict, job: dict, student: str) -> bytes:
    return html_to_pdf(review_html(result, job, student), CSS)
