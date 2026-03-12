// src/lib/api/resume-api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export interface ProjectMatchScore {
    project: string;
    score: number;
}

export interface ExperienceMatchScore {
    role: string;
    score: number;
}

export interface ComparisonScores {
    projectMatch: ProjectMatchScore[];
    experienceMatch: ExperienceMatchScore[];
}

export interface AtsEvaluationResult {
    atsScore: number;
    keywordMatch: Array<{ keyword: string; matched: boolean }>;
    missingSkills: string[];
    suggestions: string[];
}

// ── User Data types (from LinkedIn ZIP) ──────────────────────────────────────

export interface UserPosition {
    company: string;
    title: string;
    location: string;
    start: string;
    end: string;
    description: string;
}

export interface UserEducation {
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    activities: string;
}

export interface UserCertification {
    name: string;
    authority: string;
    startDate: string;
    endDate: string;
    url: string;
}

export interface UserHonor {
    title: string;
    issuer: string;
    date: string;
    description: string;
}

export interface UserCourse {
    name: string;
    number: string;
}

export interface UserResumeData {
    positions: UserPosition[];
    education: UserEducation[];
    certifications: UserCertification[];
    honors: UserHonor[];
    courses: UserCourse[];
    skills: string[];
}

export const resumeApi = {
    /**
     * Fetches per-project and per-experience relevance scores based on the
     * user's latest JobDescriptionInsight. Returns empty arrays if no JD has
     * been analyzed yet (i.e. the user skipped Step 1).
     */
    async getComparisonScores(): Promise<ComparisonScores> {
        const res = await fetch(`${API_BASE}/api/resume/comparison-scores`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
        });

        if (!res.ok) {
            throw new Error('Failed to fetch comparison scores');
        }

        const data = await res.json();
        return {
            projectMatch: Array.isArray(data.projectMatch) ? data.projectMatch : [],
            experienceMatch: Array.isArray(data.experienceMatch) ? data.experienceMatch : [],
        };
    },

    /**
     * Evaluates a drafted resume against the JD to provide an ATS score and suggestions.
     */
    async evaluateAtsScore(resumeData: any): Promise<AtsEvaluationResult> {
        const res = await fetch(`${API_BASE}/api/resume/ats-score`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ resumeData }),
        });

        if (!res.ok) {
            throw new Error('Failed to evaluate ATS score');
        }

        const data = await res.json();
        return data.evaluation;
    },

    /**
     * Fetches all user LinkedIn data (positions, education, certifications,
     * honors, courses, skills) for resume form autofill.
     */
    async getUserData(): Promise<UserResumeData> {
        const res = await fetch(`${API_BASE}/api/resume/user-data`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
        });

        if (!res.ok) {
            throw new Error('Failed to fetch user data');
        }

        const data = await res.json();
        return {
            positions: Array.isArray(data.positions) ? data.positions : [],
            education: Array.isArray(data.education) ? data.education : [],
            certifications: Array.isArray(data.certifications) ? data.certifications : [],
            honors: Array.isArray(data.honors) ? data.honors : [],
            courses: Array.isArray(data.courses) ? data.courses : [],
            skills: Array.isArray(data.skills) ? data.skills : [],
        };
    },

    /**
     * Sends textarea text to Gemini AI for professional rewriting.
     */
    async improveText(text: string, context: string): Promise<{ improvedText: string }> {
        const res = await fetch(`${API_BASE}/api/resume/improve-text`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, context }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to improve text');
        }

        return res.json();
    },
};
