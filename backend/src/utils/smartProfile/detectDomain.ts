// ────────────────────────────────────────────────────────────
// Smart Profile — Primary Domain Detection
// ────────────────────────────────────────────────────────────
//
// Pattern-matches user skills and repo data against known
// domain dictionaries to determine the user's primary domain.
// ────────────────────────────────────────────────────────────

import type { GitHubRepo } from "./types.js";

/**
 * Domain definitions: each domain has indicator keywords
 * and how many points each keyword match adds.
 */
interface DomainRule {
    name: string;
    keywords: string[];
    repoNamePatterns?: string[]; // partial matches on repo names
}

const DOMAIN_RULES: DomainRule[] = [
    {
        name: "Web Development",
        keywords: [
            "react", "nextjs", "next.js", "angular", "vue", "svelte",
            "node", "nodejs", "node.js", "express", "fastify", "nestjs",
            "javascript", "typescript", "html", "css", "sass",
            "tailwind", "tailwindcss", "bootstrap", "webpack", "vite",
            "graphql", "rest", "api", "prisma", "mongodb", "postgresql",
            "django", "flask", "rails", "laravel", "php", "ruby",
        ],
        repoNamePatterns: [
            "web", "frontend", "backend", "fullstack", "full-stack",
            "dashboard", "landing", "portfolio", "blog",
        ],
    },
    {
        name: "AI / Machine Learning",
        keywords: [
            "python", "tensorflow", "pytorch", "keras", "scikit-learn",
            "pandas", "numpy", "opencv", "machine-learning", "deep-learning",
            "artificial-intelligence", "nlp", "computer-vision",
            "ml", "ai", "data-science", "jupyter", "notebook",
            "transformers", "huggingface", "langchain", "llm",
        ],
        repoNamePatterns: [
            "ml", "ai", "machine", "deep", "neural", "nlp",
            "vision", "model", "predict", "classify",
        ],
    },
    {
        name: "Mobile Development",
        keywords: [
            "java", "kotlin", "android", "swift", "ios", "dart",
            "flutter", "react-native", "expo", "xcode",
            "objective-c", "mobile",
        ],
        repoNamePatterns: [
            "android", "ios", "mobile", "app", "flutter", "react-native",
        ],
    },
    {
        name: "DevOps / Cloud",
        keywords: [
            "docker", "kubernetes", "k8s", "aws", "azure", "gcp",
            "terraform", "ansible", "jenkins", "ci/cd", "devops",
            "linux", "nginx", "prometheus", "grafana", "helm",
            "cloudformation", "serverless", "lambda",
        ],
        repoNamePatterns: [
            "deploy", "infra", "cloud", "devops", "docker", "k8s",
        ],
    },
    {
        name: "Data Science / Analytics",
        keywords: [
            "python", "r", "pandas", "numpy", "matplotlib", "seaborn",
            "tableau", "powerbi", "sql", "statistics", "data-analysis",
            "data-visualization", "spark", "hadoop", "etl",
        ],
        repoNamePatterns: [
            "data", "analytics", "analysis", "visualization", "dashboard",
        ],
    },
    {
        name: "Competitive Programming",
        keywords: [
            "c++", "cpp", "c", "dsa", "algorithms", "data-structures",
            "competitive-programming", "leetcode", "codeforces",
        ],
        repoNamePatterns: [
            "dsa", "leetcode", "codeforces", "competitive", "algo",
            "hackerrank", "codechef", "cp", "problems", "solutions",
        ],
    },
    {
        name: "Blockchain / Web3",
        keywords: [
            "solidity", "blockchain", "web3", "ethereum", "smart-contract",
            "defi", "nft", "hardhat", "truffle", "metamask",
        ],
        repoNamePatterns: [
            "blockchain", "web3", "smart-contract", "dapp", "defi",
        ],
    },
    {
        name: "Game Development",
        keywords: [
            "unity", "unreal", "godot", "c#", "csharp", "c++", "cpp",
            "gamedev", "game-development", "opengl", "directx",
        ],
        repoNamePatterns: [
            "game", "unity", "unreal", "godot", "engine",
        ],
    },
];

/**
 * Detect the user's primary domain based on their skills and repo data.
 *
 * @param topSkills   - Already-normalized top skill names (lowercase)
 * @param allSkills   - All scored skill names (lowercase)
 * @param githubRepos - GitHub repos for repo-name pattern matching
 * @returns The highest-scoring domain name, or "Software Development" as fallback
 */
export function detectPrimaryDomain(
    topSkills: string[],
    allSkills: string[],
    githubRepos: GitHubRepo[]
): string {
    const domainScores = new Map<string, number>();

    // Combine all user signals into a set for fast lookup
    const skillSet = new Set(allSkills);
    const repoNames = githubRepos
        .filter((r) => !r.fork)
        .map((r) => r.name.toLowerCase());

    for (const rule of DOMAIN_RULES) {
        let score = 0;

        // ── Keyword matches against user skills ───────────────
        for (const keyword of rule.keywords) {
            if (skillSet.has(keyword)) {
                // Top skills get extra weight
                score += topSkills.includes(keyword) ? 5 : 2;
            }
        }

        // ── Repo name partial matches ─────────────────────────
        if (rule.repoNamePatterns) {
            for (const repoName of repoNames) {
                for (const pattern of rule.repoNamePatterns) {
                    if (repoName.includes(pattern)) {
                        score += 1;
                        break; // one match per repo is enough
                    }
                }
            }
        }

        if (score > 0) {
            domainScores.set(rule.name, score);
        }
    }

    // ── Pick highest score ────────────────────────────────────
    if (domainScores.size === 0) {
        return "Software Development"; // generic fallback
    }

    const sorted = Array.from(domainScores.entries()).sort(
        (a, b) => b[1] - a[1]
    );

    return sorted[0][0];
}
