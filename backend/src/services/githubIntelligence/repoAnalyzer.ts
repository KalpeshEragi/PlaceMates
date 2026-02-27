// ────────────────────────────────────────────────────────────
// GitHub Intelligence — Per-Repo Local Analyzer (No LLM)
// ────────────────────────────────────────────────────────────
//
// Analyzes a single GitHub repo using deterministic heuristics.
// Produces a RepoProfile with scores, domain, features, etc.
// ────────────────────────────────────────────────────────────

import type {
    RawGitHubRepo,
    RepoProfile,
    DomainClassification,
    OriginalityHint,
    ReadmeAnalysis,
} from "./types.js";
import { parseReadme } from "./readmeParser.js";

// ── Domain Classification Maps ────────────────────────────

/** Weighted keyword → domain mapping (checked against language, topics, description, readme) */
const DOMAIN_SIGNALS: Record<DomainClassification, string[]> = {
    web: [
        "react", "next", "nextjs", "vue", "angular", "svelte", "html", "css",
        "tailwind", "bootstrap", "frontend", "web", "website", "webapp", "spa",
        "pwa", "gatsby", "astro", "remix", "nuxt", "vite", "sass", "less",
        "webpack", "parcel", "jsx", "tsx", "dom", "browser",
    ],
    ai: [
        "machine learning", "deep learning", "neural", "tensorflow", "pytorch",
        "keras", "transformers", "llm", "gpt", "bert", "diffusion", "nlp",
        "computer vision", "opencv", "huggingface", "langchain", "ai", "ml",
        "data science", "scikit", "sklearn", "reinforcement learning", "rl",
        "generative ai", "fine-tune", "fine tuning", "onnx", "model training",
        "inference", "embedding", "rag", "vector database",
    ],
    backend: [
        "express", "fastify", "nestjs", "django", "flask", "fastapi", "spring",
        "gin", "fiber", "rails", "laravel", "api server", "backend",
        "microservice", "graphql", "grpc", "trpc", "rest api", "api gateway",
        "middleware", "orm", "prisma", "sequelize", "typeorm",
    ],
    mobile: [
        "react native", "flutter", "expo", "android", "ios", "swift",
        "kotlin", "mobile", "ionic", "capacitor", "mobile app", "apk",
        "mobile ui", "xcode", "android studio", "cocoapods", "gradle",
        "swiftui", "jetpack compose", "dart",
    ],
    tooling: [
        "cli", "tool", "plugin", "extension", "linter", "formatter",
        "devtool", "utility", "webpack plugin", "rollup plugin",
        "babel plugin", "vscode extension", "chrome extension",
    ],
    data: [
        "data visualization", "analytics", "visualization", "tableau", "chart",
        "d3", "plotly", "jupyter", "matplotlib", "seaborn", "grafana",
        "dashboard analytics", "business intelligence", "bi tool",
    ],
    cybersecurity: [
        "security", "encryption", "malware", "exploit", "pentest",
        "penetration testing", "vulnerability", "ctf", "capture the flag",
        "hashing", "cryptography", "firewall", "auth attack", "packet sniffing",
        "brute force", "xss", "sql injection", "csrf", "owasp", "reverse engineering",
        "forensics", "intrusion detection", "ids", "nmap", "wireshark",
        "burp suite", "metasploit", "cybersecurity", "infosec", "zero day",
        "keylogger", "ransomware", "phishing", "honeypot",
    ],
    devops: [
        "docker", "kubernetes", "ci/cd", "ci cd", "github actions", "terraform",
        "ansible", "aws", "gcp", "azure", "deployment pipeline", "monitoring",
        "helm", "jenkins", "circleci", "travis", "argocd", "pulumi",
        "cloudformation", "infrastructure as code", "iac", "k8s",
        "container", "orchestration", "nginx", "load balancer", "prometheus",
        "grafana", "datadog", "devops", "cloud engineering", "vercel",
        "netlify", "heroku", "railway", "fly.io", "digitalocean",
    ],
    iot: [
        "sensor", "raspberry pi", "arduino", "mqtt", "hardware interface",
        "serial communication", "device telemetry", "firmware upload",
        "iot", "internet of things", "smart home", "home automation",
        "zigbee", "lora", "lorawan", "bluetooth le", "ble",
        "nodemcu", "gpio", "i2c", "spi", "wearable",
        "edge computing", "thingsboard", "node-red",
    ],
    embedded: [
        "microcontroller", "bare metal", "rtos", "interrupt handling",
        "stm32", "esp32", "esp8266", "hardware driver", "avr",
        "arm cortex", "embedded system", "embedded programming",
        "firmware", "hal", "bsp", "bootloader", "linker script",
        "register", "realtime os", "freertos", "zephyr",
        "embedded c", "embedded cpp", "cross compiler",
    ],
    "data-engineering": [
        "spark", "hadoop", "airflow", "etl", "data warehouse",
        "stream processing", "kafka", "flink", "beam", "dbt",
        "data pipeline", "data lake", "data engineering",
        "big data", "presto", "redshift", "snowflake", "bigquery",
        "parquet", "avro", "delta lake", "iceberg",
        "batch processing", "data ingestion", "pandas", "numpy",
    ],
    "game-dev": [
        "unity", "unreal", "game engine", "physics simulation",
        "player controller", "3d rendering", "game development",
        "godot", "phaser", "SDL", "opengl", "vulkan", "directx",
        "shader", "sprite", "tilemap", "game loop", "game jam",
        "multiplayer game", "procedural generation", "raycast",
        "collision detection", "game state", "pathfinding",
    ],
    blockchain: [
        "solidity", "smart contract", "web3", "ethereum",
        "token", "crypto wallet", "defi", "blockchain",
        "nft", "dao", "dapp", "decentralized", "hardhat",
        "truffle", "ganache", "metamask", "polygon", "solana",
        "rust smart contract", "anchor", "cosmwasm", "erc20", "erc721",
        "staking", "yield farming", "liquidity pool", "gas optimization",
    ],
    desktop: [
        "electron", "tauri", "qt", "gtk", "wxwidgets", "win32",
        "winforms", "wpf", ".net desktop", "macos app", "linux app",
        "desktop application", "system software", "native app",
        "tkinter", "pyqt", "javafx", "swing", "imgui",
        "cross-platform desktop", "tray app", "menu bar",
    ],
    automation: [
        "automation", "script", "bot", "scraper", "web scraping",
        "crawler", "cron", "scheduler", "task runner",
        "workflow automation", "selenium", "puppeteer", "playwright",
        "automate", "scripting", "batch script", "powershell",
        "bash script", "makefile", "rake", "gulp", "grunt",
        "github bot", "slack bot", "telegram bot", "discord bot",
    ],
    "competitive-programming": [
        "competitive programming", "algorithm", "data structure",
        "leetcode", "codeforces", "hackerrank", "codechef",
        "dsa", "dynamic programming", "graph algorithm",
        "sorting", "binary search", "greedy", "backtracking",
        "contest", "olympiad", "icpc", "cp", "problem solving",
        "bit manipulation", "segment tree", "fenwick tree",
    ],
    networking: [
        "networking", "tcp", "udp", "socket programming", "http server",
        "proxy", "vpn", "dns", "dhcp", "packet", "protocol",
        "network", "osi model", "routing", "load balancing",
        "systems programming", "kernel", "syscall", "operating system",
        "file system", "process management", "memory management",
        "concurrency", "multithreading", "async runtime",
    ],
    unknown: [],
};

