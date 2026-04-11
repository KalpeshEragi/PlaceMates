/**
 * types/index.ts
 * Shared types across the entire offline intelligence pipeline.
 */

export type ProjectType = "solo" | "collaborative";

export type Domain =
  | "Frontend"
  | "Backend"
  | "Full Stack"
  | "ML / AI"
  | "DevOps"
  | "Mobile"
  | "Other";

export type CommitType =
  | "feat"
  | "fix"
  | "refactor"
  | "perf"
  | "test"
  | "docs"
  | "chore"
  | "build"
  | "ci"
  | "style"
  | "other";

/** Diversity slot for final bullet selection */
export type BulletSlot = "feature" | "architecture" | "impact" | "contribution" | "flexible";

export type FeatureSource = "readme" | "files" | "commits";

export type FeatureConfidence = {
  name: string;
  confidence: number;
  sources: FeatureSource[];
};

// ─────────────────────────────────────────────
// Template Engine
// ─────────────────────────────────────────────

export type TemplateEngineInput = {
  projectName: string;
  projectType: ProjectType;
  techStack: string[];
  modules: string[];
  domain: string | null;
  readmeSummary: string | null;
  commitMessages: string[];
  contributionFiles: string[];
  collaborators: number;
  detectedFeatures?: string[];
  featureConfidence?: FeatureConfidence[];
  commitTypes?: Partial<Record<CommitType, number>>;
};

// ─────────────────────────────────────────────
// Analysis outputs
// ─────────────────────────────────────────────

export type ReadmeAnalysis = {
  /** First meaningful paragraph, stripped of markdown */
  summary: string | null;
  /** Primary domain inferred from README text */
  domain: Domain | null;
  /** Raw keywords extracted by frequency */
  keywords: string[];
  /** Technologies explicitly mentioned in README */
  mentionedTech: string[];
  /** High-level features extracted from keyword mapping + headings */
  extractedFeatures: string[];
};

export type CommitAnalysis = {
  /** Conventional-commit types and their counts */
  commitTypes: Partial<Record<CommitType, number>>;
  /** Human-readable feature strings extracted from commit messages */
  detectedFeatures: string[];
  /** Clean first-line subjects */
  subjects: string[];
  /** Top 3 high-signal verb-phrases from commits for bullet use */
  contributionNarrative: string[];
};

export type FileAnalysis = {
  /** High-level module names (Auth, API, UI, …) */
  modules: string[];
  /** Feature names detected from file paths */
  detectedFeatures: string[];
  /** Inferred architecture style from directory structure */
  architectureStyle: string;
};

export type RepoAnalysis = {
  projectType: ProjectType;
  collaboratorCount: number;
  techStack: string[];
  modules: string[];
  domain: Domain | null;
  readmeSummary: string | null;
  commitMessages: string[];
  contributionFiles: string[];
  detectedFeatures: string[];
  featureConfidence: FeatureConfidence[];
  commitTypes: Partial<Record<CommitType, number>>;
  contributionNarrative: string[];
  readmeFeatures: string[];
  readmeMentionedTech: string[];
  architectureStyle: string;
  rankingScore: number;
  readmeExcerptRaw: string | null;
};

// ─────────────────────────────────────────────
// Project Intelligence Layer
// ─────────────────────────────────────────────

export type ProjectInsight = {
  name: string;
  projectType: ProjectType;
  domain: Domain | null;
  /** simple (1–2 modules), moderate (3–4), complex (5+) */
  complexity: "simple" | "moderate" | "complex";
  techStack: string[];
  primaryTech: string;
  /** Deduplicated, ranked features from all sources */
  features: string[];
  /** Architectural modules detected */
  modules: string[];
  /** What the user specifically worked on */
  contributionAreas: string[];
  commitActivity: {
    total: number;
    featureCommits: number;
    fixCommits: number;
    refactorCommits: number;
  };
  readmeInsight: {
    summary: string | null;
    mentionedTech: string[];
    keywords: string[];
  };
  /** Top 3 narrative phrases from commits */
  contributionNarrative: string[];
  collaboratorCount: number;
  architectureStyle: string;
};

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────

export type UserSummaryInput = {
  topProjects: {
    name: string;
    domain: string | null;
    techStack: string[];
    bullets: string[];
  }[];
  topSkills: string[];
  topDomains: string[];
  primaryDomain: string | null;
};

// ─────────────────────────────────────────────
// Metric injection (quiz step)
// ─────────────────────────────────────────────

export type QuizAnswers = {
  improvements: string;   // e.g. "reduced load time by 40%"
  reductions: string;     // e.g. "cut latency from 800ms to 200ms"
  usageScale: string;     // e.g. "500 active users"
  additionalContext?: string;
};