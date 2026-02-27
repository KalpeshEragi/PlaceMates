// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence — Experience Semantic Analyzer
// ────────────────────────────────────────────────────────────
//
// Deterministic rule-based analysis of each LinkedIn experience.
// Detects impact verbs, ownership, production signals, leadership,
// scale indicators, and tech stack mentions.
// ────────────────────────────────────────────────────────────

import type { LinkedInExperience } from "../../utils/linkedin/types.js";
import type { ExperienceInsight } from "./types.js";

// ── Impact Verb Lists ─────────────────────────────────────

const STRONG_IMPACT_VERBS = [
    "designed", "architected", "implemented", "led", "optimized",
    "scaled", "deployed", "built", "owned", "developed", "engineered",
    "created", "launched", "automated", "refactored", "integrated",
    "established", "pioneered", "spearheaded", "drove", "delivered",
    "orchestrated", "transformed", "migrated", "redesigned", "streamlined",
];

const WEAK_VERBS = [
    "assisted", "learned", "supported", "observed", "participated",
    "helped", "shadowed", "attended", "contributed", "exposed",
    "familiar", "studied", "explored", "watched",
];

// ── Tech Stack Detection Keywords ─────────────────────────

const TECH_KEYWORDS = [
    // Languages
    "javascript", "typescript", "python", "java", "c\\+\\+", "c#", "go",
    "golang", "rust", "ruby", "php", "swift", "kotlin", "scala", "dart",
    "r\\b", "matlab",
    // Frontend
    "react", "angular", "vue", "svelte", "next\\.js", "nextjs", "nuxt",
    "html", "css", "sass", "tailwind", "bootstrap", "redux", "jquery",
    // Backend
    "node\\.js", "nodejs", "express", "fastify", "django", "flask",
    "spring", "spring boot", "rails", "laravel", "asp\\.net", "gin",
    "fiber", "nestjs", "koa",
    // Databases
    "mongodb", "postgresql", "postgres", "mysql", "redis", "elasticsearch",
    "dynamodb", "cassandra", "sqlite", "firebase", "firestore", "supabase",
    "neo4j", "prisma", "sequelize", "mongoose",
    // Cloud & DevOps
    "aws", "gcp", "azure", "docker", "kubernetes", "k8s", "terraform",
    "jenkins", "ci/cd", "github actions", "circleci", "ansible",
    "cloudformation", "serverless", "lambda", "ec2", "s3",
    // AI/ML
    "tensorflow", "pytorch", "scikit-learn", "keras", "hugging face",
    "openai", "gpt", "llm", "machine learning", "deep learning",
    "nlp", "computer vision", "neural network",
    // Mobile
    "react native", "flutter", "swift", "swiftui", "android",
    "ios", "xcode", "jetpack compose",
    // Messaging & Infra
    "kafka", "rabbitmq", "graphql", "rest api", "grpc", "websocket",
    "nginx", "apache", "microservices", "monolith",
];

// ── Ownership Indicators ──────────────────────────────────

const OWNERSHIP_PATTERNS = [
    "owned", "end[- ]to[- ]end", "full[- ]stack", "sole developer",
    "single-handedly", "from scratch", "ground up", "took ownership",
    "independently", "personally responsible", "my responsibility",
    "i built", "i designed", "i led", "i created",
];

// ── Production / Deployment Signals ───────────────────────

const PRODUCTION_PATTERNS = [
    "production", "deployed", "went live", "released",
    "shipped", "launched", "live environment", "staging",
    "continuous deployment", "rollout", "release management",
    "production[- ]ready", "in production", "customer[- ]facing",
];

// ── Leadership / Mentoring Signals ────────────────────────

const LEADERSHIP_PATTERNS = [
    "led team", "led a team", "managed team", "managed a team",
    "mentored", "coached", "supervised", "team lead",
    "tech lead", "engineering lead", "project lead",
    "coordinated", "onboarded", "trained", "guided",
    "cross[- ]functional", "stakeholder", "presented to",
    "reporting to", "direct reports",
];

// ── Scale Indicators ──────────────────────────────────────

const SCALE_PATTERNS = [
    "\\d+k\\+? users", "\\d+m\\+? users", "million users",
    "high availability", "99\\.\\d+%", "uptime",
    "scalab", "distributed system", "high traffic",
    "load balanc", "horizontal scal", "vertical scal",
    "\\d+ requests", "rps", "qps", "tps",
    "large[- ]scale", "enterprise", "billions?",
    "terabytes?", "petabytes?", "concurrent",
];

