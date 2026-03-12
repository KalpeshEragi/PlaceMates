// src/lib/api/linkedin-api.ts

export interface LinkedinInsight {
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
}

export interface LinkedinSkill {
  skillName: string;
  frequency: number;
  cluster: string | null;
}

export interface LinkedinPosition {
  company: string;
  title: string;
  location: string;
  start: string;
  end: string;
  description: string;
}

export interface LinkedinInsightsResponse {
  insight: LinkedinInsight | null;
  skills: LinkedinSkill[];
  positions: LinkedinPosition[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch LinkedIn insights");
  }

  return res.json();
}

export const linkedinApi = {
  getInsights: () =>
    request<LinkedinInsightsResponse>("/api/linkedin/insights"),

  analyze: async () => {
    const res = await fetch(
      `${API_BASE}/api/linkedin/analyze`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!res.ok) {
      throw new Error("Failed to start LinkedIn analysis");
    }

    return res.json();
  },
};

