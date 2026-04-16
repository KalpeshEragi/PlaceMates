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
  if (!res.ok) throw new Error((body.message as string) || `API error ${res.status}`);
  return body as T;
}

// ── Types ────────────────────────────────────────────────────

export interface EvaluationMetrics {
  precision5: number;
  precision10: number;
  recall5: number;
  recall10: number;
  ndcg5: number;
  ndcg10: number;
}

export interface ATSBucket {
  bucket: string;
  count: number;
}

export interface UserEvaluation {
  userId: string;
  metrics: EvaluationMetrics;
  semanticMatches: number;
  keywordMatches: number;
  averageAtsScore: number | null;
  resumeCount: number;
  atsDistribution: ATSBucket[];
}

export interface EvaluationResponse {
  success: boolean;
  evaluation: UserEvaluation;
}

// ── API ──────────────────────────────────────────────────────

export const evaluationApi = {
  run: async (): Promise<EvaluationResponse> => {
    return request<EvaluationResponse>("/evaluation/run", { method: "POST" });
  },
};
