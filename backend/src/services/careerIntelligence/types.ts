// ────────────────────────────────────────────────────────────
// Career Intelligence — Type Definitions
// ────────────────────────────────────────────────────────────

// ── Career Level ──────────────────────────────────────────

export type CareerLevel =
    | "Student"
    | "Industry-ready student"
    | "Entry-level developer"
    | "Intermediate professional"
    | "Experienced professional";

// ── Merged Project ────────────────────────────────────────

export type ProjectTag = "Flagship" | "Complex System" | "Production-style" | "Learning Project";

export interface MergedProject {
    name: string;
    description: string;
    techStack: string[];
    domain: string;
    source: "github" | "linkedin" | "both";
    boostScore: number;         // higher = more impressive
    projectTag: ProjectTag;
}

// ── Tech Stack Distribution (Part 2) ──────────────────────

export interface TechStackDistribution {
    backend: number;
    frontend: number;
    ai_ml: number;
    mobile: number;
    devops: number;
    data: number;
    automation: number;
    other: number;
}

// ── Project Complexity Map Entry (Part 4) ─────────────────

export interface ProjectComplexityMapEntry {
    name: string;
    recencyScore: number;       // 0–10
    complexityScore: number;    // 0–10
    maturityScore: number;      // 0–10
    projectTag: ProjectTag;
}

// ── Skill Detailed Entry (Part 5) ─────────────────────────

export type SkillLevel = "core" | "strong" | "working" | "weak";
export type ConfidenceLabel = "Verified" | "Strong Evidence" | "Moderate" | "Learning";

export interface SkillDetailed {
    name: string;
    level: SkillLevel;
    confidenceLabel: ConfidenceLabel;
}

// ── Experience Timeline Entry (Part 6) ────────────────────

export type ExperienceType = "internship" | "job" | "project" | "education";

export interface ExperienceTimelineEntry {
    yearStart: number;
    yearEnd: number | null;
    role: string;
    company: string;
    type: ExperienceType;
}

// ── Career Progression (Part 7) ───────────────────────────

export type TrendLabel =
    | "Rapid growth"
    | "Strong upward trajectory"
    | "Steady progress"
    | "Early stage";

export interface CareerProgression {
    score: number;              // 0–10
    trendLabel: TrendLabel;
}

// ── Skill Classification Result ───────────────────────────

export interface SkillClassificationResult {
    coreSkills: string[];       // score ≥ 12
    strongSkills: string[];     // score 8–11
    workingSkills: string[];    // score 4–7
    weakSkills: string[];       // score < 4
    /** Raw scores for debugging / polishing */
    skillScores: Record<string, number>;
}

// ── Domain Resolution Result ──────────────────────────────

export interface DomainResolutionResult {
    primaryDomain: string;
    secondaryDomains: string[];
    domainDistribution: Record<string, number>;
}

// ── Impact Result ─────────────────────────────────────────

export interface ImpactResult {
    professionalImpactScore: number;    // 0–10
    technicalStrengthScore: number;     // 0–10
    leadershipSignals: string[];
}

// ── Alignment Result ──────────────────────────────────────

export interface AlignmentResult {
    careerAlignmentScore: number;       // 0–1
    alignmentInsight: string;
}

// ── Final Career Intelligence Output ──────────────────────

export interface CareerIntelligence {
    // Domain
    primaryDomain: string;
    secondaryDomains: string[];
    domainDistribution: Record<string, number>;
    careerLevel: CareerLevel;

    // Skills
    coreSkills: string[];
    strongSkills: string[];
    workingSkills: string[];
    weakSkills: string[];

    // Projects
    highlightProjects: MergedProject[];

    // Impact
    leadershipSignals: string[];
    professionalImpactScore: number;
    technicalStrengthScore: number;
    activityScore: number;

    // Intent & Alignment
    careerIntent: string[];
    careerAlignmentScore: number;
    alignmentInsight: string;

    // AI-polished narrative
    aiCareerSummary: string;

    // ── UI Enrichment (Part 1) — Insight text ─────────────
    profileSummary: string;
    skillsInsight: string;
    domainInsight: string;
    projectsIntro: string;
    strengthInsight: string;
    careerIntentExplanation: string;
    alignmentExplanation: string;

    // ── UI Enrichment (Parts 2–7) — Visualization data ────
    techStackDistribution: TechStackDistribution;
    projectComplexityMap: ProjectComplexityMapEntry[];
    skillsDetailed: SkillDetailed[];
    experienceTimeline: ExperienceTimelineEntry[];
    careerProgression: CareerProgression;

    // Metadata
    generatedAt: string;
}
