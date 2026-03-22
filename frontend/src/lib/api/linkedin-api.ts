// src/lib/api/linkedin-api.ts

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

  if (!res.ok) {
    throw new Error(body.error || `API error ${res.status}`);
  }

  return body as T;
}

// ─── Types matching LinkedIn pipeline DB models ───────────────

export interface Experience {
  id: string;
  role: string;
  company: string;
  startDate: string | null;   // "Jan 2022" — LinkedIn format
  endDate: string | null;     // null = present
  description: string | null; // AI-refined, resume-ready
}

export interface Education {
  id: string;
  institution: string;
  degree: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
  gpa: string | null;         // "8.5 / 10" stored as-is
}

export interface Award {
  id: string;
  title: string;
  description: string | null;
  issuedAt: string | null;    // "May 2023"
}

export interface Certification {
  id: string;
  name: string;
  issuer: string | null;
  issuedAt: string | null;    // "March 2024"
}

// Skills here are LinkedIn-sourced (source = "linkedin" | "both")
export interface Skill {
  id: string;
  name: string;
  domain: string | null;
  source: string;
}

// ─── GET /linkedin/data response ─────────────────────────────

export interface LinkedinDataResponse {
  experiences: Experience[];
  educations: Education[];
  awards: Award[];
  certifications: Certification[];
  skills: Skill[];
}

// ─── API surface ─────────────────────────────────────────────

export const linkedinApi = {
  /**
   * GET /linkedin/data
   * Returns all LinkedIn-extracted data from DB.
   * Call this after analyzeLinkedin() has completed.
   */
  getData(): Promise<LinkedinDataResponse> {
    return request<LinkedinDataResponse>("/linkedin/data");
  },

  /**
   * POST /linkedin/analyze
   * Fires the LinkedIn analysis pipeline async (returns 202 immediately).
   * Pipeline: ZIP → CSV parse → AI refinement → DB persist → markReadyIfComplete
   */
  async analyze(): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>("/linkedin/analyze", {
      method: "POST",
    });
  },
};