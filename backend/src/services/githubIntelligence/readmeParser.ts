// ────────────────────────────────────────────────────────────
// GitHub Intelligence — README Parser (Local Analysis)
// ────────────────────────────────────────────────────────────
//
// Parses raw README text using keyword dictionaries to
// extract structured signals. No LLM calls.
// ────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import type { ReadmeAnalysis } from "./types.js";

// ── Keyword Dictionaries ──────────────────────────────────

const PROJECT_TYPE_KEYWORDS: Record<string, string[]> = {
    portfolio: ["portfolio", "personal website", "personal site"],
    ecommerce: ["ecommerce", "e-commerce", "shopping cart", "online store", "marketplace"],
    dashboard: ["dashboard", "admin panel", "analytics dashboard", "monitoring"],
    "chat app": ["chat app", "chat application", "messaging", "real-time chat", "instant messaging"],
    "ai model": ["ai model", "machine learning", "deep learning", "neural network", "llm", "transformer", "gpt", "bert", "diffusion"],
    "rest api": ["rest api", "restful", "api server", "backend api", "graphql"],
    "mobile app": ["mobile app", "react native", "flutter", "ionic", "android app", "ios app", "expo"],
    scraper: ["scraper", "web scraping", "crawler", "web crawler", "data extraction"],
    automation: ["automation", "bot", "workflow", "auto", "cron", "scheduler"],
    clone: ["clone", "replica", "inspired by", "copy of"],
    tutorial: ["tutorial", "learning", "course", "example", "demo", "starter", "boilerplate", "template"],
};

const FEATURE_INDICATORS: Record<string, string[]> = {
    authentication: ["authentication", "auth", "login", "signup", "sign up", "oauth", "jwt", "session"],
    authorization: ["authorization", "role-based", "rbac", "permission", "access control"],
    realtime: ["realtime", "real-time", "live", "socket.io", "sse", "server-sent"],
    websocket: ["websocket", "ws://", "wss://", "socket"],
    deployment: ["deployment", "deploy", "heroku", "vercel", "netlify", "aws", "gcp", "azure", "railway"],
    docker: ["docker", "dockerfile", "docker-compose", "container", "kubernetes", "k8s"],
    testing: ["testing", "test", "jest", "mocha", "pytest", "unittest", "cypress", "playwright", "vitest"],
    "ci/cd": ["ci/cd", "ci cd", "github actions", "jenkins", "circleci", "travis", "pipeline"],
    caching: ["caching", "cache", "redis", "memcached"],
    microservices: ["microservices", "microservice", "service mesh", "api gateway"],
    payment: ["payment", "stripe", "paypal", "razorpay", "billing", "checkout"],
    search: ["search", "elasticsearch", "algolia", "full-text search", "lucene", "meilisearch"],
    analytics: ["analytics", "tracking", "metrics", "telemetry", "monitoring"],
};

const COMPLEXITY_SIGNALS: Record<string, string[]> = {
    database: ["database", "mongodb", "postgresql", "postgres", "mysql", "sqlite", "prisma", "sequelize", "typeorm", "mongoose", "supabase", "firebase"],
    api: ["api", "endpoint", "rest", "graphql", "grpc", "trpc"],
    "frontend-backend-separation": ["frontend", "backend", "client", "server", "monorepo", "full-stack", "fullstack"],
    "multiple-services": ["microservice", "service", "worker", "queue", "kafka", "rabbitmq", "redis queue", "bull"],
    "ml-pipeline": ["training", "inference", "model", "pipeline", "dataset", "epoch", "fine-tune", "huggingface"],
    "queue-worker": ["queue", "worker", "job", "background", "celery", "bull", "sidekiq"],
};