// ── Originality Signals ───────────────────────────────────

const CLONE_SIGNALS = [
    "clone", "replica", "copy of", "inspired by", "based on",
    "like netflix", "like uber", "like airbnb", "like twitter",
    "like instagram", "like spotify", "like amazon",
];

const TUTORIAL_SIGNALS = [
    "tutorial", "course", "learn", "example", "demo", "starter",
    "boilerplate", "template", "sample", "practice", "exercise",
    "hello world", "getting started", "beginner",
];

// ── Main Analyzer ─────────────────────────────────────────

/**
 * Analyze a single GitHub repo using local heuristics only.
 * The readmeText field on the repo is optional — if present,
 * the README is parsed for additional signals.
 *
 * @returns RepoProfile with readmeSummaryShort set to null
 *          (compression happens in a separate step)
 */
export function analyzeRepo(repo: RawGitHubRepo): RepoProfile {
    const readmeAnalysis = parseReadme(repo.readmeText || "");

    const techStack = extractTechStack(repo, readmeAnalysis);
    const { domain, confidence: domainConfidence } = classifyDomain(repo, readmeAnalysis, techStack);
    const features = extractFeatures(repo, readmeAnalysis);
    const originalityHint = detectOriginality(repo, readmeAnalysis);

    const complexityScore = computeComplexityScore(repo, readmeAnalysis, features);
    const maturityScore = computeMaturityScore(repo, readmeAnalysis);
    const effortScore = computeEffortScore(repo);

    return {
        name: repo.name,
        description: repo.description,
        techStack,
        domain,
        domainConfidence,
        features,
        complexityScore,
        maturityScore,
        effortScore,
        originalityHint,
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        lastUpdated: repo.updated_at,
        repoUrl: repo.html_url,
        readmeSummaryShort: null,
        readmeContentHash: readmeAnalysis.contentHash || null,
    };
}

