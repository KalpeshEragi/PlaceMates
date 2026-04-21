import { TailoredResumeResult } from "./workflow-api";

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

export interface AdminResumeResult extends TailoredResumeResult {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AllResumesResponse {
  success: boolean;
  resumes: AdminResumeResult[];
  totalResumes: number;
}

export const adminApi = {
  /**
   * GET /admin/all-resumes
   * Fetches all tailored resumes across the platform.
   */
  getAllResumes: async (): Promise<AllResumesResponse> => {
    return request<AllResumesResponse>("/admin/all-resumes");
  },
};
