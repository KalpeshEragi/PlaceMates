import axios from "axios";
import { prisma } from "../lib/prisma";

export class GitHubUnauthorizedError extends Error {
  constructor(message = "GitHub token unauthorized or expired") {
    super(message);
    this.name = "GitHubUnauthorizedError";
  }
}

export type GitHubRepoAPI = {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  fork?: boolean;
  archived?: boolean;
  stargazers_count: number;
  forks_count: number;
  size: number;
  updated_at: string;
  pushed_at?: string;
  html_url: string;
};

export type GitHubCommitDetail = {
  sha: string;
  files?: { filename: string }[];
};

const GITHUB_API_BASE = "https://api.github.com";

async function getUserGithubAccessToken(userId: string): Promise<string> {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: { githubAccessToken: true, githubConnected: true },
  });

  if (!user || !user.githubAccessToken || !user.githubConnected) {
    throw new Error("GitHub is not connected for this user.");
  }

  return user.githubAccessToken;
}

export async function fetchAllGithubRepos(token: string): Promise<GitHubRepoAPI[]> {
  const perPage = 100;
  let page = 1;
  const repos: GitHubRepoAPI[] = [];

  while (true) {
    const url = `${GITHUB_API_BASE}/user/repos`;

    try {
      const response = await axios.get<GitHubRepoAPI[]>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        params: {
          per_page: perPage,
          page,
          sort: "updated",
        },
      });

      const pageData = response.data;
      if (!pageData.length) break;

      repos.push(...pageData);

      if (pageData.length < perPage) break;
      page += 1;
    } catch (error: any) {
      if (error?.response?.status === 401) {
        throw new GitHubUnauthorizedError();
      }
      throw new Error(`GitHub API error: ${error?.message || "Unknown error"}`);
    }
  }

  return repos;
}

export async function fetchRepoLanguages(owner: string, name: string, token: string): Promise<Record<string, number>> {
  const { data } = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${name}/languages`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
  });
  return data;
}

export async function fetchRepoContributors(owner: string, name: string, token: string): Promise<any[]> {
  const { data } = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${name}/contributors`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
  });
  return data;
}

export async function fetchRepoReadme(owner: string, name: string, token: string): Promise<string | null> {
  const { data } = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${name}/readme`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
  });
  if (data.content) {
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  return null;
}

export function classifyProjectType(contributors: any[], githubLogin: string): { type: "solo" | "collaborative", collaboratorCount: number } {
  const count = contributors?.length || 1;
  return { type: count > 1 ? "collaborative" : "solo", collaboratorCount: count };
}

export async function fetchRepoCommits(owner: string, name: string, token: string, githubLogin: string, limit: number): Promise<any[]> {
  const { data } = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${name}/commits`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    params: { author: githubLogin, per_page: limit }
  });
  return data;
}

export async function fetchCommitDetail(owner: string, name: string, sha: string, token: string): Promise<GitHubCommitDetail | null> {
  const { data } = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${name}/commits/${sha}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
  });
  return data;
}

export function selectTopRepos(
  repos: GitHubRepoAPI[],
  scoreByRepoId?: Map<number, number>,
  topN = 5,
): GitHubRepoAPI[] {
  return repos
    .sort((a, b) => {
      const scoreA =
        scoreByRepoId?.get(a.id) ??
        (a.stargazers_count * 2 +
          a.forks_count +
          new Date(a.updated_at).getTime() / 10000000000);
      const scoreB =
        scoreByRepoId?.get(b.id) ??
        (b.stargazers_count * 2 +
          b.forks_count +
          new Date(b.updated_at).getTime() / 10000000000);
      return scoreB - scoreA;
    })
    .slice(0, topN);
}

export async function syncUserGithubRepos(userId: string): Promise<{ syncedCount: number }> {
  const token = await getUserGithubAccessToken(userId);
  let repos: GitHubRepoAPI[];
  try {
    const { data: profile } = await axios.get(`${GITHUB_API_BASE}/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
    });
    const githubLogin = profile.login;

    await prisma.userAuth.update({
      where: { id: userId },
      data: { githubLogin },
    });

    repos = await fetchAllGithubRepos(token);
  } catch (error: any) {
    if (error instanceof GitHubUnauthorizedError || error?.response?.status === 401) {
      await prisma.userAuth.update({
        where: { id: userId },
        data: { githubConnected: false },
      });
      throw new GitHubUnauthorizedError();
    }
    throw error;
  }

  return { syncedCount: repos.length };
}
