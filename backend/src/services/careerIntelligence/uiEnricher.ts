// ────────────────────────────────────────────────────────────
// Career Intelligence — UI Data Enrichment Module
// ────────────────────────────────────────────────────────────
//
// Deterministic enrichment functions that add visualization-
// ready data and human-readable insight text to the final
// CareerIntelligence object.
//
// Parts covered:
//   1. Human-readable insight text
//   2. Tech stack distribution
//   4. Project complexity map
//   5. Skill confidence indicators
//   6. Experience timeline
//   7. Career progression score
//
// Part 3 (domain distribution) is already handled by
// domainResolver.ts — no extra work needed here.
// ────────────────────────────────────────────────────────────

import type { GitHubAnalysis, RepoProfile } from "../githubIntelligence/types.js";
import type { LinkedInInsights } from "../linkedinIntelligence/types.js";
import type { LinkedInExperience, LinkedInEducation } from "../../utils/linkedin/types.js";
import type {
    CareerIntelligence,
    CareerLevel,
    MergedProject,
    TechStackDistribution,
    ProjectComplexityMapEntry,
    SkillDetailed,
    SkillLevel,
    ConfidenceLabel,
    ExperienceTimelineEntry,
    ExperienceType,
    CareerProgression,
    TrendLabel,
    SkillClassificationResult,
} from "./types.js";

// ════════════════════════════════════════════════════════════
//  PART 1 — Human-Readable Insight Text
// ════════════════════════════════════════════════════════════

interface InsightTexts {
    profileSummary: string;
    skillsInsight: string;
    domainInsight: string;
    projectsIntro: string;
    strengthInsight: string;
    careerIntentExplanation: string;
    alignmentExplanation: string;
}

export function generateInsightTexts(raw: CareerIntelligence): InsightTexts {
    const {
        primaryDomain,
        careerLevel,
        coreSkills,
        strongSkills,
        highlightProjects,
        technicalStrengthScore,
        professionalImpactScore,
        careerIntent,
        careerAlignmentScore,
    } = raw;

    const topSkills = coreSkills.slice(0, 3).join(", ") || "various technologies";

    // ── profileSummary ────────────────────────────────────
    const profileSummary =
        `${careerLevel} with a focus on ${primaryDomain}, ` +
        `demonstrating expertise in ${topSkills}.`;

    // ── skillsInsight ─────────────────────────────────────
    const totalSkills = coreSkills.length + strongSkills.length;
    const skillsInsight =
        totalSkills >= 6
            ? `Strong technical breadth across ${totalSkills} validated skills, with deep expertise in ${topSkills}.`
            : totalSkills >= 3
                ? `Solid foundation with ${totalSkills} key skills, led by ${topSkills}.`
                : `Building proficiency with core skills including ${topSkills}.`;

    // ── domainInsight ─────────────────────────────────────
    const secondaryNote =
        raw.secondaryDomains.length > 0
            ? ` with supporting experience in ${raw.secondaryDomains.slice(0, 2).join(" and ")}`
            : "";
    const domainInsight =
        `Primary domain focus is ${primaryDomain}${secondaryNote}.`;

    // ── projectsIntro ─────────────────────────────────────
    const flagships = highlightProjects.filter(
        (p) => p.projectTag === "Flagship" || p.projectTag === "Complex System"
    );
    const projectsIntro =
        flagships.length > 0
            ? `${highlightProjects.length} notable projects identified, including ${flagships.length} flagship-level system${flagships.length > 1 ? "s" : ""}.`
            : `${highlightProjects.length} projects showcasing practical development experience.`;

    // ── strengthInsight ───────────────────────────────────
    const strengthInsight =
        technicalStrengthScore >= 7
            ? `Strong technical depth (${technicalStrengthScore}/10) with a professional impact score of ${professionalImpactScore}/10.`
            : technicalStrengthScore >= 4
                ? `Growing technical strength (${technicalStrengthScore}/10) paired with a ${professionalImpactScore}/10 professional impact rating.`
                : `Early-stage technical profile (${technicalStrengthScore}/10) with room for growth in professional impact.`;

    // ── careerIntentExplanation ────────────────────────────
    const careerIntentExplanation =
        careerIntent.length > 0
            ? `Career interests point toward ${careerIntent.slice(0, 3).join(", ")}, indicating a clear professional direction.`
            : `No explicit career intent detected — profile signals suggest a broad exploration phase.`;

    // ── alignmentExplanation ──────────────────────────────
    const alignmentExplanation =
        careerAlignmentScore >= 0.8
            ? `Career alignment is strong (${Math.round(careerAlignmentScore * 100)}%) — projects and skills closely match stated career goals.`
            : careerAlignmentScore >= 0.5
                ? `Moderate career alignment (${Math.round(careerAlignmentScore * 100)}%) — some gap between stated goals and demonstrated work.`
                : `Career alignment needs attention (${Math.round(careerAlignmentScore * 100)}%) — consider building projects closer to your target domain.`;

    return {
        profileSummary,
        skillsInsight,
        domainInsight,
        projectsIntro,
        strengthInsight,
        careerIntentExplanation,
        alignmentExplanation,
    };
}

