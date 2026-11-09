# Recruitment Intelligence KB: Research Summary

**Version** 1.0.0 · **Generated** 2026-11-09 · **Research window** 1 Jan 2024 to 9 Nov 2026 (priority: 2026, then 2025, then 2024)

**Files:**
- `recruitment_intelligence.json`: the full knowledge base (metadata, sources, 46 intelligence entries, 7 recurring patterns, 7 conflicts, mapping to the four agents, and lookup indexes by role and category).
- `research_sources.json`: the source catalogue (43 sources).

## Sources collected

### By year

| Bucket | Sources | Notes |
|---|---|---|
| 2026 | 14 | Published in 2026 |
| 2025-26 season | 12 | IIT Kanpur placement-office "Insights 2025-26" documents. The experiences are from Aug–Dec 2025 and the exact upload dates aren't stated, so they are not counted as 2026 publications |
| 2025 | 8 | |
| 2024 | 9 | Kept only where they add data or Indian first-hand context |

Of the 43 sources, 34 are from 2025 or later.

### By platform (grouped)

| Platform | Sources |
|---|---|
| IIT Kanpur Students' Placement Office (SPO) Insights: 12 from the 2025-26 season, 4 from 2024 | 16 |
| Reddit (r/developersIndia, r/EngineeringResumes, r/cscareerquestions, r/analytics, r/india) | 7 |
| Hiring-manager newsletters and blogs (Pragmatic Engineer ×2, System Design One with an ex-Meta hiring-committee chair, Swizec Teller, Eugene Yan, Tian Pan, Gauntlet AI CTO) | 7 |
| Employer surveys and industry reports (NACE ×3, TeamLease EdTech report via Careers360) | 4 |
| University career centres (UMD Engineering, JHU) | 2 |
| Research and studies (interviewing.io, Galdin & Silbert on arXiv, Enhancv via IT Brief) | 3 |
| Official company guidance (Amazon India recruiters) | 1 |
| Other (Dice, DEV Community, Hacker News) | 3 |

### By geography and credibility

- **Geography:** 20 sources are India-specific, and one more (Amazon India) covers India and global hiring. The rest are US or international, and each one's geography is labelled.
- **Credibility:** 13 High, 21 Medium, 9 Low.

## Recurring patterns

1. **Evidence beats assertion** (PAT-001). US employer surveys, an Indian employer survey (TeamLease HY1 2026, 1,051 employers), Amazon recruiters and an ex-Meta hiring-committee chair all ask for concrete examples behind every claimed skill.
2. **Every resume line becomes interview material** (PAT-002). This is the most repeated pattern. IIT Kanpur selectees at Meesho, Goldman Sachs, Intuit, Samsung R&D Bangalore (SRIB), Skan.AI, Microsoft and Quicksell describe project and internship deep-dives. Quicksell made the candidate run the project and explain the code live.
3. **AI-written resumes have reduced trust** (PAT-003). Hiring managers in the US, UK, EU and India report keyword-mirrored resumes that the candidates can't back up. A 2025 study found that on one freelance platform, employers stopped rewarding tailored applications after LLMs.
4. **Honesty is rewarded and bluffing is punished** (PAT-004). Four independent Indian selectees said to admit what you don't know, never mislead, and never cheat.
5. **Internships are the top fresher differentiator, but can be substituted** (PAT-005). Deep projects, research and coding achievements can stand in.
6. **Each role is tested on different depth** (PAT-006).
   - SDE: DSA, OOP, DBMS, plus projects.
   - DS/ML: SQL, statistics, ML maths, evaluation.
   - LLM roles: evals, failure analysis, cost and latency.
   - Data Analyst: SQL plus the business decision the analysis informed.
7. **Simple, parser-friendly formatting with the result first in each bullet** (PAT-007).

## Strongest evidence-backed findings

These entries are rated High and have three or more independent sources:

- **INT-011, INT-044:** Expect implementation, design-choice and hardest-problem questions on every project and internship.
- **INT-013:** ML projects need data, model, loss, metric, baseline and the reasons behind each choice.
- **INT-029:** Stuffing trendy AI keywords (RAG, evals, agentic) without depth now counts against the candidate.
- **INT-031:** Role-specific expectations in Indian fresher hiring, from seven 2025-26 selectees.
- **INT-039:** Never claim what the candidate can't support. This is a hard constraint for all agents.
- **INT-018, INT-019:** Put the outcome first in each bullet, and quantify only with numbers the candidate can verify and explain.
- **INT-034, INT-035:** Tailor to a job description by choosing real evidence and using the JD's terms for skills the candidate has, not by rewriting text cosmetically.
- **INT-006:** Resume screening is noisy and favours pedigree. In the interviewing.io study (76 recruiters), recruiters were right 55% of the time and spent a median of 31 seconds per resume. Agents must never promise outcomes.

## Conflicting recommendations

Both positions are kept in the JSON, with the conditions under which each applies.

| ID | Topic | Resolution in the KB |
|---|---|---|
| CON-001 | Does the ATS auto-reject resumes? A Reddit post says "75%"; a small recruiter study says 92% of systems don't | Use simple formats regardless; don't justify keyword stuffing with ATS fear |
| CON-002 | Importance of CGPA/GPA | Indian campus processes use hard cut-offs; US employers rely on GPA less. Decide by geography |
| CON-003 | Are GitHub and portfolios looked at? | Put the key evidence in the bullet; link only well-kept repos |
| CON-004 | Should resumes be tailored? | Yes, by choosing evidence, not by mirroring keywords |
| CON-005 | Should every bullet be quantified? | Only with real, explainable numbers |
| CON-006 | Are internships necessary? | They help most but aren't required |
| CON-007 | Referrals vs resume quality | Outside what the resume text can control; don't promise outcomes |

## Limitations and research gaps

- **Heavy reliance on one institution.** 16 of the 43 sources come from IIT Kanpur's placement office. Each is a different candidate's consented first-hand account, but they reflect one elite campus, so tier-2 and tier-3 college and off-campus experiences are under-represented.
- **Platforms that couldn't be reached:**
  - **Medium and LeetCode Discuss:** pages returned errors (several relevant 2025–26 Indian interview posts were found but couldn't be opened).
  - **Quora and LinkedIn:** I didn't get to read any posts there, so neither is represented.
  - **Reddit:** read through public mirrors and snapshots. Original reddit.com URLs are given where the post ID was known, but the dates are approximate.
- **Paywalls and images.** Parts of the Pragmatic Engineer articles are paywalled, and NACE's per-skill percentages are only in images. Only the text that was visible was used.
- **Few official Indian recruiter sources.** Beyond Amazon India and the TeamLease report, no official guidance from Indian company recruiters was found. Data Analyst coverage is thin (3 sources, mostly Low credibility).
- **Correlation, not causation.** Success stories don't prove that a resume change caused the outcome (INT-046). Selected candidates' advice is treated as Medium evidence, not as a rule.
- **One source is undated.** The r/EngineeringResumes wiki (no revision date) was read but excluded to keep the strict 2024+ rule.
- **Privacy.** Candidate names, roll numbers and contact details from the IIT Kanpur documents are deliberately left out of the KB.

## Validation

- Both JSON files parse.
- All 43 source IDs are unique and match between the two files.
- Every insight, pattern, conflict, agent mapping and lookup-index reference points to an ID that exists.
- Every source is cited by at least one insight or conflict.
- No source is dated before 2024.
- Metadata counts match the actual contents.
- Confidence scores are calculated from evidence strength plus the number of independent source groups. Sources from the same author or survey count once: the two Pragmatic Engineer articles are one group, and the three NACE releases are another.
