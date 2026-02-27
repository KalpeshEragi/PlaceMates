// ────────────────────────────────────────────────────────────
// GitHub Intelligence — Orchestrator
// ────────────────────────────────────────────────────────────
//
// Pipeline:
//   1. Fetch raw repos from importedData
//   2. Fetch READMEs via GitHub API (with access token)
//   3. Analyze each repo locally (repoAnalyzer)
//   4. Compress READMEs (readmeCompressor)
//   5. Synthesize global analysis (githubSynthesizer)
//   6. Save githubAnalysis to UserProfile
//
// Exports:
//   processGitHubIntelligence(userId) → GitHubAnalysis
// ────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { RawGitHubRepo, RepoProfile, GitHubAnalysis } from "./types.js";
import { analyzeAllRepos } from "./repoAnalyzer.js";
import { compressAllReadmes } from "./readmeCompressor.js";
import { synthesizeGitHub } from "./githubSynthesizer.js";

// ── Public API ────────────────────────────────────────────

/**
 * Run the full GitHub Intelligence pipeline for a user.
 *
 * @param userId - Authenticated user's ID
 * @returns Complete GitHubAnalysis object
 */
export async function processGitHubIntelligence(
    userId: string
): Promise<GitHubAnalysis> {
    console.log(`[GitHub Intelligence] Starting analysis for user ${userId}`);

    // ── 1. Fetch user data ─────────────────────────────────
    const profile = await prisma.userProfile.findUnique({
        where: { userId },
    });

    if (!profile) {
        throw new Error("User profile not found. Please complete your profile setup first.");
    }

    const importedData = (profile.importedData as Record<string, unknown>) || {};
    const rawRepos = importedData.githubRepos;

    if (!Array.isArray(rawRepos) || rawRepos.length === 0) {
        throw new Error(
            "No GitHub repositories found. Please connect your GitHub account first."
        );
    }

    console.log(`[GitHub Intelligence] Found ${rawRepos.length} raw repos`);

    // ── 2. Normalize raw repos ─────────────────────────────
    const repos = normalizeRawRepos(rawRepos);

    // ── 3. Fetch READMEs ───────────────────────────────────
    const accessToken = await getGitHubAccessToken(userId);
    const reposWithReadmes = await fetchReadmes(repos, accessToken);
    console.log(`[GitHub Intelligence] Fetched READMEs for ${reposWithReadmes.filter(r => r.readmeText).length}/${repos.length} repos`);

    // ── 4. Per-repo local analysis ─────────────────────────
    const repoProfiles = analyzeAllRepos(reposWithReadmes);
    console.log(`[GitHub Intelligence] Analyzed ${repoProfiles.length} repos locally`);

    // ── 5. README compression ──────────────────────────────
    // Load existing analysis for cache comparison
    const existingAnalysis = (profile as Record<string, unknown>).githubAnalysis as
        | { repoProfiles?: RepoProfile[] }
        | null;
    const existingProfiles = existingAnalysis?.repoProfiles;

    const reposWithReadmeData = repoProfiles.map((rp) => {
        const matchingRepo = reposWithReadmes.find(
            (r) => r.name === rp.name
        );
        return { repo: rp, readmeText: matchingRepo?.readmeText || "" };
    });

    const compressedProfiles = await compressAllReadmes(
        reposWithReadmeData,
        existingProfiles
    );
    console.log(`[GitHub Intelligence] Compressed READMEs for ${compressedProfiles.length} repos`);

    // ── 6. Global synthesis (1 LLM call) ───────────────────
    const synthesis = await synthesizeGitHub(compressedProfiles);
    console.log(`[GitHub Intelligence] Global synthesis complete`);

    // ── 7. Compose final GitHubAnalysis ────────────────────
    const githubAnalysis: GitHubAnalysis = {
        repoProfiles: compressedProfiles,
        strongestDomain: synthesis.strongestDomain,
        strongestTechnologies: synthesis.strongestTechnologies,
        projectHighlights: synthesis.projectHighlights,
        technicalDepthScore: synthesis.technicalDepthScore,
        activityScore: synthesis.activityScore,
        aiSummary: synthesis.aiSummary,
        generatedAt: new Date().toISOString(),
    };

    // ── 8. Save to database ────────────────────────────────
    const analysisJson = JSON.parse(
        JSON.stringify(githubAnalysis)
    ) as Prisma.InputJsonValue;

    await prisma.userProfile.update({
        where: { userId },
        data: { githubAnalysis: analysisJson },
    });

    console.log(`[GitHub Intelligence] ✅ Saved analysis for user ${userId}`);

    return githubAnalysis;
}