/**
 * Batch-analyze all repos.
 */
export function analyzeAllRepos(repos: RawGitHubRepo[]): RepoProfile[] {
    return repos
        .filter((r) => !r.fork) // skip forks — focus on original work
        .map(analyzeRepo);
}

// ── Tech Stack Extraction ─────────────────────────────────

function extractTechStack(repo: RawGitHubRepo, readme: ReadmeAnalysis): string[] {
    const techs = new Set<string>();

    // Primary language
    if (repo.language) {
        techs.add(repo.language.toLowerCase());
    }

    // Topics
    if (repo.topics) {
        for (const topic of repo.topics) {
            techs.add(topic.toLowerCase());
        }
    }

    // Tech mentions from README
    for (const tech of readme.techMentions) {
        techs.add(tech.toLowerCase());
    }

    return [...techs];
}

// ── Domain Classification ─────────────────────────────────

function classifyDomain(
    repo: RawGitHubRepo,
    readme: ReadmeAnalysis,
    techStack: string[]
): { domain: DomainClassification; confidence: number } {
    const domainScores: Partial<Record<DomainClassification, number>> = {};

    // Build searchable text
    const searchText = [
        repo.name,
        repo.description || "",
        repo.language || "",
        ...(repo.topics || []),
        ...techStack,
        ...readme.projectTypes,
    ]
        .join(" ")
        .toLowerCase();

    // Count matches per domain
    let totalMatches = 0;
    for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
        if (domain === "unknown") continue;
        let hits = 0;
        for (const signal of signals) {
            if (searchText.includes(signal)) {
                hits += 1;
            }
        }
        if (hits > 0) {
            domainScores[domain as DomainClassification] = hits;
            totalMatches += hits;
        }
    }

    // Find highest scoring domain
    let bestDomain: DomainClassification = "unknown";
    let bestScore = 0;
    for (const [domain, score] of Object.entries(domainScores)) {
        if (score > bestScore) {
            bestScore = score;
            bestDomain = domain as DomainClassification;
        }
    }

    // Compute confidence as proportion of total matches
    // Normalized: bestScore / totalMatches gives relative dominance
    // Also factor in the absolute hit count for minimum confidence floor
    let confidence = 0;
    if (totalMatches > 0 && bestScore > 0) {
        const relativeDominance = bestScore / totalMatches; // 0–1
        const absoluteStrength = Math.min(bestScore / 5, 1); // capped at 5 hits = 1.0
        confidence = Math.round((relativeDominance * 0.6 + absoluteStrength * 0.4) * 100) / 100;
    }

    return {
        domain: bestScore > 0 ? bestDomain : "unknown",
        confidence,
    };
}

// ── Feature Extraction ────────────────────────────────────

function extractFeatures(repo: RawGitHubRepo, readme: ReadmeAnalysis): string[] {
    const features = new Set<string>();

    // Features from README parsing
    for (const feature of readme.features) {
        features.add(feature);
    }

    // Features from topics
    const topicFeatureMap: Record<string, string> = {
        docker: "docker",
        authentication: "authentication",
        oauth: "authentication",
        jwt: "authentication",
        websocket: "websocket",
        "real-time": "realtime",
        testing: "testing",
        cicd: "ci/cd",
        "github-actions": "ci/cd",
        redis: "caching",
        microservices: "microservices",
        graphql: "api",
        rest: "api",
    };

    if (repo.topics) {
        for (const topic of repo.topics) {
            const mapped = topicFeatureMap[topic.toLowerCase()];
            if (mapped) features.add(mapped);
        }
    }

    return [...features];
}

// ── Originality Detection ─────────────────────────────────

function detectOriginality(repo: RawGitHubRepo, readme: ReadmeAnalysis): OriginalityHint {
    const searchText = [
        repo.name,
        repo.description || "",
        ...readme.projectTypes,
    ]
        .join(" ")
        .toLowerCase();

    // Check clone signals
    if (CLONE_SIGNALS.some((s) => searchText.includes(s))) {
        return "clone";
    }

    // Check tutorial signals
    if (TUTORIAL_SIGNALS.some((s) => searchText.includes(s))) {
        return "tutorial";
    }

    // If repo has meaningful complexity, it's likely original
    const hasComplexity = readme.complexitySignals.length >= 2;
    const hasStars = (repo.stargazers_count || 0) >= 2;
    const hasMeaningfulDesc =
        repo.description && repo.description.length > 40;

    if (hasComplexity || hasStars || hasMeaningfulDesc) {
        return "original";
    }

    return "unclear";
}

