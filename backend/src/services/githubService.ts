/**
 * githubService.ts
 *
 * Responsibilities:
 *   1. Fetch all repos from the GitHub API (paginated)
 *   2. Score and rank repos for analysis selection
 *   3. Classify solo vs collaborative based on contributor share
 *   4. Provide typed fetchers for languages, contributors, commits, readme
 *
 * NO raw repo data is written to the database here.
 * syncUserGithubRepos only stores githubLogin on UserAuth so the
 * analysis pipeline can identify the user's commits later.
 */

import axios from "axios";
import { prisma } from "../lib/prisma";

// ─────────────────────────────────────────────
// Custom errors
// ─────────────────────────────────────────────

export class GitHubUnauthorizedError extends Error {
  constructor(message = "GitHub token unauthorized or expired") {
    super(message);
    this.name = "GitHubUnauthorizedError";
  }
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type GitHubRepoAPI = {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  size: number; // KB
  updated_at: string;
  html_url: string;
  fork: boolean;
};

export type GitHubContributor = {
  login: string;
  contributions: number;
};

export type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
  author: { login: string } | null;
};

export type GitHubCommitDetail = GitHubCommit & {
  files: {
    filename: string;
    additions: number;
    deletions: number;
    status: string;
  }[];
};

export type ProjectType = "solo" | "collaborative";

export type ScoredRepo = GitHubRepoAPI & { selectionScore: number };

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const GITHUB_API_BASE = "https://api.github.com";
export const TOP_REPO_COUNT = 15;
const COMMIT_FETCH_LIMIT = 15;

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubGet<T>(
  url: string,
  token: string,
  params?: Record<string, unknown>,
): Promise<T> {
  try {
    const res = await axios.get<T>(url, {
      headers: githubHeaders(token),
      params,
    });
    return res.data;
  } catch (error: any) {
    if (error?.response?.status === 401) throw new GitHubUnauthorizedError();
    const msg =
      (error?.response?.data && JSON.stringify(error.response.data)) ||
      error?.message ||
      "Unknown GitHub API error";
    throw new Error(`GitHub API error (${url}): ${msg}`);
  }
}

async function getUserGithubToken(userId: string): Promise<string> {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: { githubAccessToken: true, githubConnected: true },
  });
  if (!user?.githubAccessToken || !user.githubConnected) {
    throw new Error("GitHub is not connected for this user.");
  }
  return user.githubAccessToken;
}

// ─────────────────────────────────────────────
// Repo scoring
// ─────────────────────────────────────────────

/**
 * Score a repo for selection priority (0–100).
 *
 * Stars        — 25 pts (log scale)
 * Forks        — 15 pts (log scale)
 * Recency      — 30 pts (linear decay over 2 years)
 * Size         — 20 pts (sweet-spot 100–5000 KB)
 * Has description — 10 pts
 * Fork penalty — 40% reduction (forked repos aren't original work)
 */
export function scoreRepo(repo: GitHubRepoAPI): number {
  const starScore = (Math.log2(repo.stargazers_count + 1) / Math.log2(1001)) * 25;
  const forkScore = (Math.log2(repo.forks_count + 1) / Math.log2(201)) * 15;

  const daysSinceUpdate =
    (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 30 - (daysSinceUpdate / 730) * 30);

  const sizeScore = (() => {
    const kb = repo.size;
    if (kb < 10) return 2;
    if (kb < 100) return 10;
    if (kb <= 5000) return 20;
    if (kb <= 50000) return 15;
    return 8;
  })();

  const descScore = repo.description ? 10 : 0;
  const raw = starScore + forkScore + recencyScore + sizeScore + descScore;
  return repo.fork ? raw * 0.6 : raw;
}

export function selectTopRepos(repos: GitHubRepoAPI[], count = TOP_REPO_COUNT): ScoredRepo[] {
  return repos
    .map((r) => ({ ...r, selectionScore: scoreRepo(r) }))
    .sort((a, b) => b.selectionScore - a.selectionScore)
    .slice(0, count);
}

// ─────────────────────────────────────────────
// Project type classification
// ─────────────────────────────────────────────

/**
 * Solo: user owns ≥ 80% of contributions OR is the only contributor.
 * Collaborative: anything else — only user's commits are analyzed.
 */
