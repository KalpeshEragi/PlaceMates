// ────────────────────────────────────────────────────────────
// Smart Profile — GitHub Project Ranking
// ────────────────────────────────────────────────────────────
//
// Scores each GitHub repo based on relevance to the user's
// top skills, README quality, stars, recency, and keywords.
// Returns the top 3–4 projects.
// ────────────────────────────────────────────────────────────

import type { GitHubRepo, RankedProject } from "./types.js";

// How many months back is considered "recently updated"
const RECENT_MONTHS = 6;

/**
 * Score and rank GitHub repos, returning the best 3–4.
 *
 * Scoring:
 *   +5  language matches a top skill
 *   +3  description exists and is meaningful (>30 chars)
 *   +2  stars > 0
 *   +2  updated within the last 6 months
 *   +1  each topic that matches a top skill
 *
 * @param repos     - GitHub repos from importedData
 * @param topSkills - User's top skills (lowercase)
 * @returns Top 3–4 ranked projects
 */
export function rankProjects(
    repos: GitHubRepo[],
    topSkills: string[]
): RankedProject[] {
    const topSkillSet = new Set(topSkills);
    const now = Date.now();
    const recentCutoff = now - RECENT_MONTHS * 30 * 24 * 60 * 60 * 1000;

    const scored: Array<{ repo: GitHubRepo; score: number }> = [];

    for (const repo of repos) {
        // Skip forked repos — we want original work
        if (repo.fork) continue;

        let score = 0;

        // +5 if the repo's primary language matches a top skill
        if (repo.language && topSkillSet.has(repo.language.toLowerCase())) {
            score += 5;
        }

        // +3 if description exists and is meaningful length
        if (repo.description && repo.description.length > 30) {
            score += 3;
        } else if (repo.description && repo.description.length > 0) {
            score += 1; // small bonus for any description
        }

        // +2 if the repo has stars
        if (repo.stargazers_count > 0) {
            score += 2;
            // Bonus for more stars (diminishing returns)
            if (repo.stargazers_count >= 10) score += 1;
            if (repo.stargazers_count >= 50) score += 1;
        }

        // +2 if recently updated
        if (repo.updated_at) {
            const updatedAt = new Date(repo.updated_at).getTime();
            if (updatedAt > recentCutoff) {
                score += 2;
            }
        }

        // +1 per topic matching a top skill
        if (repo.topics) {
            for (const topic of repo.topics) {
                if (topSkillSet.has(topic.toLowerCase())) {
                    score += 1;
                }
            }
        }

        // Only consider repos with a minimum score
        if (score > 0) {
            scored.push({ repo, score });
        }
    }

    // Sort by score descending, take top 4
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 4);

    return top.map(({ repo, score }) => ({
        name: repo.name,
        description: repo.description || "",
        url: repo.html_url,
        languages: repo.language ? [repo.language] : [],
        stars: repo.stargazers_count,
        score,
    }));
}
