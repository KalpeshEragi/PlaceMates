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

// ── Types ────────────────────────────────────────────────────

export interface TriggerMatchingResponse {
  success: boolean;
  requestId: string;
  status: string;
}

// ── API ──────────────────────────────────────────────────────

export const jobsApi = {
  /**
   * POST /jobs/trigger-matching
   * Starts the n8n job matching workflow from the frontend.
   */
  triggerMatching: async (): Promise<TriggerMatchingResponse> => {
    return request<TriggerMatchingResponse>("/jobs/trigger-matching", {
      method: "POST",
    });
  },
};
