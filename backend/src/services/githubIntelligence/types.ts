// ────────────────────────────────────────────────────────────
// GitHub Intelligence Processor — Type Definitions
// ────────────────────────────────────────────────────────────

// ── Domain Classification ─────────────────────────────────

export type DomainClassification =
    | "web"
    | "ai"
    | "backend"
    | "mobile"
    | "tooling"
    | "data"
    | "cybersecurity"
    | "devops"
    | "iot"
    | "embedded"
    | "data-engineering"
    | "game-dev"
    | "blockchain"
    | "desktop"
    | "automation"
    | "competitive-programming"
    | "networking"
    | "unknown";

// ── Originality Hint ──────────────────────────────────────

export type OriginalityHint = "clone" | "tutorial" | "original" | "unclear";

// ── Raw GitHub Repo (from API / importedData) ─────────────

export interface RawGitHubRepo {
    name: string;
    description: string | null;
    html_url: string;
    language: string | null;
    languages_url?: string;
    stargazers_count: number;
    forks_count: number;
    watchers_count: number;
    open_issues_count: number;
    updated_at: string;
    created_at: string;
    pushed_at?: string;
    fork: boolean;
    topics?: string[];
    size: number;
    default_branch?: string;
    has_wiki?: boolean;
    has_pages?: boolean;
    homepage?: string | null;
    // README text — fetched separately and attached
    readmeText?: string;
    // Extra metadata fetched per-repo if available
    contributors_count?: number;
    commit_count?: number;
    branches_count?: number;
}

// ── README Analysis (local parse result) ──────────────────

export interface ReadmeAnalysis {
    projectTypes: string[];
    features: string[];
    complexitySignals: string[];
    techMentions: string[];
    sectionHeadings: string[];
    hasInstallSection: boolean;
    hasApiSection: boolean;
    hasDemoSection: boolean;
    wordCount: number;
    codeBlockCount: number;
    /** SHA-256 hash of raw README text for cache invalidation */
    contentHash: string;
}

// ── README Compression ────────────────────────────────────

export interface ReadmeCompression {
    projectPurpose: string;
    mainTechnologies: string;
    complexityIndication: string;
}

// ── Per-Repo Profile ──────────────────────────────────────

export interface RepoProfile {
    name: string;
    description: string | null;
    techStack: string[];
    domain: DomainClassification;
    domainConfidence: number;    // 0–1
    features: string[];
    complexityScore: number;   // 0–10
    maturityScore: number;     // 0–10
    effortScore: number;       // 0–10
    originalityHint: OriginalityHint;
    stars: number;
    forks: number;
    lastUpdated: string;
    repoUrl: string;
    readmeSummaryShort: ReadmeCompression | null;
    /** Hash of readme content used for cache invalidation */
    readmeContentHash: string | null;
}

// ── Project Highlight (from LLM synthesis) ────────────────

export interface ProjectHighlight {
    name: string;
    reason: string;
    domain: DomainClassification;
    techStack: string[];
}

// ── Final GitHub Analysis Output ──────────────────────────

export interface GitHubAnalysis {
    repoProfiles: RepoProfile[];
    strongestDomain: string;
    strongestTechnologies: string[];
    projectHighlights: ProjectHighlight[];
    technicalDepthScore: number;   // 0–10
    activityScore: number;         // 0–10
    aiSummary: string;
    generatedAt: string;           // ISO timestamp
}
