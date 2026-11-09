"""Structured outputs passed between the resume crew's agents."""

from pydantic import BaseModel, Field


class JobBrief(BaseModel):
    role_focus: str = Field(description="One line: what this role mostly does")
    must_have: list[str] = Field(description="Skills/tools the posting requires, as short names (e.g. 'React', "
                                             "'Node.js', 'REST APIs'), not sentences")
    nice_to_have: list[str] = Field(default=[], description="Skills/tools that are a plus, as short names")
    keywords: list[str] = Field(default=[], description="Other terms a recruiter would scan for")
    values: list[str] = Field(default=[], description="What the team seems to value (e.g. scale, ownership, ML depth)")


class SelectedItem(BaseModel):
    item_id: str
    why: str = Field(description="Why this item fits the job, in a few words")


class Selection(BaseModel):
    items: list[SelectedItem] = Field(description="3-5 profile items to show, most relevant first")
    skills: list[str] = Field(description="Up to 14 of the student's skills to list, most relevant first")


class DraftItem(BaseModel):
    item_id: str
    bullets: list[str] = Field(description="2-4 bullets for this item")


class ResumeDraft(BaseModel):
    summary: str = Field(description="2 lines max, specific to this job, no buzzwords")
    skills: list[str]
    items: list[DraftItem]


class Issue(BaseModel):
    where: str = Field(description="summary, skills, or the bullet text")
    problem: str
    fix: str


class Critique(BaseModel):
    passed: bool = Field(description="True if a recruiter for this job would shortlist it as is")
    issues: list[Issue] = Field(default=[])
