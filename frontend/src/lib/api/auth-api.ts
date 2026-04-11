// src/lib/api/auth-api.ts

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
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json();
}

// Matches GET /auth/me → select on UserAuth + UserProfile
export interface MeResponse {
  id: string;
  email: string;
  onboardingStage: "new" | "github_connected" | "linkedin_imported" | "ready";
  githubConnected: boolean;
  githubLogin: string | null;
  linkedinImported: boolean;
  createdAt: string;
  profile: {
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

export const authApi = {
  /** GET /auth/me — returns current user + onboarding state */
  getMe(): Promise<MeResponse> {
    return request<MeResponse>("/auth/me");
  },
};