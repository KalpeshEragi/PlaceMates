// ────────────────────────────────────────────────────────────
// Career Intelligence — Skill Confidence Engine
// ────────────────────────────────────────────────────────────
//
// Builds a unified skill map from GitHub + LinkedIn sources
// and classifies each skill by confidence score.
//
// Pre-processing (FIX 1 — false skill removal):
//   Before scoring, GitHub-detected skills are filtered:
//   - Ignore if <5% of total code and only in 1 repo
//   - Downgrade if not mentioned in README or description
//   - Boost if multi-repo, README-mentioned, or LinkedIn-confirmed
//
// Scoring rules:
//   +5  if detected in GitHub repo techStack (filtered)
//   +5  if in strongestTechnologies
//   +4  if validated in LinkedIn experiences/projects
//   +2  if only claimed in LinkedIn skills
//   +2  if appears in LinkedIn curated projects
//   +2  if appears in high-complexity GitHub project (≥7)
//   +2  bonus for multi-repo / README / LinkedIn cross-ref
//
// Classification:
//   ≥12 → Core Skill
//   8–11 → Strong Skill
//   4–7  → Working Knowledge
//   <4   → Weak Claim
// ────────────────────────────────────────────────────────────

import type { GitHubAnalysis, RepoProfile } from "../githubIntelligence/types.js";
import type { LinkedInInsights, CuratedProject } from "../linkedinIntelligence/types.js";
import type { SkillClassificationResult } from "./types.js";

// ── Skill Metadata (computed per-skill during filtering) ──

interface SkillMeta {
    repoCount: number;          // how many repos contain this skill
    totalRepoSize: number;      // sum of repo.size for repos containing this skill
    inReadme: boolean;          // appears in at least one repo's README techMentions
    inDescription: boolean;     // appears in at least one repo description
    inLinkedIn: boolean;        // matches a LinkedIn claimed or validated skill
}

// ── Public API ────────────────────────────────────────────

export function computeSkillConfidence(
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null
): SkillClassificationResult {
    const scores: Record<string, number> = {};

    // Build LinkedIn skill set for cross-referencing
    const linkedInSkillSet = buildLinkedInSkillSet(linkedin);

    // ── GitHub signals (with false skill filtering) ───────
    if (github) {
        const skillMeta = computeSkillMeta(github, linkedInSkillSet);
        const totalCodeSize = github.repoProfiles.reduce((sum, r) => sum + (r.stars >= 0 ? 1 : 0) && (sum + Math.max(1, r.techStack.length)), 0) || 1;
        const totalRepoSize = github.repoProfiles.reduce((sum, r) => sum + 1, 0) || 1;

        // Filtered GitHub tech stack scoring
        for (const [skill, meta] of Object.entries(skillMeta)) {
            const shareRatio = meta.repoCount / totalRepoSize;

            // IGNORE: appears in only 1 repo with <5% share,
            // not in README, not in description, not in LinkedIn
            if (
                meta.repoCount === 1 &&
                shareRatio < 0.05 &&
                !meta.inReadme &&
                !meta.inDescription &&
                !meta.inLinkedIn
            ) {
                continue; // skip this false skill entirely
            }

            // Base score: +5 for being in GitHub techStack
            let baseGhScore = 5;

            // DOWNGRADE: only 1 repo, not in README
            if (meta.repoCount <= 1 && !meta.inReadme) {
                baseGhScore = 2; // halved
            }

            scores[skill] = (scores[skill] || 0) + baseGhScore;

            // BOOST: multi-repo presence (+2)
            if (meta.repoCount >= 3) {
                scores[skill] += 2;
            }

            // BOOST: appears in README (+2)
            if (meta.inReadme) {
                scores[skill] += 2;
            }

            // BOOST: LinkedIn cross-reference (+2)
            if (meta.inLinkedIn) {
                scores[skill] += 2;
            }
        }

        // +5 for strongest technologies (already curated by Stage 1)
        for (const tech of github.strongestTechnologies) {
            const key = normalize(tech);
            scores[key] = (scores[key] || 0) + 5;
        }

        // +2 for skills in high-complexity repos (complexity ≥ 7)
        const highComplexityRepos = github.repoProfiles.filter(
            (r: RepoProfile) => r.complexityScore >= 7
        );
        for (const repo of highComplexityRepos) {
            for (const tech of repo.techStack) {
                const key = normalize(tech);
                if (scores[key] !== undefined) {
                    // only boost skills that survived filtering
                    scores[key] = (scores[key] || 0) + 2;
                }
            }
        }
    }

    // ── LinkedIn signals ──────────────────────────────────
    if (linkedin) {
        // +2 for claimed skills
        for (const skill of linkedin.claimedSkills) {
            const key = normalize(skill);
            scores[key] = (scores[key] || 0) + 2;
        }

        // +4 for validated skills (appeared in experience/project text)
        for (const skill of linkedin.validatedSkills) {
            const key = normalize(skill);
            scores[key] = (scores[key] || 0) + 4;
        }

        // +2 for skills in curated projects
        for (const project of linkedin.curatedProjects) {
            for (const skill of (project as CuratedProject).validatedProjectSkills) {
                const key = normalize(skill);
                scores[key] = (scores[key] || 0) + 2;
            }
            for (const tech of (project as CuratedProject).techMentions) {
                const key = normalize(tech);
                scores[key] = (scores[key] || 0) + 2;
            }
        }
    }

    // ── Classify ──────────────────────────────────────────
    const coreSkills: string[] = [];
    const strongSkills: string[] = [];
    const workingSkills: string[] = [];
    const weakSkills: string[] = [];

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    for (const [skill, score] of sorted) {
        if (score >= 12) coreSkills.push(skill);
        else if (score >= 8) strongSkills.push(skill);
        else if (score >= 4) workingSkills.push(skill);
        else weakSkills.push(skill);
    }

    return {
        coreSkills,
        strongSkills,
        workingSkills,
        weakSkills,
        skillScores: scores,
    };
}

