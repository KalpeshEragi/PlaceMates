# How PlaceMates evaluates a tailored resume

The Resume Evaluation Agent judges each draft in two stages, the same order a real application goes through:

1. **ATS stage (code, deterministic).** This models what documented applicant tracking systems actually compute.
2. **HR panel (LLM personas).** Five or six simulated reviewers, each grounded in the recruitment knowledge base (`backend/app/intelligence/data/`), read the resume the way that kind of reviewer does.

Two code honesty checks run before either stage:
- **Truth check:** any bullet that states a number or technology not in the student's saved facts is dropped.
- **Claim check:** a bullet that claims a result or quality the facts don't mention (for example "ensuring accurate settlement" or "across multiple crop types") is flagged. The writer removes it, or the student is asked whether it's true.

## Flow and cost

1. The Analysis, Strategy and Generation agents produce a draft.
2. **Code checks** run: truth, claims, weak bullets and the ATS stage. They drive **one revision**, and the revision is kept only if the code checks score it at least as well.
3. The **HR panel judges the final version once.** An earlier design ran the panel before and after the revision. That doubled the tokens and didn't raise the panel's own score (66 → 64 in testing). Almost all of the gain came from removing unconfirmed claims, which code finds for free.

Groq's free tier allows 200k tokens per day per model, so judges and planners run gpt-oss with `reasoning_effort="low"`. The panel is split across the 20B and 120B models, and the two halves run in parallel.

## 1. What real ATSs compute

Short version: **the major ATSs rank and filter; they rarely auto-reject on resume wording.** Auto-rejection comes from knockout questions that employers configure (work authorisation, notice period, CGPA cut-off). It doesn't come from keyword density.