export function classifyProjectType(
  contributors: GitHubContributor[],
  userLogin: string,
): { type: ProjectType; collaboratorCount: number } {
  if (contributors.length === 0) return { type: "solo", collaboratorCount: 1 };

  const total = contributors.reduce((sum, c) => sum + c.contributions, 0);
  const userContribs =
    contributors.find((c) => c.login === userLogin)?.contributions ?? 0;
  const userShare = total > 0 ? userContribs / total : 0;

  const type: ProjectType =
    userShare >= 0.8 || contributors.length === 1 ? "solo" : "collaborative";
  return { type, collaboratorCount: contributors.length };
}

// ─────────────────────────────────────────────
// GitHub API fetchers (used by analysis service)
// ─────────────────────────────────────────────

export async function fetchAllGithubRepos(token: string): Promise<GitHubRepoAPI[]> {
  const perPage = 100;
  let page = 1;
  const repos: GitHubRepoAPI[] = [];

  while (true) {
    const pageData = await githubGet<GitHubRepoAPI[]>(
      `${GITHUB_API_BASE}/user/repos`,
      token,
      { per_page: perPage, page, sort: "updated" },
    );
    if (!pageData.length) break;
    repos.push(...pageData);
    if (pageData.length < perPage) break;
    page += 1;
  }

  return repos;
}

export async function fetchAuthenticatedUserLogin(token: string): Promise<string> {
  const data = await githubGet<{ login: string }>(`${GITHUB_API_BASE}/user`, token);
  return data.login;
}

export async function fetchRepoLanguages(
  owner: string,
  name: string,
  token: string,
): Promise<Record<string, number>> {
  return githubGet<Record<string, number>>(
    `${GITHUB_API_BASE}/repos/${owner}/${name}/languages`,
    token,
  );
}

export async function fetchRepoContributors(
  owner: string,
  name: string,
  token: string,
): Promise<GitHubContributor[]> {
  try {
    return await githubGet<GitHubContributor[]>(
      `${GITHUB_API_BASE}/repos/${owner}/${name}/contributors`,
      token,
      { per_page: 100 },
    );
  } catch {
    return []; // 404 on empty repos
  }
}

export async function fetchRepoCommits(
  owner: string,
  name: string,
  token: string,
  authorLogin?: string,
  perPage = COMMIT_FETCH_LIMIT,
): Promise<GitHubCommit[]> {
  const params: Record<string, unknown> = { per_page: perPage };
  if (authorLogin) params.author = authorLogin;
  try {
    return await githubGet<GitHubCommit[]>(
      `${GITHUB_API_BASE}/repos/${owner}/${name}/commits`,
      token,
      params,
    );
  } catch {
    return [];
  }
}

export async function fetchCommitDetail(
  owner: string,
  name: string,
  sha: string,
  token: string,
): Promise<GitHubCommitDetail | null> {
  try {
    return await githubGet<GitHubCommitDetail>(
      `${GITHUB_API_BASE}/repos/${owner}/${name}/commits/${sha}`,
      token,
    );
  } catch {
    return null;
  }
}

export async function fetchRepoReadme(
  owner: string,
  name: string,
  token: string,
): Promise<string | null> {
  try {
    const data = await githubGet<{ content: string; encoding: string }>(
      `${GITHUB_API_BASE}/repos/${owner}/${name}/readme`,
      token,
    );
    if (data.encoding === "base64") {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
    }
    return data.content;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Sync — stores only githubLogin, no raw repo data
// ─────────────────────────────────────────────

/**
 * Fetches all repos from GitHub, resolves + stores githubLogin,
 * and returns the count. No repo rows are written to the database.
 * Raw repos stay in memory for the analysis pipeline to consume.
 */
export async function syncUserGithubRepos(
  userId: string,
): Promise<{ syncedCount: number }> {
  const token = await getUserGithubToken(userId);

  let repos: GitHubRepoAPI[];
  try {
    repos = await fetchAllGithubRepos(token);
  } catch (error) {
    if (error instanceof GitHubUnauthorizedError) {
      await prisma.userAuth.update({
        where: { id: userId },
        data: { githubConnected: false },
      });
      throw error;
    }
    throw error;
  }

  // Persist the GitHub username so analysis can identify the user's commits
  const githubLogin = await fetchAuthenticatedUserLogin(token).catch(() => null);
  if (githubLogin) {
    await prisma.userAuth.update({
      where: { id: userId },
      data: { githubLogin },
    });
  }

  return { syncedCount: repos.length };
}