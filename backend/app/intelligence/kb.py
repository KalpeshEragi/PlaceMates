"""Recruitment knowledge base: 46 sourced rules about fresher tech hiring (India-first, 2024-2026).

Agents get only the rules for their job and the target role family, highest confidence first,
never the whole file. Verified student facts always override the KB.
"""

import json
import re
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).parent / "data"

# Our agent names -> the KB's agent names.
AGENTS = {
    "analysis": "Experience Analysis Agent",
    "strategy": "Resume Strategy Agent",
    "generation": "Resume Generation Agent",
    "evaluation": "Resume Evaluation Agent",
}
FAMILIES = ("SDE", "Backend", "Full Stack", "AI/ML", "Data Science", "Data Analyst")


@lru_cache
def load() -> dict:
    return json.loads((DATA / "recruitment_intelligence.json").read_text(encoding="utf-8"))


def _rules() -> dict[str, dict]:
    return {r["id"]: r for r in load()["intelligence"]}


def role_family(title: str, description: str = "") -> str:
    t = f" {title.lower()} "
    if re.search(r"data analy|analytics|business analy|\bbi\b|power bi", t):
        return "Data Analyst"
    if "data scien" in t:
        return "Data Science"
    if re.search(r"machine learning|\bml\b|\bai\b|\bllm|genai|gen ai|\bnlp\b|computer vision|deep learning", t):
        return "AI/ML"
    if re.search(r"full[ -]?stack|\bmern\b|\bmean\b", t):
        return "Full Stack"
    if re.search(r"back[ -]?end|\bapi\b|platform", t):
        return "Backend"
    return "SDE"


def _instruction_for(text: str, agent_name: str, fallback: str) -> str:
    """KB instructions may address several agents ('Strategy Agent: ... Evaluation Agent: ...'); keep ours."""
    short = agent_name.split()[-2]  # Analysis | Strategy | Generation | Evaluation
    parts = re.split(r"(?=\b(?:Experience |Resume )?(?:Analysis|Strategy|Generation|Evaluation) Agent:)", text)
    if len(parts) == 1:
        return text.strip()
    mine = [p.split(":", 1)[1] for p in parts if re.match(rf"(?:Experience |Resume )?{short} Agent:", p)]
    return " ".join(m.strip() for m in mine) or fallback  # addressed to other agents only: use the plain rule


def rules_for(agent: str, family: str, limit: int = 12) -> list[dict]:
    kb = load()
    name = AGENTS[agent]
    ids = set(kb["agent_knowledge_mapping"][name]["insight_ids"])
    ids &= set(kb["retrieval_indexes"]["by_role"].get(family, ids))
    rules = sorted((_rules()[i] for i in ids), key=lambda r: -r["confidence_score"])[:limit]
    return [{"id": r["id"], "principle": r["principle"], "do": _instruction_for(r["agent_instruction"], name, r["actionable_rule"]),
             "confidence": r["confidence_score"], "evidence": r["evidence_strength"]} for r in rules]


def render(rules: list[dict]) -> str:
    """Compact text block for a prompt."""
    return "\n".join(f"- [{r['id']}, {r['evidence']} evidence] {r['principle']}. {r['do']}" for r in rules)


def rules_by_id(ids: list[str]) -> list[dict]:
    all_rules = _rules()
    return [{"id": i, "principle": all_rules[i]["principle"], "rule": all_rules[i]["actionable_rule"]}
            for i in ids if i in all_rules]


def question_bank() -> list[str]:
    return load()["agent_knowledge_mapping"]["Experience Analysis Agent"].get("follow_up_question_bank", [])


def hard_constraints() -> list[str]:
    kb = load()
    return kb["agent_knowledge_mapping"]["Resume Generation Agent"].get("hard_constraints", []) + \
        kb["metadata"]["usage_guidance"].get("prohibited", [])
