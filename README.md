# PlaceMates v2

Every day, PlaceMates finds fresh jobs that fit a student's profile and emails them 5 resumes, each tailored to one job, with an Apply button.

> This is a rewrite on the `v2` branch. The original project stays on `main` and will be renamed `legacy` once v2 replaces it.

## V1 scope

The version is done when a user receives a daily email with 5 tailored resumes, one per job, each with an Apply button.

1. **Profile:** the user uploads a resume or fills in a form; the profile is editable afterwards.
2. **Job preferences:** role, location or remote, experience level, job type, salary.
3. **Daily job pull:** Greenhouse / Lever / Ashby public job feeds, Adzuna India, and JSearch. Jobs posted in the last 72 hours, with duplicates removed (about 100–200 a day).
4. **Filter:** job type, experience level and location rule jobs out. Role and salary only affect ranking.
5. **Rank:** jobs are ranked by meaning (embeddings) against the profile. The top 5 are picked, and a job is never sent to the same user twice.
6. **Tailor:** three agents write a resume for each job. The retriever pulls similar examples from a hand-picked corpus, the drafter (Gemini) writes, and the critic scores it; the draft is improved until it passes.
7. **Deliver:** one email per user, sent through their own Gmail (`gmail.send` permission). Each of the 5 cards links to a resume page with Download PDF and Apply buttons.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js |
| Backend | Python, FastAPI |
| Database | Postgres + pgvector |
| Daily pipeline | LangGraph |
| Resume-writing agents | CrewAI |
| AI model | Gemini |
| Sign-in and email | Google sign-in with the `gmail.send` permission |

## Evaluation

- **Critic score:** used inside the draft/critique loop.
- **Keyword match:** keyword-match score of the resume against the job description, before and after tailoring.
- **Human check:** a blind human rating of 30 resumes, to see whether the critic agrees with people.
- **Real use:** the share of sent resumes that get applied to.

## Example resumes

50–150 hand-picked real resumes that led to shortlists, labelled by role and experience level, with personal details removed.

## Not in V1

- Tracking applications.
- Reading the user's inbox for replies.
- Mock interviews.
- An agent that researches each company's online test (OA).
- The browser extension that fills in application forms.
