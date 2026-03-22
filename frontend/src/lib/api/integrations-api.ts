// src/lib/api/integrations-api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Types matching integrationsController response ───────────

export type OnboardingStage =
  | "new"
  | "github_connected"
  | "linkedin_imported"
  | "ready";

export interface IntegrationStatus {
  githubConnected: boolean;
  githubLogin: string | null;
  linkedinImported: boolean;
  onboardingStage: OnboardingStage;
  /** Row counts — use to know if analysis has run yet */
  dataSummary: {
    projects: number;
    skills: number;
    experiences: number;
  };
}

// ─── API surface ──────────────────────────────────────────────

export const integrationsApi = {
  /**
   * GET /integrations/status
   * Returns connection state, onboarding stage, and data row counts.
   */
  async getStatus(): Promise<IntegrationStatus> {
    const res = await fetch(`${API_BASE}/integrations/status`, {
      headers: authHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to load integration status");
    }

    return res.json() as Promise<IntegrationStatus>;
  },

  /**
   * Redirect to GitHub OAuth.
   * Backend: GET /auth/github → GitHub → GET /auth/github/callback
   * Stage advances: new → github_connected
   */
  redirectToGithubConnect() {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    // Token is embedded in the state JWT by the backend — just redirect
    window.location.href = `${API_BASE}/auth/github`;
  },

  /**
   * POST /linkedin/upload  (multipart/form-data)
   * Saves the ZIP to disk and records linkedinZipPath on UserAuth.
   * Stage advances: github_connected → linkedin_imported
   */
  async uploadLinkedinZip(file: File): Promise<void> {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/linkedin/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "LinkedIn upload failed");
    }
  },
};