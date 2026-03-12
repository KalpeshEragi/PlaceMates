const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
};

/* ── Insights Types ─────────────────────────────────────── */

export interface InsightProject {
  id: string;
  name: string;
  repoUrl: string;
  finalScore: number | null;
  stars: number;
  forks: number;
  detectedDomain: string | null;
  totalLoc: number | null;
}

export interface InsightSkill {
  skillName: string;
  strengthScore: number;
  source: string;
}

export interface InsightDomain {
  domain: string;
  count: number;
}

export interface InsightRepository {
  id: string;
  name: string;
  repoUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  totalLoc: number | null;
  detectedDomain: string | null;
  resumeScore: number | null;
  impactScore: number | null;
  finalScore: number | null;
  processedAt: string | null;
}

export interface InsightsResponse {
  topProjects: InsightProject[];
  topSkills: InsightSkill[];
  topDomains: InsightDomain[];
  repositories: InsightRepository[];
}

/* ── Activity Types (Radar + Pie charts) ───────────────── */

export interface RadarDataPoint {
  category: string;
  value: number;
  fullMark: number;
}

export interface PieDataPoint {
  name: string;
  value: number;
  fill: string;
}

export interface ActivityStats {
  totalEvents: number;
  activeDays: number;
  topCollaboratedRepos: string[];
}

export interface GitHubActivityResponse {
  radarData: RadarDataPoint[];
  pieData: PieDataPoint[];
  stats: ActivityStats;
}

export const githubApi = {
  async syncRepos(): Promise<{ syncedCount: number }> {
    const response = await fetch(`${API_BASE}/github/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      if (body?.error === "github_token_expired") {
        throw new Error(
          body.message || "Your GitHub connection has expired. Please reconnect GitHub."
        );
      }

      throw new Error(body.error || "You are not authenticated. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(
        body.message || body.error || "Failed to sync GitHub repositories"
      );
    }

    return {
      syncedCount: body.syncedCount ?? 0,
    };
  },

  async analyzeRepos(): Promise<void> {
    const response = await fetch(`${API_BASE}/github/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error(body.error || "You are not authenticated. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(
        body.message || body.error || "Failed to start GitHub repository analysis"
      );
    }
  },

  async listRepos(): Promise<GithubRepo[]> {
    // Sync repos first, then fetch insights to get the repo list
    await this.syncRepos();
    const insights = await this.getInsights();
    return insights.repositories.map((repo) => ({
      id: Number(repo.id) || 0,
      name: repo.name,
      full_name: repo.name,
      private: false,
      html_url: repo.repoUrl,
      description: repo.description,
      language: repo.language,
      stargazers_count: repo.stars,
      forks_count: repo.forks,
      updated_at: repo.processedAt ?? new Date().toISOString(),
    }));
  },

  async getInsights(): Promise<InsightsResponse> {
    const response = await fetch(`${API_BASE}/github/insights`, {
      method: "GET",
      headers: {
        ...authHeaders(),
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error(body.error || "You are not authenticated. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(
        body.message || body.error || "Failed to fetch GitHub insights"
      );
    }

    return body as InsightsResponse;
  },

  async getActivity(): Promise<GitHubActivityResponse> {
    const response = await fetch(`${API_BASE}/github/activity`, {
      method: "GET",
      headers: {
        ...authHeaders(),
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error(body.error || "You are not authenticated. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(
        body.message || body.error || "Failed to fetch GitHub activity data"
      );
    }

    return body as GitHubActivityResponse;
  },
};

