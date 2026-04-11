const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function errorMessage(body: Record<string, unknown>, status: number): string {
  const message = typeof body.message === "string" ? body.message : "";
  const error = typeof body.error === "string" ? body.error : "";
  if (message) return message;
  if (error) return error;
  return `API error ${status}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
      ...(options.headers as Record<string, string>),
    },
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return body as T;
}

export type ProjectType = "solo" | "collaborative";

export type ImpactEntry = {
  type:
    | "reduced_response_time"
    | "reduced_cost"
    | "improved_scale"
    | "improved_productivity";
  value?: number | null;
  unit?: string | null;
};

export interface ProjectDto {
  id: string;
  name: string;
  repoUrl: string;
  domain: string | null;
  projectType: ProjectType;
  collaborators: number;
  techStack: string[];
  description: string | null;
  baseBullets: string[];
  finalBullets: string[];
  rankingScore?: number | null;
  projectIntent?: string | null;
  contributionArea?: string | null;
  quizExtraNotes?: string | null;
  impactEntries?: unknown;
  // GitHub metadata
  stars?: number;
  forks?: number;
  repoDescription?: string | null;
  readmeExcerpt?: string | null;
  // AI enrichments
  aiDescription?: string | null;
  aiSkills?: string[];
  aiComplexity?: string | null;
  aiUniqueAngle?: string | null;
  updatedAt: string;
}

export interface SkillDto {
  id: string;
  name: string;
  domain: string | null;
  source: "github" | "linkedin" | "both";
}

export interface IntegrationStatus {
  githubConnected: boolean;
  githubLogin: string | null;
  linkedinImported: boolean;
  onboardingStage: "new" | "github_connected" | "linkedin_imported" | "ready";
  analysisStatus: "idle" | "running" | "success" | "failed";
  analysisError: string | null;
  selectedProjectCount: number;
  portfolioQuizCompleted: boolean;
  onboardingOutputFinalized: boolean;
  portfolioTemplateId: string | null;
  resumeTemplateId: string | null;
  dataSummary: { projects: number; skills: number; experiences: number };
}

export interface PublicPortfolioData {
  name: string;
  role: string;
  summary: string;
  skills: string[];
  profileImageUrl?: string | null;
  projects: Array<{
    id?: string;
    name: string;
    description: string;
    techStack: string[];
    finalBullets: string[];
    projectIntent?: string | null;
    imageUrl?: string | null;
    repoUrl?: string;
  }>;
  experience: Array<{
    role: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education: Array<{ institution: string; degree: string; duration: string }>;
  awards: Array<{ title: string; description?: string }>;
}

export interface PublicPortfolioResponse {
  templateId: string;
  data: PublicPortfolioData;
  meta: { githubUrl: string | null; linkedinUrl: string | null; email: string; profileImageUrl?: string | null };
}

/** Authenticated GET /user/preview-data */
export interface UserPreviewPayload {
  portfolioTemplateId: string | null;
  resumeTemplateId: string | null;
  onboardingOutputFinalizedAt: string | null;
  portfolioData: PublicPortfolioData;
  resumeData: {
    name?: string;
    email: string;
    summary?: string;
    skills: Array<{ name: string; domain?: string }>;
    projects: Array<{
      name: string;
      techStack: string[];
      finalBullets: string[];
      description?: string;
    }>;
    experiences: Array<{
      role: string;
      company: string;
      startDate?: string;
      endDate?: string;
      description?: string;
    }>;
    educations: Array<{
      institution: string;
      degree?: string;
      field?: string;
      startDate?: string;
      endDate?: string;
      gpa?: string;
    }>;
    awards?: Array<{ title: string; description?: string; issuedAt?: string }>;
    certifications?: Array<{ name: string; issuer?: string; issuedAt?: string }>;
  };
  meta: { email: string; githubUrl: string | null; linkedinUrl: string | null; profileImageUrl?: string | null };
}

export type FinalizeProjectPayload = {
  id: string;
  finalBullets: string[];
  projectIntent?: string | null;
};

export interface FinalizeOutputBody {
  portfolioTemplate: string;
  resumeTemplate: string;
  summary: string;
  skills: string[];
  projects: FinalizeProjectPayload[];
}

export const onboardingApi = {
  getStatus(): Promise<IntegrationStatus> {
    return request<IntegrationStatus>("/integrations/status");
  },

  triggerGithubAnalysis(): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>("/github/analyze", {
      method: "POST",
    });
  },

  triggerLinkedinAnalysis(): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>("/linkedin/analyze", {
      method: "POST",
    });
  },

  getProjectCandidates(): Promise<{ projects: ProjectDto[] }> {
    return request<{ projects: ProjectDto[] }>("/projects/candidates");
  },

  getSelectedProjects(): Promise<{ projects: ProjectDto[] }> {
    return request<{ projects: ProjectDto[] }>("/projects/selected");
  },

  selectPortfolioProjects(projectIds: string[]): Promise<{ success: boolean; projectIds: string[] }> {
    return request<{ success: boolean; projectIds: string[] }>("/projects/select", {
      method: "POST",
      body: JSON.stringify({ projectIds }),
    });
  },

  /** Backward compatible: returns selected projects when a selection exists, else top 5. */
  async getAnalyzedProjects(): Promise<{ projects: ProjectDto[] }> {
    return request<{ projects: ProjectDto[] }>("/projects/analyzed");
  },

  /** Batch finalize: submit all project intents at once + AI enrichment */
  batchFinalize(
    projects: Array<{ projectId: string; intent: string }>,
  ): Promise<{ success: boolean; aiEnriched: boolean; projects: Array<{ projectId: string; finalBullets: string[] }> }> {
    return request<{ success: boolean; aiEnriched: boolean; projects: Array<{ projectId: string; finalBullets: string[] }> }>(
      "/projects/batch-finalize",
      {
        method: "POST",
        body: JSON.stringify({ projects }),
      },
    );
  },

  /** Resume Studio: update impact/contribution for a single project */
  updateProjectImpact(
    projectId: string,
    payload: {
      impactEntries?: unknown[];
      contributionArea?: string;
      extraNotes?: string;
    },
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/projects/${projectId}/update-impact`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  saveTemplate(
    portfolioTemplate: string,
    resumeTemplate: string,
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>("/user/template", {
      method: "POST",
      body: JSON.stringify({ portfolioTemplate, resumeTemplate }),
    });
  },

  getPortfolioUrl(): Promise<{ portfolioUrl: string }> {
    return request<{ portfolioUrl: string }>("/user/portfolio");
  },

  getPublicPortfolioBySlug(slug: string): Promise<PublicPortfolioResponse> {
    return request<PublicPortfolioResponse>(`/portfolio/${slug}`);
  },

  getPreviewData(): Promise<UserPreviewPayload> {
    return request<UserPreviewPayload>("/user/preview-data");
  },

  finalizeOutput(body: FinalizeOutputBody): Promise<{ success: boolean } & UserPreviewPayload> {
    return request<{ success: boolean } & UserPreviewPayload>("/user/finalize-output", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Upload profile image */
  async uploadProfileImage(file: File): Promise<{ success: boolean; imageUrl: string }> {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${API_BASE}/upload/profile-image`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error((body.error as string) || `Upload failed ${res.status}`);
    return body as { success: boolean; imageUrl: string };
  },

  /** Upload project image */
  async uploadProjectImage(projectId: string, file: File): Promise<{ success: boolean; imageUrl: string }> {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${API_BASE}/upload/project-image/${projectId}`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error((body.error as string) || `Upload failed ${res.status}`);
    return body as { success: boolean; imageUrl: string };
  },
};