// ════════════════════════════════════════════════════════════
//  PART 2 — Tech Stack Distribution
// ════════════════════════════════════════════════════════════

const TECH_BUCKET_KEYWORDS: Record<keyof TechStackDistribution, string[]> = {
    backend: [
        "node", "express", "django", "flask", "spring", "fastapi", "nestjs",
        "graphql", "rest", "api", "server", "postgres", "mysql", "mongodb",
        "redis", "sql", "prisma", "sequelize", "mongoose", "java", "go",
        "golang", "rust", "ruby", "rails", "php", "laravel", ".net", "c#",
    ],
    frontend: [
        "react", "vue", "angular", "svelte", "next", "nuxt", "gatsby",
        "html", "css", "sass", "tailwind", "bootstrap", "webpack", "vite",
        "javascript", "typescript", "jquery", "remix", "astro",
    ],
    ai_ml: [
        "tensorflow", "pytorch", "keras", "scikit", "sklearn", "huggingface",
        "transformers", "opencv", "nlp", "llm", "gpt", "bert", "yolo",
        "machine learning", "deep learning", "neural", "ai", "ml",
        "computer vision", "reinforcement learning", "pandas", "numpy",
    ],
    mobile: [
        "react native", "flutter", "swift", "kotlin", "android", "ios",
        "swiftui", "jetpack", "expo", "dart", "objective-c", "xcode",
    ],
    devops: [
        "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
        "jenkins", "ci/cd", "github actions", "ansible", "nginx",
        "linux", "bash", "shell", "cloud", "heroku", "vercel", "netlify",
    ],
    data: [
        "spark", "kafka", "airflow", "etl", "hadoop", "snowflake",
        "bigquery", "tableau", "power bi", "data warehouse", "dbt",
        "data engineering", "data pipeline", "analytics",
    ],
    automation: [
        "selenium", "puppeteer", "playwright", "cypress", "bot",
        "scraping", "scrapy", "cron", "rpa", "automation", "scripting",
    ],
    other: [], // catch-all
};

export function buildTechStackDistribution(
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null
): TechStackDistribution {
    const bucketCounts: Record<keyof TechStackDistribution, number> = {
        backend: 0, frontend: 0, ai_ml: 0, mobile: 0,
        devops: 0, data: 0, automation: 0, other: 0,
    };

    // Collect all tech mentions
    const allTechs: string[] = [];

    if (github) {
        for (const repo of github.repoProfiles) {
            allTechs.push(...repo.techStack);
        }
        allTechs.push(...github.strongestTechnologies);
    }

    if (linkedin) {
        allTechs.push(...linkedin.validatedSkills);
        allTechs.push(...linkedin.claimedSkills);
    }

    // Classify each tech into a bucket
    for (const tech of allTechs) {
        const lower = tech.toLowerCase();
        let matched = false;

        for (const [bucket, keywords] of Object.entries(TECH_BUCKET_KEYWORDS)) {
            if (bucket === "other") continue;
            if (keywords.some((kw) => lower.includes(kw) || kw.includes(lower))) {
                bucketCounts[bucket as keyof TechStackDistribution] += 1;
                matched = true;
                break;
            }
        }

        if (!matched) {
            bucketCounts.other += 1;
        }
    }

    // Normalize to percentages (0–100)
    const total = Object.values(bucketCounts).reduce((s, v) => s + v, 0) || 1;
    const dist: TechStackDistribution = {
        backend: Math.round((bucketCounts.backend / total) * 100),
        frontend: Math.round((bucketCounts.frontend / total) * 100),
        ai_ml: Math.round((bucketCounts.ai_ml / total) * 100),
        mobile: Math.round((bucketCounts.mobile / total) * 100),
        devops: Math.round((bucketCounts.devops / total) * 100),
        data: Math.round((bucketCounts.data / total) * 100),
        automation: Math.round((bucketCounts.automation / total) * 100),
        other: Math.round((bucketCounts.other / total) * 100),
    };

    // Fix rounding to sum to 100
    const sum = Object.values(dist).reduce((s, v) => s + v, 0);
    if (sum !== 100 && sum > 0) {
        const diff = 100 - sum;
        // Add difference to the largest bucket
        const largest = (Object.entries(dist) as [keyof TechStackDistribution, number][])
            .sort((a, b) => b[1] - a[1])[0][0];
        dist[largest] += diff;
    }

    return dist;
}

