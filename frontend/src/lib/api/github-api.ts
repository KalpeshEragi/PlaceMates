// src/lib/api/github-api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers as Record<string, string>),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    if (body?.error === "github_token_expired") {
      throw new Error(body.message || "Your GitHub connection has expired. Please reconnect.");
    }
    throw new Error(body.error || "Not authenticated. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(body.message || body.error || `API error ${res.status}`);
  }

  return body as T;
}

// ─── Types matching the Project model ────────────────────────

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  domain: string | null;          // Frontend | Backend | ML | DevOps | Mobile
  projectType: string;            // "solo" | "collaborative"
  collaborators: number;
  techStack: string[];
  description: string | null;     // denormalized display string
  baseBullets: string[];          // AI-generated, pre-quiz
  finalBullets: string[];         // metric-injected, post-quiz
  updatedAt: string;
}

// ─── Types matching the Skill model ──────────────────────────

export interface Skill {
  id: string;
  name: string;
  domain: string | null;          // Frontend | Backend | ML | DevOps | Other
  source: string;                 // "github" | "linkedin" | "both"
}

// ─── GET /github/data response ───────────────────────────────

export interface GithubDataResponse {
  projects: Project[];
  skills: Skill[];
}

// ─── API surface ─────────────────────────────────────────────

export const githubApi = {
  /**
   * POST /github/sync
   * Fetches all repos from GitHub API, resolves githubLogin, scores repos.
   * No repo rows written to DB — only githubLogin on UserAuth.
   */
  async syncRepos(): Promise<{ syncedCount: number }> {
    return request<{ syncedCount: number }>("/github/sync", { method: "POST" });
  },

  /**
   * POST /github/analyze
   * Fires the analysis pipeline async (returns 202 immediately).
   * Pipeline: GitHub API → top 15 repos → bullets → skills → summary
   */
  async analyzeRepos(): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>("/github/analyze", { method: "POST" });
  },

  /**
   * GET /github/data
   * Returns Projects and GitHub-sourced Skills stored in DB.
   * Call this to poll for results after analyzeRepos().
   */
  async getData(): Promise<GithubDataResponse> {
    return request<GithubDataResponse>("/github/data");
  },
};