// ── False Skill Filter Helpers ────────────────────────────

/**
 * Build a set of normalized LinkedIn skills for cross-referencing.
 */
function buildLinkedInSkillSet(linkedin: LinkedInInsights | null): Set<string> {
    const set = new Set<string>();
    if (!linkedin) return set;

    for (const s of linkedin.claimedSkills) set.add(normalize(s));
    for (const s of linkedin.validatedSkills) set.add(normalize(s));
    for (const project of linkedin.curatedProjects) {
        for (const s of project.validatedProjectSkills) set.add(normalize(s));
        for (const s of project.techMentions) set.add(normalize(s));
    }

    return set;
}

/**
 * Compute metadata for each GitHub-detected skill to decide
 * whether it's a real skill or a false positive (e.g., Makefile,
 * Shell appearing as primary language in a tiny repo).
 */
function computeSkillMeta(
    github: GitHubAnalysis,
    linkedInSkills: Set<string>
): Record<string, SkillMeta> {
    const meta: Record<string, SkillMeta> = {};

    for (const repo of github.repoProfiles) {
        // Collect README tech mentions for this repo
        const readmeTechs = new Set<string>(
            (repo.readmeSummaryShort?.mainTechnologies || "")
                .toLowerCase()
                .split(/[,;|/]/)
                .map((t) => t.trim())
                .filter(Boolean)
        );

        const descLower = (repo.description || "").toLowerCase();

        for (const tech of repo.techStack) {
            const key = normalize(tech);
            if (!meta[key]) {
                meta[key] = {
                    repoCount: 0,
                    totalRepoSize: 0,
                    inReadme: false,
                    inDescription: false,
                    inLinkedIn: linkedInSkills.has(key),
                };
            }
            meta[key].repoCount += 1;
            meta[key].totalRepoSize += 1; // using repo count as proxy

            // Check if tech appears in README parsed data
            if (readmeTechs.has(key) || readmeTechs.has(tech.toLowerCase())) {
                meta[key].inReadme = true;
            }

            // Check if tech appears in repo description
            if (descLower.includes(key)) {
                meta[key].inDescription = true;
            }
        }
    }

    return meta;
}

// ── General Helpers ───────────────────────────────────────

function normalize(skill: string): string {
    return skill.trim().toLowerCase();
}
