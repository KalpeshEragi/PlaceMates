// ────────────────────────────────────────────────────────────
// Career Intelligence — Domain Resolution Engine
// ────────────────────────────────────────────────────────────
//
// Weighted merge:
//   GitHub domain distribution = 60%
//   LinkedIn specialization signals = 40%
//
// Supports expanded domain set from Stage 1.
// ────────────────────────────────────────────────────────────

import type { GitHubAnalysis } from "../githubIntelligence/types.js";
import type { LinkedInInsights } from "../linkedinIntelligence/types.js";
import type { DomainResolutionResult } from "./types.js";

// Weight constants
const GITHUB_WEIGHT = 0.6;
const LINKEDIN_WEIGHT = 0.4;

// ── Public API ────────────────────────────────────────────

export function resolveDomains(
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null
): DomainResolutionResult {
    const domainScores: Record<string, number> = {};

    // ── FIX 2: Weighted domain distribution ───────────────
    // domainScore[domain] += repo.complexityScore × repo.domainConfidence
    const rawDomainWeights: Record<string, number> = {};

    // ── GitHub domain signals (60%) ───────────────────────
    if (github) {
        // Count domain distribution from repo profiles
        const domainCounts: Record<string, number> = {};
        let totalRepos = 0;

        for (const repo of github.repoProfiles) {
            if (repo.domain && repo.domain !== "unknown") {
                domainCounts[repo.domain] = (domainCounts[repo.domain] || 0) + 1;
                totalRepos++;

                // Accumulate weighted domain score
                rawDomainWeights[repo.domain] =
                    (rawDomainWeights[repo.domain] || 0) +
                    repo.complexityScore * repo.domainConfidence;
            }
        }

        // Convert counts to weighted scores
        for (const [domain, count] of Object.entries(domainCounts)) {
            const ratio = totalRepos > 0 ? count / totalRepos : 0;
            domainScores[domain] =
                (domainScores[domain] || 0) + ratio * 10 * GITHUB_WEIGHT;
        }

        // Boost the LLM-determined strongest domain
        if (github.strongestDomain && github.strongestDomain !== "unknown") {
            const key = github.strongestDomain.toLowerCase();
            domainScores[key] = (domainScores[key] || 0) + 3 * GITHUB_WEIGHT;
        }
    }

    // ── LinkedIn specialization signals (40%) ─────────────
    if (linkedin) {
        // specializationDirection keywords → map to domains
        for (const direction of linkedin.specializationDirection) {
            const mapped = mapKeywordToDomain(direction);
            if (mapped) {
                domainScores[mapped] =
                    (domainScores[mapped] || 0) + 4 * LINKEDIN_WEIGHT;
            }
        }

        // careerIntentKeywords → secondary signal
        for (const keyword of linkedin.careerIntentKeywords) {
            const mapped = mapKeywordToDomain(keyword);
            if (mapped) {
                domainScores[mapped] =
                    (domainScores[mapped] || 0) + 2 * LINKEDIN_WEIGHT;
            }
        }

        // Curated project domain hints
        for (const project of linkedin.curatedProjects) {
            for (const hint of project.domainHints) {
                const mapped = mapKeywordToDomain(hint);
                if (mapped) {
                    domainScores[mapped] =
                        (domainScores[mapped] || 0) + 1 * LINKEDIN_WEIGHT;
                }
            }
        }
    }

    // ── Normalize domain distribution to percentages ──────
    const totalWeight = Object.values(rawDomainWeights).reduce((s, v) => s + v, 0) || 1;
    const domainDistribution: Record<string, number> = {};
    for (const [domain, weight] of Object.entries(rawDomainWeights)) {
        domainDistribution[domain] = Math.round((weight / totalWeight) * 100 * 10) / 10;
    }

    // ── Sort and extract ──────────────────────────────────
    const sorted = Object.entries(domainScores)
        .sort((a, b) => b[1] - a[1]);

    const primaryDomain = sorted[0]?.[0] || "unknown";
    const secondaryDomains = sorted
        .slice(1, 4)
        .filter(([, score]) => score >= 1)
        .map(([domain]) => domain);

    return { primaryDomain, secondaryDomains, domainDistribution };
}

// ── Domain Keyword Mapping ────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
    web: ["web", "frontend", "react", "angular", "vue", "next.js", "html", "css", "ui", "ux", "full-stack", "fullstack"],
    backend: ["backend", "server", "api", "rest", "graphql", "microservices", "node", "express", "django", "flask", "spring"],
    ai: ["ai", "ml", "machine learning", "deep learning", "nlp", "computer vision", "tensorflow", "pytorch", "artificial intelligence"],
    mobile: ["mobile", "android", "ios", "react native", "flutter", "swift", "kotlin"],
    data: ["data science", "data analysis", "analytics", "visualization", "pandas", "statistics"],
    "data-engineering": ["data engineering", "etl", "pipeline", "spark", "kafka", "airflow", "data warehouse"],
    devops: ["devops", "cloud", "aws", "azure", "gcp", "kubernetes", "docker", "ci/cd", "infrastructure"],
    cybersecurity: ["security", "cybersecurity", "penetration", "infosec", "crypto", "vulnerability"],
    iot: ["iot", "internet of things", "sensor", "raspberry pi", "arduino"],
    embedded: ["embedded", "firmware", "rtos", "microcontroller"],
    "game-dev": ["game", "unity", "unreal", "godot", "game development", "gamedev"],
    blockchain: ["blockchain", "web3", "solidity", "ethereum", "smart contract", "defi"],
    desktop: ["desktop", "electron", "qt", "wpf", "gui", "system programming"],
    automation: ["automation", "scripting", "bot", "rpa", "selenium", "tooling"],
    "competitive-programming": ["competitive programming", "cp", "leetcode", "codeforces", "algorithm"],
    networking: ["networking", "tcp", "udp", "socket", "protocol", "network"],
};

function mapKeywordToDomain(keyword: string): string | null {
    const lower = keyword.toLowerCase();
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        if (keywords.some((kw) => lower.includes(kw))) {
            return domain;
        }
    }
    return null;
}
