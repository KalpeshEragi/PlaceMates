// ────────────────────────────────────────────────────────────
// Smart Profile — GitHub Activity Scoring
// ────────────────────────────────────────────────────────────
//
// Evaluates overall GitHub activity based on repo count,
// recency of updates, and total stars.
// ────────────────────────────────────────────────────────────

import type { GitHubRepo } from "./types.js";

// How many months back counts as "active"
const ACTIVE_MONTHS = 6;

/**
 * Calculate the user's GitHub activity level.
 *
 * Criteria:
 *   - Repo count (non-forked)
 *   - How many repos have been updated recently
 *   - Total stars across all repos
 *
 * Returns: "Low" | "Medium" | "High"
 *
 * @param repos - GitHub repos from importedData
 * @returns Activity score label and breakdown details
 */
export function calculateGithubActivity(repos: GitHubRepo[]): {
    score: string;
    details: {
        totalRepos: number;
        originalRepos: number;
        recentlyUpdated: number;
        totalStars: number;
    };
} {
    if (!repos || repos.length === 0) {
        return {
            score: "Low",
            details: {
                totalRepos: 0,
                originalRepos: 0,
                recentlyUpdated: 0,
                totalStars: 0,
            },
        };
    }

    const now = Date.now();
    const activeCutoff = now - ACTIVE_MONTHS * 30 * 24 * 60 * 60 * 1000;

    const originalRepos = repos.filter((r) => !r.fork);
    let recentlyUpdated = 0;
    let totalStars = 0;

    for (const repo of originalRepos) {
        totalStars += repo.stargazers_count || 0;

        if (repo.updated_at) {
            const updatedAt = new Date(repo.updated_at).getTime();
            if (updatedAt > activeCutoff) {
                recentlyUpdated++;
            }
        }
    }

    // ── Scoring heuristic ─────────────────────────────────────
    // Each dimension contributes points; total determines level
    let points = 0;

    // Repo count contribution
    if (originalRepos.length >= 20) points += 3;
    else if (originalRepos.length >= 10) points += 2;
    else if (originalRepos.length >= 5) points += 1;

    // Recent activity contribution
    if (recentlyUpdated >= 10) points += 3;
    else if (recentlyUpdated >= 5) points += 2;
    else if (recentlyUpdated >= 2) points += 1;

    // Stars contribution
    if (totalStars >= 50) points += 3;
    else if (totalStars >= 10) points += 2;
    else if (totalStars >= 1) points += 1;

    // Map points → label
    let score: string;
    if (points >= 6) {
        score = "High";
    } else if (points >= 3) {
        score = "Medium";
    } else {
        score = "Low";
    }

    return {
        score,
        details: {
            totalRepos: repos.length,
            originalRepos: originalRepos.length,
            recentlyUpdated,
            totalStars,
        },
    };
}
