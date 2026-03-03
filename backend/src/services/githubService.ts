import axios from "axios";
import { prisma } from "../lib/prisma";

export class GitHubUnauthorizedError extends Error {
  constructor(message = "GitHub token unauthorized or expired") {
    super(message);
    this.name = "GitHubUnauthorizedError";
  }
}

type GitHubRepoAPI = {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  size: number;
  updated_at: string;
  html_url: string;
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

async function fetchAllGithubRepos(token: string): Promise<GitHubRepoAPI[]> {
  const perPage = 100;
  let page = 1;
  const repos: GitHubRepoAPI[] = [];

  // Paginate until we get an empty page
  // or a page that contains fewer than perPage items.
  // This ensures we don't skip pagination.
  // We always use the authenticated /user/repos endpoint.
  // No access tokens are logged.
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

      if (!pageData.length) {
        break;
      }

      repos.push(...pageData);

      if (pageData.length < perPage) {
        break;
      }

      page += 1;
    } catch (error: any) {
      const status = error?.response?.status as number | undefined;

      if (status === 401) {
        throw new GitHubUnauthorizedError();
      }

      const message =
        (error?.response?.data && JSON.stringify(error.response.data)) ||
        error?.message ||
        "Unknown GitHub API error";
      throw new Error(`GitHub API error: ${message}`);
    }
  }

  return repos;
}

export async function syncUserGithubRepos(userId: string): Promise<{ syncedCount: number }> {
  const token = await getUserGithubAccessToken(userId);

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

  if (!repos.length) {
    return { syncedCount: 0 };
  }

  const now = new Date();

  await prisma.$transaction(
    repos.map((repo) =>
      prisma.githubRepository.upsert({
        where: { repoId: repo.id },
        create: {
          userId,
          repoId: repo.id,
          name: repo.name,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          size: repo.size,
          repoUrl: repo.html_url,
          updatedAt: new Date(repo.updated_at),
          lastSyncedAt: now,
        },
        update: {
          userId,
          name: repo.name,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          size: repo.size,
          repoUrl: repo.html_url,
          updatedAt: new Date(repo.updated_at),
          lastSyncedAt: now,
        },
      })
    )
  );

  return { syncedCount: repos.length };
}

