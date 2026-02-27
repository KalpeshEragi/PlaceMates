// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence — Skill Semantic Analyzer
// ────────────────────────────────────────────────────────────
//
// Separates skills into three categories:
//   - claimedSkills  = from LinkedIn skills section
//   - validatedSkills = confirmed by experience/project text
//   - hiddenSkills    = validated but not explicitly claimed
//
// Final confidence scoring is deferred to Stage 3 merge.
// ────────────────────────────────────────────────────────────

import type { LinkedInExperience, LinkedInProject } from "../../utils/linkedin/types.js";
import type { SkillsInsight } from "./types.js";

// ── Known Tech Skills Vocabulary ──────────────────────────
// Broad vocabulary for detecting tech skills in free text

const KNOWN_SKILLS: string[] = [
    // Languages
    "javascript", "typescript", "python", "java", "c++", "c#", "go",
    "rust", "ruby", "php", "swift", "kotlin", "scala", "dart",
    "r", "matlab", "perl", "lua", "elixir", "haskell", "clojure",
    // Frontend
    "react", "angular", "vue", "svelte", "next.js", "nuxt", "gatsby",
    "html", "css", "sass", "less", "tailwind", "bootstrap", "material ui",
    "redux", "mobx", "zustand", "jquery", "webpack", "vite", "rollup",
    // Backend
    "node.js", "express", "fastify", "django", "flask", "spring",
    "spring boot", "rails", "laravel", "asp.net", "gin", "fiber",
    "nestjs", "koa", "fastapi", "actix", "rocket",
    // Databases
    "mongodb", "postgresql", "mysql", "redis", "elasticsearch",
    "dynamodb", "cassandra", "sqlite", "firebase", "firestore",
    "supabase", "neo4j", "couchdb", "mariadb",
    // ORMs
    "prisma", "sequelize", "mongoose", "typeorm", "drizzle",
    "hibernate", "sqlalchemy", "entity framework",
    // Cloud
    "aws", "gcp", "azure", "heroku", "vercel", "netlify",
    "digitalocean", "cloudflare",
    // DevOps
    "docker", "kubernetes", "terraform", "ansible", "jenkins",
    "github actions", "circleci", "gitlab ci", "travis ci",
    "nginx", "apache", "caddy",
    // AI/ML
    "tensorflow", "pytorch", "scikit-learn", "keras", "opencv",
    "hugging face", "transformers", "pandas", "numpy", "scipy",
    "machine learning", "deep learning", "nlp", "computer vision",
    // Mobile
    "react native", "flutter", "expo", "android", "ios",
    "swiftui", "jetpack compose",
    // Messaging
    "kafka", "rabbitmq", "redis", "nats",
    // APIs
    "graphql", "rest", "grpc", "websocket", "soap",
    // Testing
    "jest", "mocha", "cypress", "playwright", "selenium",
    "pytest", "junit", "vitest",
    // Other
    "git", "linux", "bash", "powershell", "figma", "jira",
    "agile", "scrum", "ci/cd", "microservices", "serverless",
    "blockchain", "solidity", "web3",
];

// ── Normalize ─────────────────────────────────────────────

function normalize(skill: string): string {
    return skill.toLowerCase().trim();
}

// ── Extract Skills From Free Text ─────────────────────────

function extractSkillsFromText(text: string): string[] {
    const lower = text.toLowerCase();
    const found: string[] = [];

    for (const skill of KNOWN_SKILLS) {
        // Use word boundary-ish matching to avoid false positives
        // (e.g., "react" shouldn't match "reactive")
        const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        if (regex.test(lower)) {
            found.push(skill);
        }
    }

    return [...new Set(found)];
}

// ── Main Analyzer ─────────────────────────────────────────

/**
 * Analyze skills across LinkedIn profile data.
 *
 * @param claimedSkillNames - Skill names from LinkedIn skills section
 * @param experiences       - LinkedIn experience entries
 * @param projects          - LinkedIn project entries
 */
export function analyzeSkills(
    claimedSkillNames: string[],
    experiences: LinkedInExperience[],
    projects: LinkedInProject[]
): SkillsInsight {
    // ── Claimed skills (normalized) ──────────────────────
    const claimedSkills = claimedSkillNames
        .map(normalize)
        .filter(Boolean);

    const claimedSet = new Set(claimedSkills);

    // ── Validated skills from experiences ─────────────────
    const experienceTexts = experiences
        .map((e) => [e.title, e.description].filter(Boolean).join(" "))
        .filter(Boolean);

    const fromExperiences = experienceTexts.flatMap(extractSkillsFromText);

    // ── Validated skills from projects ────────────────────
    const projectTexts = projects
        .map((p) => [p.title, p.description].filter(Boolean).join(" "))
        .filter(Boolean);

    const fromProjects = projectTexts.flatMap(extractSkillsFromText);

    // ── Combine validated skills ─────────────────────────
    const validatedSkills = [...new Set([...fromExperiences, ...fromProjects])];

    // ── Hidden skills = validated but NOT claimed ─────────
    const hiddenSkills = validatedSkills.filter(
        (skill) => !claimedSet.has(normalize(skill))
    );

    return {
        claimedSkills,
        validatedSkills,
        hiddenSkills,
    };
}
