// ────────────────────────────────────────────────────────────
// Career Intelligence — Alignment Checker
// ────────────────────────────────────────────────────────────
//
// Compares LinkedIn career intent vs GitHub domain reality.
//
// FIX 3: Domain hierarchy alignment — subdomains like
// frontend/backend/fullstack → web, ml/nlp/cv → ai, etc.
// are treated as aligned when comparing intent vs reality.
//
// Output:
//   careerAlignmentScore (0–1)
//   alignmentInsight message
// ────────────────────────────────────────────────────────────

import type { GitHubAnalysis } from "../githubIntelligence/types.js";
import type { LinkedInInsights } from "../linkedinIntelligence/types.js";
import type { AlignmentResult } from "./types.js";

// ── Domain Hierarchy Map ──────────────────────────────────
// Maps subdomains to their parent domain for alignment comparison.
// If a LinkedIn intent keyword is a subdomain of the GitHub domain,
// treat as aligned rather than misaligned.

const DOMAIN_HIERARCHY: Record<string, string> = {
    frontend: "web",
    backend: "web",
    fullstack: "web",
    "full-stack": "web",
    "full stack": "web",
    ml: "ai",
    "machine learning": "ai",
    nlp: "ai",
    "natural language processing": "ai",
    cv: "ai",
    "computer vision": "ai",
    "deep learning": "ai",
    "data science": "ai",
    cloud: "infrastructure",
    devops: "infrastructure",
    "cloud engineering": "infrastructure",
    "site reliability": "infrastructure",
    sre: "infrastructure",
    aws: "infrastructure",
    azure: "infrastructure",
    gcp: "infrastructure",
};

/**
 * Resolve a keyword to its hierarchy parent, or return itself.
 */
function resolveHierarchy(keyword: string): string {
    const lower = keyword.toLowerCase();
    return DOMAIN_HIERARCHY[lower] || lower;
}

// ── Public API ────────────────────────────────────────────

export function checkAlignment(
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null
): AlignmentResult {
    // Not enough data
    if (!github || !linkedin) {
        return {
            careerAlignmentScore: 1,
            alignmentInsight: github && !linkedin
                ? "LinkedIn data not available — alignment check skipped."
                : !github && linkedin
                    ? "GitHub data not available — alignment check skipped."
                    : "Both data sources missing — alignment check skipped.",
        };
    }

    // ── Gather intent signals ─────────────────────────────
    const intentKeywords = [
        ...linkedin.careerIntentKeywords,
        ...linkedin.specializationDirection,
    ].map((k) => k.toLowerCase());

    if (intentKeywords.length === 0) {
        return {
            careerAlignmentScore: 1,
            alignmentInsight:
                "No explicit career intent detected in LinkedIn profile — alignment is neutral.",
        };
    }

    // ── Gather GitHub reality ─────────────────────────────
    const githubDomain = github.strongestDomain.toLowerCase();
    const githubDomainParent = resolveHierarchy(githubDomain);
    const githubTechs = github.strongestTechnologies.map((t) => t.toLowerCase());
    const repoDomains = github.repoProfiles.map((r) => r.domain.toLowerCase());
    const repoDomainParents = repoDomains.map(resolveHierarchy);

    // ── Compute overlap ───────────────────────────────────
    let matchCount = 0;

    for (const keyword of intentKeywords) {
        const lower = keyword.toLowerCase();
        const keywordParent = resolveHierarchy(lower);

        // Direct domain match
        if (githubDomain.includes(lower) || lower.includes(githubDomain)) {
            matchCount += 2;
            continue;
        }

        // FIX 3: Hierarchy-based match — subdomain alignment
        if (
            keywordParent === githubDomainParent ||
            keywordParent === githubDomain ||
            lower === githubDomainParent
        ) {
            matchCount += 2; // treat as full alignment
            continue;
        }

        // Tech match
        if (githubTechs.some((t) => t.includes(lower) || lower.includes(t))) {
            matchCount += 1.5;
            continue;
        }

        // Repo domain match (direct or hierarchy)
        if (repoDomains.some((d) => d.includes(lower) || lower.includes(d))) {
            matchCount += 1;
            continue;
        }

        // Hierarchy match against repo domains
        if (repoDomainParents.some((p) => p === keywordParent)) {
            matchCount += 1; // hierarchy alignment with repo domains
            continue;
        }

        // Keyword appears in any repo name/description tech stack
        const foundInRepos = github.repoProfiles.some((r) =>
            r.techStack.some((t) => t.toLowerCase().includes(lower)) ||
            (r.description || "").toLowerCase().includes(lower)
        );
        if (foundInRepos) {
            matchCount += 0.5;
        }
    }

    // ── Normalize to 0–1 ──────────────────────────────────
    const maxPossible = intentKeywords.length * 2; // best case: all direct matches
    const rawScore = maxPossible > 0 ? matchCount / maxPossible : 1;
    const careerAlignmentScore = Math.round(Math.min(1, Math.max(0, rawScore)) * 100) / 100;

    // ── Generate insight ──────────────────────────────────
    let alignmentInsight: string;

    if (careerAlignmentScore >= 0.8) {
        alignmentInsight =
            `Strong alignment: Your GitHub work in ${githubDomain} directly supports your career goals in ${intentKeywords.slice(0, 3).join(", ")}.`;
    } else if (careerAlignmentScore >= 0.5) {
        alignmentInsight =
            `Moderate alignment: Your GitHub focus on ${githubDomain} partially overlaps with your LinkedIn goals (${intentKeywords.slice(0, 3).join(", ")}). Consider building more projects in your target area.`;
    } else {
        alignmentInsight =
            `Alignment gap detected: Your GitHub work shows strong ${githubDomain} focus, while your LinkedIn goals emphasize ${intentKeywords.slice(0, 3).join(", ")}. Building projects in your target domain would strengthen your profile.`;
    }

    return { careerAlignmentScore, alignmentInsight };
}
