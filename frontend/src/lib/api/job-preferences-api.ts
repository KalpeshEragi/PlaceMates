import type { JobPreferences } from "@/app/(dashboard)/job-preferences/job-preferences-types";

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
    if (res.status === 404) {
      throw { status: 404, message: "Not found" };
    }
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

export const jobPreferencesApi = {
  /**
   * GET /job-preferences
   * Returns null if no preferences set yet (404 is treated as empty state)
   */
  get: async (): Promise<JobPreferences | null> => {
    try {
      const res = await request<{ data: JobPreferences }>("/job-preferences");
      return res.data;
    } catch (error: any) {
      if (error?.status === 404) return null;
      throw error;
    }
  },

  /**
   * POST /job-preferences
   * Creates or updates preferences (upsert on backend)
   */
  save: async (payload: JobPreferences): Promise<JobPreferences> => {
    const res = await request<{ data: JobPreferences }>("/job-preferences", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  },
};