// ── Raw Repo Normalization ────────────────────────────────

function normalizeRawRepos(rawRepos: unknown[]): RawGitHubRepo[] {
    return rawRepos.map((r: unknown) => {
        const repo = r as Record<string, unknown>;
        return {
            name: String(repo.name || ""),
            description: repo.description ? String(repo.description) : null,
            html_url: String(repo.html_url || ""),
            language: repo.language ? String(repo.language) : null,
            languages_url: repo.languages_url ? String(repo.languages_url) : undefined,
            stargazers_count: Number(repo.stargazers_count) || 0,
            forks_count: Number(repo.forks_count) || 0,
            watchers_count: Number(repo.watchers_count) || 0,
            open_issues_count: Number(repo.open_issues_count) || 0,
            updated_at: String(repo.updated_at || ""),
            created_at: String(repo.created_at || ""),
            pushed_at: repo.pushed_at ? String(repo.pushed_at) : undefined,
            fork: Boolean(repo.fork),
            topics: Array.isArray(repo.topics) ? repo.topics.map(String) : [],
            size: Number(repo.size) || 0,
            default_branch: repo.default_branch ? String(repo.default_branch) : undefined,
            has_wiki: Boolean(repo.has_wiki),
            has_pages: Boolean(repo.has_pages),
            homepage: repo.homepage ? String(repo.homepage) : null,
            contributors_count: repo.contributors_count ? Number(repo.contributors_count) : undefined,
            commit_count: repo.commit_count ? Number(repo.commit_count) : undefined,
            branches_count: repo.branches_count ? Number(repo.branches_count) : undefined,
        };
    });
}

// ── README Fetching ───────────────────────────────────────

async function getGitHubAccessToken(userId: string): Promise<string | null> {
    const oauthAccount = await prisma.oAuthAccount.findFirst({
        where: { userId, provider: "github" },
    });
    return oauthAccount?.accessToken || null;
}

/**
 * Fetch README content for each repo via GitHub API.
 * Runs in parallel batches to respect rate limits.
 */
async function fetchReadmes(
    repos: RawGitHubRepo[],
    accessToken: string | null
): Promise<RawGitHubRepo[]> {
    if (!accessToken) {
        console.warn("[GitHub Intelligence] No access token — skipping README fetch");
        return repos;
    }

    const BATCH_SIZE = 5;
    const results: RawGitHubRepo[] = [];

    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
        const batch = repos.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
            batch.map(async (repo) => {
                try {
                    const readmeText = await fetchSingleReadme(repo, accessToken);
                    return { ...repo, readmeText };
                } catch {
                    return repo; // keep repo without README
                }
            })
        );

        results.push(...batchResults);
    }

    return results;
}

async function fetchSingleReadme(
    repo: RawGitHubRepo,
    accessToken: string
): Promise<string | undefined> {
    // Extract owner/repo from html_url
    const urlParts = repo.html_url.replace("https://github.com/", "").split("/");
    if (urlParts.length < 2) return undefined;

    const owner = urlParts[0];
    const repoName = urlParts[1];

    const res = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/readme`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github.raw+json",
            },
        }
    );

    if (!res.ok) return undefined;

    const text = await res.text();
    // Cap README text at 5000 chars to limit processing
    return text.length > 5000 ? text.substring(0, 5000) : text;
}
