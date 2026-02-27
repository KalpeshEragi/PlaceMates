// ────────────────────────────────────────────────────────────
// Smart Profile — Skill Normalization & Scoring
// ────────────────────────────────────────────────────────────
//
// Merges skills from LinkedIn, GitHub languages, and README keywords.
// Deduplicates, applies weighted scoring, returns sorted lists.
// ────────────────────────────────────────────────────────────

import type { ScoredSkill, GitHubRepo } from "./types.js";

// ── Weights ────────────────────────────────────────────────
const WEIGHT_LINKEDIN = 3;
const WEIGHT_GITHUB_LANG = 5;
const WEIGHT_README = 2;

// Common noise words to exclude from README keyword extraction
const NOISE_WORDS = new Set([
    "the", "and", "for", "with", "this", "that", "from", "are", "was",
    "will", "can", "has", "have", "not", "but", "all", "been", "more",
    "use", "used", "using", "also", "its", "into", "than", "other",
    "how", "about", "just", "like", "make", "get", "set", "new", "you",
    "your", "project", "file", "code", "run", "install", "build",
    "npm", "yarn", "pnpm", "git", "github", "readme", "license",
    "todo", "contributing", "contributors", "version", "docs",
]);

// Known tech keywords to look for in READMEs
const TECH_KEYWORDS = new Set([
    "react", "nextjs", "next.js", "angular", "vue", "svelte", "node",
    "nodejs", "node.js", "express", "fastify", "nestjs", "django",
    "flask", "spring", "rails", "laravel", "php", "ruby", "python",
    "javascript", "typescript", "java", "kotlin", "swift", "rust",
    "golang", "go", "c++", "cpp", "csharp", "c#", "dart", "flutter",
    "react-native", "android", "ios", "docker", "kubernetes", "k8s",
    "aws", "azure", "gcp", "firebase", "mongodb", "postgresql",
    "postgres", "mysql", "redis", "graphql", "rest", "api",
    "tensorflow", "pytorch", "keras", "scikit-learn", "pandas",
    "numpy", "opencv", "machine-learning", "deep-learning",
    "artificial-intelligence", "nlp", "computer-vision",
    "tailwindcss", "tailwind", "bootstrap", "sass", "css",
    "html", "webpack", "vite", "prisma", "sequelize", "typeorm",
    "elasticsearch", "rabbitmq", "kafka", "nginx", "linux",
    "ci/cd", "jenkins", "terraform", "ansible", "devops",
    "blockchain", "solidity", "web3", "dsa", "algorithms",
    "data-structures", "competitive-programming",
]);

/**
 * Merge and score skills from all available data sources.
 *
 * @param linkedInSkills  - Skill names from LinkedIn profile
 * @param githubRepos     - GitHub repos (we extract languages)
 * @returns Sorted list of scored skills
 */
export function normalizeSkills(
    linkedInSkills: string[],
    githubRepos: GitHubRepo[]
): {
    allSkills: ScoredSkill[];
    topSkills: string[];
    secondarySkills: string[];
    strongestLanguages: string[];
} {
    const scoreMap = new Map<string, ScoredSkill>();

    // ── Helper: add/increment a skill ─────────────────────────
    function addSkill(rawName: string, weight: number, source: string) {
        const name = rawName.trim().toLowerCase();
        if (!name || name.length < 2) return;

        const existing = scoreMap.get(name);
        if (existing) {
            existing.score += weight;
            if (!existing.sources.includes(source)) {
                existing.sources.push(source);
            }
        } else {
            scoreMap.set(name, { name, score: weight, sources: [source] });
        }
    }

    // ── 1. LinkedIn skills (+3 each) ──────────────────────────
    for (const skill of linkedInSkills) {
        addSkill(skill, WEIGHT_LINKEDIN, "linkedin");
    }

    // ── 2. GitHub repo languages (+5 each occurrence) ─────────
    const languageCountMap = new Map<string, number>();

    for (const repo of githubRepos) {
        if (repo.fork) continue; // skip forked repos
        if (repo.language) {
            const lang = repo.language.toLowerCase();
            languageCountMap.set(lang, (languageCountMap.get(lang) || 0) + 1);
            addSkill(repo.language, WEIGHT_GITHUB_LANG, "github");
        }
    }

    // ── 3. README / repo description keywords (+2 each) ──────
    for (const repo of githubRepos) {
        if (repo.fork) continue;

        const text = [repo.description || "", ...(repo.topics || [])].join(" ");
        const words = text.toLowerCase().split(/[\s,.\-_/()[\]{}|;:'"!?#@&*+=<>]+/);

        for (const word of words) {
            if (word.length >= 2 && !NOISE_WORDS.has(word) && TECH_KEYWORDS.has(word)) {
                addSkill(word, WEIGHT_README, "readme");
            }
        }
    }

    // ── 4. Sort by score descending ───────────────────────────
    const allSkills = Array.from(scoreMap.values()).sort(
        (a, b) => b.score - a.score
    );

    // ── 5. Extract top/secondary skills ───────────────────────
    const topSkills = allSkills.slice(0, 5).map((s) => s.name);
    const secondarySkills = allSkills.slice(5, 10).map((s) => s.name);

    // ── 6. Strongest languages (from GitHub only, by frequency)
    const strongestLanguages = Array.from(languageCountMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang);

    return { allSkills, topSkills, secondarySkills, strongestLanguages };
}
