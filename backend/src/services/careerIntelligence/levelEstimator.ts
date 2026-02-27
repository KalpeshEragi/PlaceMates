// ────────────────────────────────────────────────────────────
// Career Intelligence — Career Level Estimator
// ────────────────────────────────────────────────────────────
//
// Combines LinkedIn career stage / progression / impact
// with GitHub technical depth / activity scores.
//
// Output: one of 5 career levels.
// ────────────────────────────────────────────────────────────

import type { GitHubAnalysis } from "../githubIntelligence/types.js";
import type { LinkedInInsights } from "../linkedinIntelligence/types.js";
import type { CareerLevel } from "./types.js";

// ── Public API ────────────────────────────────────────────

export function estimateCareerLevel(
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null
): CareerLevel {
    // Collect scores with defaults
    const careerStage = linkedin?.careerStage ?? null;
    const roleProgression = linkedin?.roleProgressionScore ?? 0;
    const impactOverall = linkedin?.impactScoreOverall ?? 0;
    const technicalDepth = github?.technicalDepthScore ?? 0;
    const activityScore = github?.activityScore ?? 0;

    // ── Stage-based baseline ──────────────────────────────
    let levelScore = 0;

    // LinkedIn career stage baseline
    switch (careerStage) {
        case "student":
            levelScore += 1;
            break;
        case "entry":
            levelScore += 3;
            break;
        case "early-career":
            levelScore += 5;
            break;
        case "experienced":
            levelScore += 8;
            break;
        default:
            // No LinkedIn data — neutral
            levelScore += 0;
            break;
    }

    // ── Role progression modifier ─────────────────────────
    // roleProgressionScore is 0–10
    levelScore += roleProgression * 0.5;

    // ── Impact modifier ───────────────────────────────────
    // impactScoreOverall is 0–10
    levelScore += impactOverall * 0.3;

    // ── Technical depth modifier ──────────────────────────
    // technicalDepthScore is 0–10
    levelScore += technicalDepth * 0.4;

    // ── Activity modifier ─────────────────────────────────
    // activityScore is 0–10
    levelScore += activityScore * 0.2;

    // ── Handle partial data ───────────────────────────────
    // If only GitHub is available, boost its weight
    if (!linkedin && github) {
        levelScore = technicalDepth * 0.8 + activityScore * 0.4;
    }
    // If only LinkedIn is available, boost its weight
    if (!github && linkedin) {
        levelScore =
            (careerStage === "student" ? 1 : careerStage === "entry" ? 3 : careerStage === "early-career" ? 5 : careerStage === "experienced" ? 8 : 0) +
            roleProgression * 0.7 +
            impactOverall * 0.4;
    }

    // ── Map score to career level ─────────────────────────
    if (levelScore >= 10) return "Experienced professional";
    if (levelScore >= 7) return "Intermediate professional";
    if (levelScore >= 4.5) return "Entry-level developer";
    if (levelScore >= 2.5) return "Industry-ready student";
    return "Student";
}
