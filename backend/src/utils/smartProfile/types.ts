// ────────────────────────────────────────────────────────────
// Smart Profile — Type Definitions
// ────────────────────────────────────────────────────────────

/**
 * Final Smart Profile stored in the database.
 */
export interface SmartProfile {
    primaryDomain: string;
    topSkills: string[];
    secondarySkills: string[];
    strongestLanguages: string[];
    experienceLevel: string;
    topProjects: RankedProject[];
    githubActivityScore: string;
    aiSummary: string;
    generatedAt: string; // ISO timestamp
}

/**
 * A ranked GitHub project selected for the smart profile.
 */
export interface RankedProject {
    name: string;
    description: string;
    url: string;
    languages: string[];
    stars: number;
    score: number;
}

/**
 * Internal skill with frequency scoring.
 */
export interface ScoredSkill {
    name: string;       // lowercased, deduplicated
    score: number;      // weighted sum
    sources: string[];  // where it came from: "linkedin" | "github" | "readme"
}

/**
 * Shape of a single GitHub repo as stored in importedData.githubRepos.
 * Subset of the GitHub API response we actually use.
 */
export interface GitHubRepo {
    name: string;
    description: string | null;
    html_url: string;
    language: string | null;
    languages_url?: string;
    stargazers_count: number;
    updated_at: string;
    fork: boolean;
    topics?: string[];
}

/**
 * Inputs gathered from the DB for the smart profile pipeline.
 */
export interface SmartProfileInput {
    linkedInSkills: string[];
    linkedInExperience: Array<{
        title: string;
        companyName: string;
        startDate?: string;
        endDate?: string;
        description?: string;
    }>;
    linkedInEducation: Array<{
        schoolName: string;
        degree?: string;
        fieldOfStudy?: string;
    }>;
    linkedInProjects: Array<{
        title: string;
        description?: string;
    }>;
    linkedInHeadline?: string;
    githubRepos: GitHubRepo[];
}
