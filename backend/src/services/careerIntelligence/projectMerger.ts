// ────────────────────────────────────────────────────────────
// Career Intelligence — Project Merger
// ────────────────────────────────────────────────────────────
//
// Merges GitHub projectHighlights with LinkedIn curatedProjects.
//
// Rules:
//   - If project appears in both → strong boost
//   - Include GitHub projects with high complexityScore
//   - Include LinkedIn projects with strong curationWeight
//   - Deduplicate by name similarity
//   - Return top 4–6 highlight projects
//
// FIX 5: Each project gets a projectTag:
//   "Flagship"          — boostScore ≥ 8 AND source "both"
//   "Complex System"    — matched GitHub repo has complexity ≥ 8
//   "Production-style"  — maturity ≥ 7 OR boostScore ≥ 6
//   "Learning Project"  — everything else
// ────────────────────────────────────────────────────────────

import type { GitHubAnalysis, ProjectHighlight, RepoProfile } from "../githubIntelligence/types.js";
import type { LinkedInInsights, CuratedProject } from "../linkedinIntelligence/types.js";
import type { MergedProject, ProjectTag } from "./types.js";

// ── Public API ────────────────────────────────────────────

export function mergeProjects(
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null
): MergedProject[] {
    const candidates: MergedProject[] = [];

    // Build a lookup for GitHub repo profiles by name
    const repoLookup = new Map<string, RepoProfile>();
    if (github) {
        for (const r of github.repoProfiles) {
            repoLookup.set(r.name.toLowerCase().replace(/[-_\s.]/g, ""), r);
        }
    }

    // ── Collect GitHub highlights ─────────────────────────
    const ghProjects: ProjectHighlight[] = github?.projectHighlights ?? [];
    for (const gh of ghProjects) {
        candidates.push({
            name: gh.name,
            description: gh.reason,
            techStack: gh.techStack,
            domain: gh.domain,
            source: "github",
            boostScore: 5,
            projectTag: "Learning Project", // placeholder — assigned below
        });
    }

    // Also consider top-complexity repos not already in highlights
    if (github) {
        const highComplexity = github.repoProfiles
            .filter((r) => r.complexityScore >= 7)
            .filter(
                (r) => !ghProjects.some((gh) => isSimilarName(gh.name, r.name))
            )
            .slice(0, 4);

        for (const repo of highComplexity) {
            candidates.push({
                name: repo.name,
                description:
                    repo.readmeSummaryShort?.projectPurpose ||
                    repo.description ||
                    `${repo.domain} project`,
                techStack: repo.techStack.slice(0, 5),
                domain: repo.domain,
                source: "github",
                boostScore: 3 + (repo.complexityScore >= 8 ? 2 : 0),
                projectTag: "Learning Project", // placeholder
            });
        }
    }

    // ── Collect LinkedIn curated projects ─────────────────
    const liProjects: CuratedProject[] = linkedin?.curatedProjects ?? [];
    for (const li of liProjects) {
        // Check if already added from GitHub
        const existingIdx = candidates.findIndex((c) =>
            isSimilarName(c.name, li.title)
        );

        if (existingIdx >= 0) {
            // Appears in both → strong boost
            candidates[existingIdx].source = "both";
            candidates[existingIdx].boostScore += 5;
            // Merge tech stacks
            const mergedTech = new Set([
                ...candidates[existingIdx].techStack,
                ...li.techMentions,
                ...li.validatedProjectSkills,
            ]);
            candidates[existingIdx].techStack = [...mergedTech].slice(0, 8);
        } else {
            // LinkedIn-only project
            const weight = li.curationWeight === "high" ? 4 : li.curationWeight === "medium" ? 3 : 1;
            candidates.push({
                name: li.title,
                description: li.domainHints.join(", ") || "LinkedIn project",
                techStack: [...li.techMentions, ...li.validatedProjectSkills].slice(0, 6),
                domain: li.domainHints[0] || "unknown",
                source: "linkedin",
                boostScore: weight,
                projectTag: "Learning Project", // placeholder
            });
        }
    }

    // ── Sort by boost and return top 4–6 ──────────────────
    candidates.sort((a, b) => b.boostScore - a.boostScore);

    // Deduplicate final list by similarity
    const final: MergedProject[] = [];
    for (const candidate of candidates) {
        if (!final.some((f) => isSimilarName(f.name, candidate.name))) {
            final.push(candidate);
        }
        if (final.length >= 6) break;
    }

    // ── FIX 5: Assign project tags ────────────────────────
    for (const project of final) {
        project.projectTag = assignProjectTag(project, repoLookup);
    }

    return final;
}

// ── Project Tag Assignment (FIX 5) ────────────────────────

function assignProjectTag(
    project: MergedProject,
    repoLookup: Map<string, RepoProfile>
): ProjectTag {
    const normName = project.name.toLowerCase().replace(/[-_\s.]/g, "");
    const matchedRepo = repoLookup.get(normName);

    const complexityScore = matchedRepo?.complexityScore ?? 0;
    const maturityScore = matchedRepo?.maturityScore ?? 0;

    // Flagship: high boost AND appears in both sources
    if (project.boostScore >= 8 && project.source === "both") {
        return "Flagship";
    }

    // Complex System: matched GitHub repo has high complexity
    if (complexityScore >= 8) {
        return "Complex System";
    }

    // Production-style: mature repo OR decent boost
    if (maturityScore >= 7 || project.boostScore >= 6) {
        return "Production-style";
    }

    return "Learning Project";
}

// ── Name Similarity ───────────────────────────────────────

function isSimilarName(a: string, b: string): boolean {
    const normA = a.toLowerCase().replace(/[-_\s.]/g, "");
    const normB = b.toLowerCase().replace(/[-_\s.]/g, "");

    // Exact match after normalization
    if (normA === normB) return true;

    // One contains the other
    if (normA.includes(normB) || normB.includes(normA)) return true;

    // Simple Jaccard similarity on character trigrams
    const triA = trigrams(normA);
    const triB = trigrams(normB);
    const intersection = triA.filter((t) => triB.includes(t)).length;
    const union = new Set([...triA, ...triB]).size;
    const similarity = union > 0 ? intersection / union : 0;

    return similarity >= 0.6;
}

function trigrams(s: string): string[] {
    const result: string[] = [];
    for (let i = 0; i <= s.length - 3; i++) {
        result.push(s.substring(i, i + 3));
    }
    return result;
}
