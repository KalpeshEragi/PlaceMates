const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ── LinkedIn Insight Types ────────────────────────────── */

export interface LinkedinInsightData {
  id: string;
  userId: string;
  totalExperienceYears: number | null;
  careerGrowthSpeed: number | null;
  primaryDomain: string | null;
  secondaryDomain: string | null;
  technicalOrientation: string | null;
  leadershipScore: number | null;
  impactScore: number | null;
  ownershipScore: number | null;
  profileScore: number | null;
  careerSummary: string | null;
  strengthsSummary: string | null;
  improvementSuggestions: string | null;
  processedAt: string | null;
}

export interface LinkedinSkillInsightData {
  id: string;
  userId: string;
  skillName: string;
  frequency: number;
  cluster: string | null;
}

export interface LinkedinExperience {
  companyName: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface LinkedinEducation {
  schoolName: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  activities?: string;
  notes?: string;
}

export interface LinkedinSkill {
  name: string;
}

export interface LinkedinCertification {
  name: string;
  authority?: string;
  licenseNumber?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface LinkedinProject {
  title: string;
  description?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface LinkedinAward {
  title: string;
  issuer?: string;
  issueDate?: string;
  description?: string;
}

export interface LinkedinParsedProfile {
  personal: {
    firstName?: string;
    lastName?: string;
    headline?: string;
    location?: string;
    industry?: string;
    profileUrl?: string;
  };
  about: string;
  contact: {
    emails: string[];
    phones: string[];
  };
  experience: LinkedinExperience[];
  education: LinkedinEducation[];
  skills: LinkedinSkill[];
  projects: LinkedinProject[];
  certifications: LinkedinCertification[];
  awards: LinkedinAward[];
}

export interface LinkedinInsightsResponse {
  linkedinImported: boolean;
  linkedinZipPath: string | null;
  insight: LinkedinInsightData | null;
  skills: LinkedinSkillInsightData[];
  parsedProfile: LinkedinParsedProfile | null;
}

/* ── API Client ────────────────────────────────────────── */

export const linkedinApi = {
  async getInsights(): Promise<LinkedinInsightsResponse> {
    const response = await fetch(`${API_BASE}/linkedin/data`, {
      method: "GET",
      headers: {
        ...authHeaders(),
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error(body.error || "You are not authenticated. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(
        body.message || body.error || "Failed to fetch LinkedIn insights"
      );
    }

    return body as LinkedinInsightsResponse;
  },
};