const TECH_KEYWORDS: string[] = [
    // Languages
    "javascript", "typescript", "python", "java", "go", "golang", "rust", "c++", "c#",
    "ruby", "php", "swift", "kotlin", "dart", "scala", "elixir",
    // Frontend
    "react", "next.js", "nextjs", "vue", "angular", "svelte", "solid", "astro", "gatsby",
    "tailwind", "tailwindcss", "bootstrap", "material ui", "chakra",
    // Backend
    "node.js", "nodejs", "express", "fastify", "nest.js", "nestjs", "django", "flask",
    "fastapi", "spring", "gin", "fiber", "rails", "laravel",
    // Databases
    "mongodb", "postgresql", "postgres", "mysql", "sqlite", "redis", "dynamodb",
    "cassandra", "neo4j", "supabase", "firebase", "prisma",
    // Cloud/DevOps
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "nginx",
    "vercel", "netlify", "heroku", "railway",
    // AI/ML
    "tensorflow", "pytorch", "keras", "scikit-learn", "transformers", "langchain",
    "openai", "huggingface", "opencv",
    // Mobile
    "react native", "flutter", "expo", "swift", "kotlin",
    // Tools
    "webpack", "vite", "rollup", "esbuild", "babel",
    "jest", "mocha", "cypress", "playwright", "vitest",
    "graphql", "grpc", "trpc", "socket.io",
];

// ── Main Parser ───────────────────────────────────────────

/**
 * Analyze README text locally using keyword dictionaries.
 * Returns a structured analysis object — zero LLM calls.
 */
export function parseReadme(readmeText: string): ReadmeAnalysis {
    if (!readmeText || readmeText.trim().length === 0) {
        return emptyAnalysis("");
    }

    const text = readmeText.toLowerCase();
    const contentHash = createHash("sha256").update(readmeText).digest("hex");

    // ── Project types ─────────────────────────────────────
    const projectTypes: string[] = [];
    for (const [type, keywords] of Object.entries(PROJECT_TYPE_KEYWORDS)) {
        if (keywords.some((kw) => text.includes(kw))) {
            projectTypes.push(type);
        }
    }

    // ── Features ──────────────────────────────────────────
    const features: string[] = [];
    for (const [feature, keywords] of Object.entries(FEATURE_INDICATORS)) {
        if (keywords.some((kw) => text.includes(kw))) {
            features.push(feature);
        }
    }

    // ── Complexity signals ────────────────────────────────
    const complexitySignals: string[] = [];
    for (const [signal, keywords] of Object.entries(COMPLEXITY_SIGNALS)) {
        if (keywords.some((kw) => text.includes(kw))) {
            complexitySignals.push(signal);
        }
    }

    // ── Tech mentions ─────────────────────────────────────
    const techMentions: string[] = [];
    for (const tech of TECH_KEYWORDS) {
        if (text.includes(tech)) {
            techMentions.push(tech);
        }
    }

    // ── Section headings ──────────────────────────────────
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    const sectionHeadings: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(readmeText)) !== null) {
        sectionHeadings.push(match[1].trim());
    }

    // ── Section detection ─────────────────────────────────
    const headingsLower = sectionHeadings.map((h) => h.toLowerCase());
    const hasInstallSection = headingsLower.some(
        (h) => h.includes("install") || h.includes("setup") || h.includes("getting started")
    );
    const hasApiSection = headingsLower.some(
        (h) => h.includes("api") || h.includes("endpoint") || h.includes("routes")
    );
    const hasDemoSection = headingsLower.some(
        (h) => h.includes("demo") || h.includes("screenshot") || h.includes("preview") || h.includes("live")
    );

    // ── Word count ────────────────────────────────────────
    const wordCount = readmeText.split(/\s+/).filter(Boolean).length;

    // ── Code block count ──────────────────────────────────
    const codeBlockCount = (readmeText.match(/```/g) || []).length / 2;

    return {
        projectTypes,
        features,
        complexitySignals,
        techMentions,
        sectionHeadings,
        hasInstallSection,
        hasApiSection,
        hasDemoSection,
        wordCount,
        codeBlockCount: Math.floor(codeBlockCount),
        contentHash,
    };
}

// ── Helpers ───────────────────────────────────────────────

function emptyAnalysis(hash: string): ReadmeAnalysis {
    return {
        projectTypes: [],
        features: [],
        complexitySignals: [],
        techMentions: [],
        sectionHeadings: [],
        hasInstallSection: false,
        hasApiSection: false,
        hasDemoSection: false,
        wordCount: 0,
        codeBlockCount: 0,
        contentHash: hash,
    };
}