// ════════════════════════════════════════════════════════════
//  PART 4 — Project Complexity Map
// ════════════════════════════════════════════════════════════

export function buildProjectComplexityMap(
    highlightProjects: MergedProject[],
    github: GitHubAnalysis | null
): ProjectComplexityMapEntry[] {
    const repoLookup = new Map<string, RepoProfile>();
    if (github) {
        for (const r of github.repoProfiles) {
            repoLookup.set(r.name.toLowerCase().replace(/[-_\s.]/g, ""), r);
        }
    }

    const now = Date.now();

    return highlightProjects.map((project) => {
        const normName = project.name.toLowerCase().replace(/[-_\s.]/g, "");
        const matchedRepo = repoLookup.get(normName);

        // Recency: how recently was this project updated (0–10)
        let recencyScore = 5; // default if no date info
        if (matchedRepo?.lastUpdated) {
            const updatedAt = new Date(matchedRepo.lastUpdated).getTime();
            const monthsAgo = (now - updatedAt) / (1000 * 60 * 60 * 24 * 30);
            if (monthsAgo <= 1) recencyScore = 10;
            else if (monthsAgo <= 3) recencyScore = 9;
            else if (monthsAgo <= 6) recencyScore = 8;
            else if (monthsAgo <= 12) recencyScore = 7;
            else if (monthsAgo <= 18) recencyScore = 5;
            else if (monthsAgo <= 24) recencyScore = 3;
            else recencyScore = 1;
        }

        const complexityScore = matchedRepo?.complexityScore ?? Math.min(10, project.boostScore);
        const maturityScore = matchedRepo?.maturityScore ?? Math.floor(complexityScore * 0.7);

        return {
            name: project.name,
            recencyScore,
            complexityScore,
            maturityScore,
            projectTag: project.projectTag,
        };
    });
}

// ════════════════════════════════════════════════════════════
//  PART 5 — Skill Confidence Indicators
// ════════════════════════════════════════════════════════════

export function buildSkillsDetailed(
    skills: SkillClassificationResult,
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null
): SkillDetailed[] {
    // Build source presence sets
    const githubSkills = new Set<string>();
    const linkedinSkills = new Set<string>();

    if (github) {
        for (const repo of github.repoProfiles) {
            for (const tech of repo.techStack) {
                githubSkills.add(tech.toLowerCase());
            }
        }
        for (const tech of github.strongestTechnologies) {
            githubSkills.add(tech.toLowerCase());
        }
    }

    if (linkedin) {
        for (const s of linkedin.claimedSkills) linkedinSkills.add(s.toLowerCase());
        for (const s of linkedin.validatedSkills) linkedinSkills.add(s.toLowerCase());
        for (const p of linkedin.curatedProjects) {
            for (const s of p.validatedProjectSkills) linkedinSkills.add(s.toLowerCase());
            for (const s of p.techMentions) linkedinSkills.add(s.toLowerCase());
        }
    }

    function getConfidenceLabel(skillName: string, level: SkillLevel): ConfidenceLabel {
        const lower = skillName.toLowerCase();
        const inGH = githubSkills.has(lower);
        const inLI = linkedinSkills.has(lower);

        if (inGH && inLI) return "Verified";
        if (inGH && (level === "core" || level === "strong")) return "Strong Evidence";
        if (inGH || inLI) return "Moderate";
        return "Learning";
    }

    const result: SkillDetailed[] = [];

    const addSkills = (names: string[], level: SkillLevel) => {
        for (const name of names) {
            result.push({
                name,
                level,
                confidenceLabel: getConfidenceLabel(name, level),
            });
        }
    };

    addSkills(skills.coreSkills, "core");
    addSkills(skills.strongSkills, "strong");
    addSkills(skills.workingSkills, "working");
    addSkills(skills.weakSkills, "weak");

    return result;
}

// ════════════════════════════════════════════════════════════
//  PART 6 — Experience Timeline
// ════════════════════════════════════════════════════════════

const INTERNSHIP_PATTERNS = /intern|trainee|apprentice|co-op/i;
const EDUCATION_PATTERNS = /student|research assistant|teaching assistant|TA\b|fellow/i;

function parseYear(dateStr?: string): number | null {
    if (!dateStr) return null;
    // Try ISO date, "YYYY-MM", "YYYY", or "Month YYYY" formats
    const match = dateStr.match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : null;
}

function classifyExperienceType(title: string): ExperienceType {
    if (INTERNSHIP_PATTERNS.test(title)) return "internship";
    if (EDUCATION_PATTERNS.test(title)) return "education";
    return "job";
}