// ── Complexity Score (0–10) ───────────────────────────────

function computeComplexityScore(
    repo: RawGitHubRepo,
    readme: ReadmeAnalysis,
    features: string[]
): number {
    let score = 0;

    // Complexity signals from README (up to 4 points)
    score += Math.min(readme.complexitySignals.length * 1.5, 4);

    // Feature count contribution (up to 3 points)
    score += Math.min(features.length * 0.6, 3);

    // Code block count in README signals technical depth (up to 1 point)
    if (readme.codeBlockCount >= 3) score += 1;
    else if (readme.codeBlockCount >= 1) score += 0.5;

    // Repo size contribution (up to 1 point)
    if (repo.size > 5000) score += 1;
    else if (repo.size > 1000) score += 0.5;

    // Has API/install documentation (up to 1 point)
    if (readme.hasApiSection) score += 0.5;
    if (readme.hasInstallSection) score += 0.5;

    return Math.round(Math.min(score, 10) * 10) / 10;
}

// ── Maturity Score (0–10) ─────────────────────────────────

function computeMaturityScore(repo: RawGitHubRepo, readme: ReadmeAnalysis): number {
    let score = 0;

    // README quality (up to 3 points)
    if (readme.wordCount > 500) score += 3;
    else if (readme.wordCount > 200) score += 2;
    else if (readme.wordCount > 50) score += 1;

    // Has install/setup section (1 point)
    if (readme.hasInstallSection) score += 1;

    // Has demo/screenshots (1 point)
    if (readme.hasDemoSection) score += 1;

    // Stars indicate community validation (up to 2 points)
    if (repo.stargazers_count >= 10) score += 2;
    else if (repo.stargazers_count >= 3) score += 1;

    // Description quality (up to 1 point)
    if (repo.description && repo.description.length > 40) score += 1;
    else if (repo.description && repo.description.length > 10) score += 0.5;

    // Has homepage/demo link (1 point)
    if (repo.homepage) score += 1;

    // Has wiki or pages (0.5 each)
    if (repo.has_wiki) score += 0.5;
    if (repo.has_pages) score += 0.5;

    return Math.round(Math.min(score, 10) * 10) / 10;
}

// ── Effort Score (0–10) ───────────────────────────────────

function computeEffortScore(repo: RawGitHubRepo): number {
    let score = 0;

    // Repo age contribution (up to 3 points)
    if (repo.created_at) {
        const ageMonths = monthsBetween(new Date(repo.created_at), new Date());
        if (ageMonths >= 12) score += 3;
        else if (ageMonths >= 6) score += 2;
        else if (ageMonths >= 2) score += 1;
    }

    // Update recency — active maintenance (up to 2 points)
    if (repo.pushed_at || repo.updated_at) {
        const lastActive = new Date(repo.pushed_at || repo.updated_at);
        const monthsSincePush = monthsBetween(lastActive, new Date());
        if (monthsSincePush <= 1) score += 2;
        else if (monthsSincePush <= 3) score += 1.5;
        else if (monthsSincePush <= 6) score += 1;
    }

    // Commit count contribution (up to 2 points)
    if (repo.commit_count) {
        if (repo.commit_count >= 100) score += 2;
        else if (repo.commit_count >= 30) score += 1.5;
        else if (repo.commit_count >= 10) score += 1;
    } else {
        // Estimate from repo size as proxy
        if (repo.size > 5000) score += 1.5;
        else if (repo.size > 1000) score += 1;
        else if (repo.size > 100) score += 0.5;
    }

    // Contributors (up to 1.5 points)
    if (repo.contributors_count) {
        if (repo.contributors_count >= 5) score += 1.5;
        else if (repo.contributors_count >= 2) score += 1;
    }

    // Branches (up to 1.5 points)
    if (repo.branches_count) {
        if (repo.branches_count >= 5) score += 1.5;
        else if (repo.branches_count >= 2) score += 1;
    }

    return Math.round(Math.min(score, 10) * 10) / 10;
}

// ── Utilities ─────────────────────────────────────────────

function monthsBetween(from: Date, to: Date): number {
    const diff = to.getTime() - from.getTime();
    return Math.max(0, diff / (1000 * 60 * 60 * 24 * 30));
}
