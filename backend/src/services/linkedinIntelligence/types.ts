// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence Processor — Type Definitions
// ────────────────────────────────────────────────────────────

// ── Career Stage ──────────────────────────────────────────

export type CareerStage = "student" | "entry" | "early-career" | "experienced";

// ── Curation Weight ───────────────────────────────────────

export type CurationWeight = "high" | "medium" | "low";

// ── Experience Insight (per experience entry) ─────────────

export interface ExperienceInsight {
    roleTitle: string;
    company: string;
    durationMonths: number | null;
    impactScore: number;          // 0–10
    leadershipScore: number;      // 0–10
    validatedSkills: string[];
    techMentions: string[];
    ownershipIndicators: string[];
    productionSignals: string[];
    leadershipSignals: string[];
    scaleIndicators: string[];
    strongVerbCount: number;
    weakVerbCount: number;
}

// ── Role Progression ──────────────────────────────────────

export interface RoleProgression {
    roleProgressionScore: number;   // 0–10
    careerStage: CareerStage;
    hasInternToFulltime: boolean;
    seniorityGrowthDetected: boolean;
    totalExperienceMonths: number;
    titleProgression: string[];     // chronological titles
}

// ── Skills Insight ────────────────────────────────────────

export interface SkillsInsight {
    claimedSkills: string[];       // from LinkedIn skills section
    validatedSkills: string[];     // from experiences/projects text
    hiddenSkills: string[];        // validated but not claimed
}

// ── Career Intent ─────────────────────────────────────────

export interface CareerIntent {
    careerIntentKeywords: string[];
    targetDomains: string[];
    motivationSignals: string[];
    specializationDirection: string[];
}

// ── Curated Project ───────────────────────────────────────

export interface CuratedProject {
    title: string;
    techMentions: string[];
    domainHints: string[];
    curationWeight: CurationWeight;
    validatedProjectSkills: string[];
}

// ── Education Context ─────────────────────────────────────

export interface EducationContext {
    isStudent: boolean;
    fieldRelevanceToTech: "high" | "medium" | "low" | "unknown";
    graduationRecency: "recent" | "mid" | "distant" | "unknown";
    fields: string[];
    institutions: string[];
}

// ── Learning Direction ────────────────────────────────────

export interface LearningDirection {
    learningDirection: string[];
    specializationSignals: string[];
}

// ── Final LinkedIn Insights Output ────────────────────────

export interface LinkedInInsights {
    careerStage: CareerStage;
    roleProgressionScore: number;
    impactScoreOverall: number;
    leadershipSignals: string[];
    claimedSkills: string[];
    validatedSkills: string[];
    hiddenSkills: string[];
    curatedProjects: CuratedProject[];
    careerIntentKeywords: string[];
    specializationDirection: string[];
    learningDirection: string[];
    experienceInsights: ExperienceInsight[];
    educationContext: EducationContext;
    generatedAt: string;           // ISO timestamp
}
