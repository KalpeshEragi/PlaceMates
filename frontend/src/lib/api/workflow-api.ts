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

export interface WorkflowTriggerResponse {
  success: boolean;
  requestId: string;
  status: string;
  message: string;
}

export interface JobMatchResult {
  id: string;
  matchScore: number;
  semanticScore?: number | null;
  matchMethod?: "keyword" | "semantic" | string;
  createdAt?: string;
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    link: string;
    postedAt: string;
  };
}

export interface TailoredResumeResult {
  id: string;
  resumeUrl: string;
  atsScore?: number | null;
  iterations?: number;
  createdAt?: string;
  job: {
    id: string;
    title: string;
    company: string;
  };
}

export interface WorkflowResultsSummary {
  totalMatches: number;
  totalResumes: number;
  insights: {
    topSkillGaps?: string[];
    recommendedLearning?: string[];
    marketFit?: string;
    [key: string]: unknown;
  } | null;
}

export interface WorkflowStatusResponse {
  success: boolean;
  requestId?: string;
  status: "idle" | "pending" | "processing" | "completed" | "failed";
  triggerType?: "manual" | "cron";
  startedAt?: string;
  completedAt?: string;
  error?: string | null;
  message?: string;
  results?: {
    matches: JobMatchResult[];
    tailoredResumes: TailoredResumeResult[];
    summary: WorkflowResultsSummary;
  } | null;
}

export interface MyMatchesResponse {
  success: boolean;
  matches: JobMatchResult[];
  tailoredResumes: TailoredResumeResult[];
  totalMatches: number;
  totalResumes: number;
}

// ── API ──────────────────────────────────────────────────────

export const workflowApi = {
  /**
   * POST /workflow/trigger
   * Starts the n8n job matching workflow. Returns immediately with a requestId.
   */
  trigger: async (): Promise<WorkflowTriggerResponse> => {
    return request<WorkflowTriggerResponse>("/workflow/trigger", {
      method: "POST",
    });
  },

  /**
   * GET /workflow/status/me
   * Polls for workflow progress and fetches results when complete.
   */
  getStatus: async (): Promise<WorkflowStatusResponse> => {
    return request<WorkflowStatusResponse>("/workflow/status/me");
  },

  /**
   * GET /workflow/my-matches
   * Fetches all job matches and tailored resumes for the user.
   */
  getMyMatches: async (): Promise<MyMatchesResponse> => {
    return request<MyMatchesResponse>("/workflow/my-matches");
  },
};

