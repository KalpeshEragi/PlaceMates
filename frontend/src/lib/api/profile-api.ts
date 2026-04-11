/**
 * profile-api.ts
 *
 * Frontend API client for the Profile + Insights module.
 * Follows the same request<T>() pattern used by auth-api.ts & onboarding-api.ts.
 */

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

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof body.error === "string"
        ? body.error
        : typeof body.message === "string"
          ? body.message
          : `API error ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ProfileInsights {
  primaryDomain: string | null;
  secondaryDomain: string | null;
  skillDistribution: Record<string, number>;
  topTechnologies: { name: string; count: number }[];
  projectStats: {
    totalProjects: number;
    fullStackProjects: number;
    mobileProjects: number;
    frontendProjects: number;
    backendProjects: number;
    mlProjects: number;
  };
  contributionSummary:
    | "frontend-heavy"
    | "backend-heavy"
    | "balanced"
    | "unknown";
  experienceLevel: "Beginner" | "Intermediate" | "Advanced";
  profileStrength: number;
}

export interface ExperienceEntry {
  id?: string;
  role: string;
  company: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

export interface EducationEntry {
  id?: string;
  institution: string;
  degree?: string | null;
  field?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  gpa?: string | null;
}

export interface SkillEntry {
  id?: string;
  name: string;
  domain: string | null;
  source: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  repoUrl: string;
  domain: string | null;
  projectType: string;
  techStack: string[];
  description: string | null;
  finalBullets: string[];
  baseBullets: string[];
  rankingScore: number | null;
}

export interface ProfileData {
  email: string;
  githubLogin: string | null;
  githubConnected: boolean;
  linkedinImported: boolean;
  name: string | null;
  avatarUrl: string | null;
  summary: string | null;
  primaryDomain: string | null;
  projects: ProjectEntry[];
  skills: SkillEntry[];
  experiences: ExperienceEntry[];
  educations: EducationEntry[];
  awards: { id: string; title: string; description?: string | null; issuedAt?: string | null }[];
  certifications: { id: string; name: string; issuer?: string | null; issuedAt?: string | null }[];
}

export interface UpdateProfileBody {
  name?: string;
  summary?: string;
  skills?: string[];
  experiences?: ExperienceEntry[];
  educations?: EducationEntry[];
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────

export const profileApi = {
  /** GET /profile/data — full editable profile payload */
  getData(): Promise<ProfileData> {
    return request<ProfileData>("/profile/data");
  },

  /** PUT /profile/data — save partial updates */
  updateData(body: UpdateProfileBody): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>("/profile/data", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  /** GET /profile/insights — computed profile insights */
  getInsights(): Promise<ProfileInsights> {
    return request<ProfileInsights>("/profile/insights");
  },
};