// ── Duration Parser ───────────────────────────────────────

function computeDurationMonths(
    startDate?: string,
    endDate?: string
): number | null {
    if (!startDate) return null;

    const parseDate = (d: string): Date | null => {
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const start = parseDate(startDate);
    if (!start) return null;

    const end = endDate ? parseDate(endDate) : new Date();
    if (!end) return null;

    const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());

    return Math.max(0, months);
}

// ── Text Pattern Matching Helpers ─────────────────────────

function countMatches(text: string, patterns: string[]): number {
    const lower = text.toLowerCase();
    let count = 0;
    for (const pattern of patterns) {
        const regex = new RegExp(pattern, "gi");
        const matches = lower.match(regex);
        if (matches) count += matches.length;
    }
    return count;
}

function extractMatches(text: string, patterns: string[]): string[] {
    const lower = text.toLowerCase();
    const found: string[] = [];
    for (const pattern of patterns) {
        const regex = new RegExp(pattern, "gi");
        const matches = lower.match(regex);
        if (matches) {
            found.push(...matches.map((m) => m.trim()));
        }
    }
    return [...new Set(found)];
}

// ── Main Analyzer ─────────────────────────────────────────

/**
 * Analyze a single LinkedIn experience entry for career signals.
 */
export function analyzeExperience(exp: LinkedInExperience): ExperienceInsight {
    const text = [exp.title, exp.description].filter(Boolean).join(" ");
    const lower = text.toLowerCase();

    // ── Verb analysis ────────────────────────────────────
    const strongVerbCount = countMatches(lower, STRONG_IMPACT_VERBS);
    const weakVerbCount = countMatches(lower, WEAK_VERBS);

    // ── Signal detection ─────────────────────────────────
    const techMentions = extractMatches(text, TECH_KEYWORDS);
    const ownershipIndicators = extractMatches(lower, OWNERSHIP_PATTERNS);
    const productionSignals = extractMatches(lower, PRODUCTION_PATTERNS);
    const leadershipSignals = extractMatches(lower, LEADERSHIP_PATTERNS);
    const scaleIndicators = extractMatches(lower, SCALE_PATTERNS);

    // ── Validated skills = tech mentions from actual work ──
    const validatedSkills = [...new Set([...techMentions])];

    // ── Duration ─────────────────────────────────────────
    const durationMonths = computeDurationMonths(exp.startDate, exp.endDate);

    // ── Impact Score (0–10) ──────────────────────────────
    let impactScore = 0;

    // Strong verbs boost impact
    impactScore += Math.min(strongVerbCount * 1.5, 4);

    // Weak verbs reduce impact
    impactScore -= Math.min(weakVerbCount * 0.5, 2);

    // Ownership signals
    impactScore += Math.min(ownershipIndicators.length * 1.5, 2);

    // Production signals
    impactScore += Math.min(productionSignals.length * 1.0, 1.5);

    // Scale signals
    impactScore += Math.min(scaleIndicators.length * 1.0, 1.5);

    // Duration bonus (longer = more likely meaningful)
    if (durationMonths !== null) {
        if (durationMonths >= 12) impactScore += 1;
        else if (durationMonths >= 6) impactScore += 0.5;
    }

    impactScore = Math.round(Math.max(0, Math.min(10, impactScore)) * 10) / 10;

    // ── Leadership Score (0–10) ──────────────────────────
    let leadershipScore = 0;

    leadershipScore += Math.min(leadershipSignals.length * 2.5, 6);

    // Title-based leadership hints
    const titleLower = (exp.title || "").toLowerCase();
    if (/\b(lead|head|manager|director|vp|principal|staff)\b/.test(titleLower)) {
        leadershipScore += 3;
    } else if (/\b(senior|sr\.?)\b/.test(titleLower)) {
        leadershipScore += 1.5;
    }

    leadershipScore = Math.round(Math.max(0, Math.min(10, leadershipScore)) * 10) / 10;

    return {
        roleTitle: exp.title || "",
        company: exp.companyName || "",
        durationMonths,
        impactScore,
        leadershipScore,
        validatedSkills,
        techMentions,
        ownershipIndicators,
        productionSignals,
        leadershipSignals,
        scaleIndicators,
        strongVerbCount,
        weakVerbCount,
    };
}

// ── Batch Analyzer ────────────────────────────────────────

/**
 * Analyze all LinkedIn experiences.
 */
export function analyzeAllExperiences(
    experiences: LinkedInExperience[]
): ExperienceInsight[] {
    return experiences.map(analyzeExperience);
}
