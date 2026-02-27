// ────────────────────────────────────────────────────────────
// Career Intelligence — Impact Calculator
// ────────────────────────────────────────────────────────────
//
// Combines LinkedIn leadership signals + impact score
// with GitHub technical depth + activity scores.
// ────────────────────────────────────────────────────────────

import type { GitHubAnalysis } from "../githubIntelligence/types.js";
import type { LinkedInInsights } from "../linkedinIntelligence/types.js";
import type { ImpactResult } from "./types.js";

// ── Public API ────────────────────────────────────────────

export function calculateImpact(
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null
): ImpactResult {
    // ── Professional Impact Score ─────────────────────────
    // Weighted average of LinkedIn impact + GitHub activity
    const liImpact = linkedin?.impactScoreOverall ?? 0;
    const liProgression = linkedin?.roleProgressionScore ?? 0;
    const ghActivity = github?.activityScore ?? 0;

    // If both sources available: 50% LinkedIn impact, 20% progression, 30% activity
    // If only one source: normalize to that source
    let professionalImpactScore: number;

    if (linkedin && github) {
        professionalImpactScore =
            liImpact * 0.5 + liProgression * 0.2 + ghActivity * 0.3;
    } else if (linkedin) {
        professionalImpactScore = liImpact * 0.7 + liProgression * 0.3;
    } else if (github) {
        professionalImpactScore = ghActivity;
    } else {
        professionalImpactScore = 0;
    }

    professionalImpactScore =
        Math.round(Math.min(10, Math.max(0, professionalImpactScore)) * 10) / 10;

    // ── Technical Strength Score ──────────────────────────
    // Primarily from GitHub depth, boosted by LinkedIn validation
    const ghDepth = github?.technicalDepthScore ?? 0;
    const liValidatedCount = linkedin?.validatedSkills?.length ?? 0;
    const validationBoost = Math.min(2, liValidatedCount * 0.2);

    let technicalStrengthScore: number;

    if (github) {
        technicalStrengthScore = ghDepth + validationBoost;
    } else if (linkedin) {
        // Estimate from LinkedIn alone
        technicalStrengthScore =
            liValidatedCount >= 10 ? 6 :
                liValidatedCount >= 5 ? 4 :
                    liValidatedCount >= 2 ? 3 : 1;
    } else {
        technicalStrengthScore = 0;
    }

    technicalStrengthScore =
        Math.round(Math.min(10, Math.max(0, technicalStrengthScore)) * 10) / 10;

    // ── Leadership Signals ────────────────────────────────
    const leadershipSignals = linkedin?.leadershipSignals ?? [];

    return {
        professionalImpactScore,
        technicalStrengthScore,
        leadershipSignals,
    };
}
