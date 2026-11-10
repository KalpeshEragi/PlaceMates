"""Structured outputs passed between the four resume agents."""

from typing import Literal

from pydantic import BaseModel, Field


class JobBrief(BaseModel):
    role_focus: str = Field(description="One line: what this role mostly does")
    must_have: list[str] = Field(description="Skills/tools the posting requires, as short names (e.g. 'React', "
                                             "'Node.js', 'REST APIs'), not sentences")
    nice_to_have: list[str] = Field(default=[], description="Skills/tools that are a plus, as short names")
    keywords: list[str] = Field(default=[], description="Other terms a recruiter would scan for")
    values: list[str] = Field(default=[], description="What the team seems to value (e.g. scale, ownership, ML depth)")


class Gap(BaseModel):
    skill: str
    note: str = Field(description="Why it matters for this job and what the student could tell us")


# 1. Resume Analysis Agent
class Analysis(BaseModel):
    job: JobBrief
    process_type: Literal["campus_oa_first", "resume_shortlisted", "off_campus"] = Field(
        description="How this hire is likely screened")
    strengths: list[str] = Field(description="The student's strongest verified evidence for this job, a few words each")
    gaps: list[Gap] = Field(default=[], description="Must-haves with no evidence in the student's facts")
    questions_for_student: list[str] = Field(default=[], description="Up to 5 questions whose answers would most "
                                                                     "improve this resume")


# 2. Resume Strategy Agent
class PlannedItem(BaseModel):
    item_id: str
    why: str = Field(description="Why this item fits the job, in a few words")
    angle: str = Field(description="What to emphasise in this item's bullets for this job")


class Strategy(BaseModel):
    items: list[PlannedItem] = Field(description="Every profile item, most relevant to this job first")
    skills: list[str] = Field(description="Up to 30 of the student's skills, most relevant first, using the job's "
                                          "wording where it names the same skill")
    leave_out: list[str] = Field(default=[], description="item_ids deliberately left out, with a short reason each")
    rule_ids: list[str] = Field(default=[], description="Knowledge-base rule ids (INT-xxx) this plan follows")


# 3. Resume Generation Agent
class Bullet(BaseModel):
    text: str
    based_on: str = Field(description="Which of the student's facts supports this bullet (short quote or field)")


class DraftItem(BaseModel):
    item_id: str
    bullets: list[Bullet] = Field(description="2-4 bullets for this item")


class ResumeDraft(BaseModel):
    summary: str = Field(description="2 lines max, specific to this job, no buzzwords")
    skills: list[str]
    items: list[DraftItem]


# 4. Resume Evaluation Agent (one per HR persona)
class Issue(BaseModel):
    where: str = Field(description="summary, skills, or the exact bullet text")
    problem: str
    fix: str = Field(description="A fix using only what is on the page, or 'ask the student for X'")


class Scores(BaseModel):
    relevance: int = Field(ge=1, le=10, description="Fit to this job")
    evidence: int = Field(ge=1, le=10, description="Concrete outcomes and proof behind claims")
    depth: int = Field(ge=1, le=10, description="Technical depth visible")
    credibility: int = Field(ge=1, le=10, description="Believable and defensible for a fresher")
    clarity: int = Field(ge=1, le=10, description="Easy to skim, specific wording")


class PersonaVerdict(BaseModel):
    decision: Literal["shortlist", "maybe", "reject"]
    scores: Scores
    strengths: list[str] = Field(default=[])
    concerns: list[Issue] = Field(default=[], description="At most 4, most important first")
    interview_questions: list[str] = Field(default=[], description="2-3 questions you would ask about this resume")
    one_line: str = Field(description="Your verdict in one sentence")