| System | What it computes | Source |
|---|---|---|
| **Workday Recruiting**: Candidate Skills Match | ML similarity between the skills in the resume/application and the skills in the requisition. **Required skills get more weight.** Output tiers: Strong / Good / Fair / Low / Unable to Score. Shows "Skills Not Found". It does **not** consider how recently or how long a skill was used, or total years of experience. Non-English or unsupported resume formats give Low / Unable to Score. | [Workday admin guide](https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/candidate-skills-match/bmj1604095304483.html) |
| **Workday HiredScore**: grades | **A**: all required qualifications, most preferred, and average match above a threshold. **B**: all required. **C**: most but not all required. **D**: does not meet most required. | [HiredScore candidate grades](https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/reference--candidate-grades.html) |
| **Greenhouse** Talent Matching | Uses resume data only (skills, titles, years, dates, employers). Names and contact details are excluded to reduce bias. Tiers: Strong / Good / Partial / Limited match, with matched and missing skills and a short justification. **"There is no mechanism that automatically… rejects."** | [Greenhouse data FAQ](https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ) |
| **Naukri RMS** (India): Relevance Score | AI score with sub-scores for **skills, designation, salary, experience, location and education**, shown to recruiters when they hover over it. | [Naukri Recruiter Zone](https://recruiterzone.naukri.com/identify-relevant-applies-with-great-ease) |
| **Textkernel / Sovren** (parser and matcher behind many ATSs) | A 0–100 match per category (skills, job titles, education, industries, certifications…), weighted into one score, with an **Evidence** list of each data point found or not found. | [Textkernel Score API](https://developer.textkernel.com/tx-platform/v10/search-match/bimetric-score-api/score-to-resume) |
| Recruiter study (Enhancv, 25 US recruiters, 2025) | 92% said their ATS doesn't auto-reject on format or keywords. Filters target compliance items. | KB `SRC-029` |

None of these vendors publishes its exact formula, so ours is a transparent approximation of the documented behaviour, not a copy of any one system.

### PlaceMates ATS stage

| Sub-score | Modelled on | How |
|---|---|---|
| Required skills | Workday (higher weight on required), HiredScore | Share of the JD's must-have skills that appear in the resume |
| Preferred skills | HiredScore "most preferred" | Share of nice-to-have skills found |
| Designation | Naukri, Textkernel job titles | Overlap between the job title's words and the resume's summary and headings |
| Experience | Naukri | The years the JD asks for vs. fresher (0–1 years) |
| Education | Naukri, Textkernel | A degree is present on the profile |
| Parse safety | Workday "Unable to Score", KB `INT-005` | PlaceMates renders single-column plain text, so this checks only for empty sections or non-text content |

Weighted score: required .45, preferred .15, designation .15, experience .15, education .10. This gives a tier (Strong ≥ .80, Good ≥ .60, Fair ≥ .40, Low) and a HiredScore-style grade (A/B/C/D), each with an evidence list of found and not-found items.

**What we tell the student:** "Real ATSs mostly *rank* you; a low match pushes you down the recruiter's list, it rarely rejects you outright." We never encourage keyword stuffing. KB `INT-029` (High confidence) says unsupported AI keywords now count *against* a candidate.

## 2. HR persona panel

Each persona is a separate CrewAI agent and **sees only what a recruiter sees**: the rendered resume and the job post. It never sees the student's private profile, name or contact details. Excluding names follows Greenhouse's practice and Wilson & Caliskan (AIES 2024, [arXiv 2407.20371](https://arxiv.org/abs/2407.20371)), who found that language-model resume screening favoured White-associated names in 85.1% of tests.

| # | Persona | Panel | What they reward and punish | KB grounding |
|---|---|---|---|---|
| P1 | Campus placement screener (Indian campus / mass hiring) | always | A 30-second skim. Relevance in the top third, clear CGPA, no clutter | INT-003, INT-006, INT-021, INT-043 |
| P3 | Big-tech technical interviewer (resume deep-dive round) | always | Every line will be questioned. Ownership, design choices, hardest problem | INT-011, INT-023, INT-038, INT-044 |
| P4 | GCC/MNC talent-acquisition partner (works in Workday or Naukri) | always | The JD's own terms for real skills; required vs. preferred met | INT-034, INT-037, INT-005, INT-024 |
| P5 | AI-resume skeptic / bar raiser | always | Generic AI phrasing, keyword stuffing, scope inflated beyond the level | INT-029, INT-020, INT-022, INT-039, PAT-003 |
| P2 | Product-startup engineering manager, Bengaluru | SDE, Backend, Full Stack | Shipped and deployed work, depth over breadth, data-store and API decisions | INT-009, INT-010, INT-012, INT-015 |
| P8 | IT-services campus recruiter | SDE, Backend, Full Stack | Fundamentals (DSA, OOP, DBMS) and a clean, consistent resume | INT-031, INT-032, SRC-031 |
| P6 | ML hiring lead | AI/ML, Data Science | Data, model, metric, baseline and evals explained end to end | INT-013, INT-014, INT-029 |
| P7 | Analytics hiring manager | Data Analyst | SQL plus the business decision an analysis informed; careless errors | INT-016, INT-008, INT-031 |

Each persona returns:
- a decision (shortlist, maybe or reject);
- 1–10 scores for relevance, evidence, depth, credibility and clarity;
- strengths;
- concerns, each tied to a bullet, with a fix (or "ask the student for X");
- the interview questions they would ask.

**Aggregation (code):**
- **Shortlist votes:** for example, 3 of 5.
- **Panel score:** the mean of all scores, out of 100.
- **Consensus concerns:** issues raised by two or more personas. These drive the one revision round.
- **Interview prep:** the union of the personas' questions. This is given to the student, in line with KB `INT-040`.

### Final score

The ATS stage gets a 30% weight, the HR panel 70%, minus 5 points per bullet dropped by the truth check (at most 20). Bands are Strong (≥ 75), Good (≥ 55) and Needs work.

### Limits

- **Real recruiters are noisy.** In the interviewing.io study, 76 recruiters were right 55% of the time and spent a median of 31 seconds per resume (KB `INT-006`). The panel is a structured second opinion, not a prediction of shortlisting.
- **The weights aren't calibrated yet.** Calibrating them needs outcome data: resumes that did and didn't get interviews.
- **The KB leans on one campus.** 16 of its 43 sources are from IIT Kanpur, so tier-2 and tier-3 and off-campus hiring are under-represented.
