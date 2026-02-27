// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence — Project Analyzer
// ────────────────────────────────────────────────────────────
//
// Treats LinkedIn projects as curated highlights.
// Extracts tech mentions, domain hints, and validated skills.
// All projects get curationWeight = "high" since users
// explicitly chose to showcase them.
// ────────────────────────────────────────────────────────────

import type { LinkedInProject } from "../../utils/linkedin/types.js";
import type { CuratedProject } from "./types.js";

// ── Tech Keywords (subset for project scanning) ──────────

const TECH_KEYWORDS: string[] = [
    "javascript", "typescript", "python", "java", "c++", "c#",
    "go", "rust", "ruby", "php", "swift", "kotlin",
    "react", "angular", "vue", "svelte", "next.js", "nuxt",
    "node.js", "express", "django", "flask", "spring", "rails",
    "laravel", "fastapi", "nestjs",
    "mongodb", "postgresql", "mysql", "redis", "elasticsearch",
    "firebase", "supabase", "dynamodb", "sqlite",
    "prisma", "sequelize", "mongoose", "typeorm",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
    "tensorflow", "pytorch", "scikit-learn", "keras", "opencv",
    "machine learning", "deep learning", "nlp", "computer vision",
    "react native", "flutter", "android", "ios",
    "kafka", "rabbitmq", "graphql", "rest api", "grpc", "websocket",
    "html", "css", "tailwind", "bootstrap", "sass",
    "git", "ci/cd", "github actions", "jenkins",
    "blockchain", "solidity", "web3", "ethereum",
    "unity", "unreal", "game engine",
];

// ── Domain Hints ──────────────────────────────────────────

const DOMAIN_HINTS: Record<string, string[]> = {
    web: ["website", "web app", "webapp", "frontend", "landing page", "dashboard", "spa"],
    mobile: ["mobile app", "android app", "ios app", "cross-platform", "react native", "flutter"],
    ai: ["machine learning", "deep learning", "nlp", "computer vision", "ai", "neural", "prediction", "classification", "model"],
    backend: ["api", "server", "backend", "microservice", "database", "rest", "graphql"],
    devops: ["docker", "kubernetes", "ci/cd", "deployment", "pipeline", "infrastructure"],
    data: ["data analysis", "data pipeline", "etl", "analytics", "visualization", "dashboard"],
    blockchain: ["blockchain", "smart contract", "defi", "dapp", "web3", "nft"],
    security: ["security", "vulnerability", "penetration", "encryption", "auth"],
    iot: ["iot", "sensor", "embedded", "hardware", "arduino", "raspberry"],
    gamedev: ["game", "unity", "unreal", "2d", "3d", "simulation"],
};

// ── Helpers ───────────────────────────────────────────────

function extractTech(text: string): string[] {
    const lower = text.toLowerCase();
    const found: string[] = [];

    for (const tech of TECH_KEYWORDS) {
        const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        if (regex.test(lower)) {
            found.push(tech);
        }
    }

    return [...new Set(found)];
}

function detectDomainHints(text: string): string[] {
    const lower = text.toLowerCase();
    const domains: string[] = [];

    for (const [domain, keywords] of Object.entries(DOMAIN_HINTS)) {
        for (const kw of keywords) {
            if (lower.includes(kw)) {
                domains.push(domain);
                break;
            }
        }
    }

    return [...new Set(domains)];
}

// ── Main Analyzer ─────────────────────────────────────────

/**
 * Analyze a single LinkedIn project as a curated highlight.
 */
export function analyzeProject(project: LinkedInProject): CuratedProject {
    const text = [project.title, project.description]
        .filter(Boolean)
        .join(" ");

    const techMentions = extractTech(text);
    const domainHints = detectDomainHints(text);

    return {
        title: project.title || "",
        techMentions,
        domainHints,
        curationWeight: "high", // LinkedIn projects = curated by user
        validatedProjectSkills: [...techMentions], // tech from projects = validated
    };
}

/**
 * Analyze all LinkedIn projects.
 */
export function analyzeAllProjects(
    projects: LinkedInProject[]
): CuratedProject[] {
    return projects.map(analyzeProject);
}