export function buildExperienceTimeline(
    experiences: LinkedInExperience[],
    education: LinkedInEducation[]
): ExperienceTimelineEntry[] {
    const entries: ExperienceTimelineEntry[] = [];

    // From experiences
    for (const exp of experiences) {
        const yearStart = parseYear(exp.startDate);
        if (!yearStart) continue; // skip entries with no parseable start date

        entries.push({
            yearStart,
            yearEnd: parseYear(exp.endDate),
            role: exp.title,
            company: exp.companyName,
            type: classifyExperienceType(exp.title),
        });
    }

    // From education
    for (const edu of education) {
        const yearStart = parseYear(edu.startDate);
        if (!yearStart) continue;

        entries.push({
            yearStart,
            yearEnd: parseYear(edu.endDate),
            role: edu.degree
                ? `${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}`
                : edu.fieldOfStudy || "Student",
            company: edu.schoolName,
            type: "education",
        });
    }

    // Sort newest → oldest
    entries.sort((a, b) => {
        const aEnd = a.yearEnd ?? 9999;
        const bEnd = b.yearEnd ?? 9999;
        if (bEnd !== aEnd) return bEnd - aEnd;
        return b.yearStart - a.yearStart;
    });

    return entries;
}

// ════════════════════════════════════════════════════════════
//  PART 7 — Career Progression Score
// ════════════════════════════════════════════════════════════

export function computeCareerProgression(
    linkedin: LinkedInInsights | null,
    github: GitHubAnalysis | null,
    highlightProjects: MergedProject[]
): CareerProgression {
    let score = 0;
    let factors = 0;

    // LinkedIn role progression (0–10)
    if (linkedin) {
        score += linkedin.roleProgressionScore;
        factors += 1;

        // Bonus for high role progression (signals intern→fulltime or similar)
        if (linkedin.roleProgressionScore >= 7) {
            score += 1;
        }
    }

    // GitHub activity score (0–10)
    if (github) {
        score += github.activityScore;
        factors += 1;
    }

    // Project complexity trend: average boost score of top projects
    if (highlightProjects.length > 0) {
        const avgBoost =
            highlightProjects.reduce((s, p) => s + p.boostScore, 0) /
            highlightProjects.length;
        score += Math.min(10, avgBoost);
        factors += 1;
    }

    // Normalize
    const normalized = factors > 0
        ? Math.round(Math.min(10, score / factors) * 10) / 10
        : 0;

    // Determine trend label
    let trendLabel: TrendLabel;
    if (normalized >= 8) {
        trendLabel = "Rapid growth";
    } else if (normalized >= 6) {
        trendLabel = "Strong upward trajectory";
    } else if (normalized >= 3.5) {
        trendLabel = "Steady progress";
    } else {
        trendLabel = "Early stage";
    }

    return { score: normalized, trendLabel };
}

// ════════════════════════════════════════════════════════════
//  MASTER ENRICHMENT ENTRY POINT
// ════════════════════════════════════════════════════════════

export interface UIEnrichmentResult {
    // Part 1
    profileSummary: string;
    skillsInsight: string;
    domainInsight: string;
    projectsIntro: string;
    strengthInsight: string;
    careerIntentExplanation: string;
    alignmentExplanation: string;
    // Parts 2–7
    techStackDistribution: TechStackDistribution;
    projectComplexityMap: ProjectComplexityMapEntry[];
    skillsDetailed: SkillDetailed[];
    experienceTimeline: ExperienceTimelineEntry[];
    careerProgression: CareerProgression;
}

/**
 * Run all UI enrichment computations and return the fields
 * to be spread into the CareerIntelligence object.
 */
export function enrichForUI(
    rawIntelligence: CareerIntelligence,
    skills: SkillClassificationResult,
    github: GitHubAnalysis | null,
    linkedin: LinkedInInsights | null,
    rawExperiences: LinkedInExperience[],
    rawEducation: LinkedInEducation[]
): UIEnrichmentResult {
    // Part 1 — Insight texts
    const insights = generateInsightTexts(rawIntelligence);

    // Part 2 — Tech stack distribution
    const techStackDistribution = buildTechStackDistribution(github, linkedin);

    // Part 4 — Project complexity map
    const projectComplexityMap = buildProjectComplexityMap(
        rawIntelligence.highlightProjects,
        github
    );

    // Part 5 — Skill confidence indicators
    const skillsDetailed = buildSkillsDetailed(skills, github, linkedin);

    // Part 6 — Experience timeline
    const experienceTimeline = buildExperienceTimeline(rawExperiences, rawEducation);

    // Part 7 — Career progression
    const careerProgression = computeCareerProgression(
        linkedin,
        github,
        rawIntelligence.highlightProjects
    );

    return {
        ...insights,
        techStackDistribution,
        projectComplexityMap,
        skillsDetailed,
        experienceTimeline,
        careerProgression,
    };
}
