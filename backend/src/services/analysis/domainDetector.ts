/**
 * analysis/domainDetector.ts
 *
 * Single source of truth for domain inference across the pipeline.
 * Accepts multiple signal sources and returns the most confident Domain.
 */

import type { Domain } from "../types/index";

// ─────────────────────────────────────────────
// Signal tables
// ─────────────────────────────────────────────

const LANGUAGE_DOMAIN: [RegExp, Domain][] = [
  [/typescript|javascript/i,      "Frontend"],
  [/python/i,                      "Backend"],
  [/go|rust|java|c\+\+|c#/i,      "Backend"],
  [/swift|kotlin|dart/i,           "Mobile"],
  [/r$/i,                          "ML / AI"],
  [/julia/i,                       "ML / AI"],
  [/ruby|php|elixir/i,             "Backend"],
  [/html|css|scss/i,               "Frontend"],
  [/shell|bash|powershell/i,       "DevOps"],
  [/dockerfile/i,                  "DevOps"],
  [/terraform|hcl/i,               "DevOps"],
];

const TECH_DOMAIN: Record<string, Domain> = {
  // Frontend
  react: "Frontend", vue: "Frontend", angular: "Frontend", svelte: "Frontend",
  "next.js": "Frontend", nextjs: "Frontend", nuxt: "Frontend", gatsby: "Frontend",
  webpack: "Frontend", vite: "Frontend", tailwind: "Frontend", bootstrap: "Frontend",
  html: "Frontend", css: "Frontend", scss: "Frontend",
  // Backend
  node: "Backend", "node.js": "Backend", express: "Backend", fastapi: "Backend",
  django: "Backend", flask: "Backend", spring: "Backend", rails: "Backend",
  nestjs: "Backend", graphql: "Backend", grpc: "Backend", rest: "Backend",
  prisma: "Backend", postgresql: "Backend", mysql: "Backend", mongodb: "Backend",
  redis: "Backend", postgres: "Backend",
  // ML / AI
  tensorflow: "ML / AI", pytorch: "ML / AI", keras: "ML / AI", "scikit-learn": "ML / AI",
  pandas: "ML / AI", numpy: "ML / AI", "hugging face": "ML / AI", transformers: "ML / AI",
  langchain: "ML / AI", llama: "ML / AI",
  // DevOps
  docker: "DevOps", kubernetes: "DevOps", terraform: "DevOps", ansible: "DevOps",
  jenkins: "DevOps", nginx: "DevOps", aws: "DevOps", gcp: "DevOps", azure: "DevOps",
  // Mobile
  flutter: "Mobile", "react native": "Mobile", swift: "Mobile", kotlin: "Mobile",
  android: "Mobile", ios: "Mobile", expo: "Mobile",
};

// Domain-specific module hints (from fileAnalyzer output)
const MODULE_DOMAIN: Record<string, Domain> = {
  "Auth": "Backend",
  "API": "Backend",
  "Database": "Backend",
  "Background Jobs": "Backend",
  "Realtime": "Backend",
  "Caching": "Backend",
  "Payments": "Backend",
  "Notifications": "Backend",
  "File Storage": "Backend",
  "UI": "Frontend",
  "Admin": "Frontend",
  "Testing": "Backend",
  "DevOps": "DevOps",
  "Monitoring": "DevOps",
  "Config": "Other",
  "Utilities": "Other",
  "ML/AI": "ML / AI",
  "Search": "Backend",
};

// ─────────────────────────────────────────────
// Scoring logic
// ─────────────────────────────────────────────

type Signals = {
  /** Ordered tech stack (by usage bytes) */
  techStack?: string[];
  /** Languages from GitHub language API */
  languages?: string[];
  /** Modules from fileAnalyzer */
  modules?: string[];
  /** Domain from readmeAnalyzer */
  readmeDomain?: Domain | null;
};

function scoreFromTech(techStack: string[]): Partial<Record<Domain, number>> {
  const scores: Partial<Record<Domain, number>> = {};
  techStack.forEach((tech, idx) => {
    // Base weight of 2, plus up to 4 points for being first
    const weight = 2 + Math.max(4 - idx, 0);
    const domain = TECH_DOMAIN[tech.toLowerCase()];
    if (domain) scores[domain] = (scores[domain] ?? 0) + weight;
  });
  return scores;
}

function scoreFromLanguages(langs: string[]): Partial<Record<Domain, number>> {
  const scores: Partial<Record<Domain, number>> = {};
  langs.forEach((lang, idx) => {
    // Base weight of 2, plus up to 3 points for being first
    const weight = 2 + Math.max(3 - idx, 0);
    for (const [pattern, domain] of LANGUAGE_DOMAIN) {
      if (pattern.test(lang)) {
        scores[domain] = (scores[domain] ?? 0) + weight;
        break;
      }
    }
  });
  return scores;
}

function scoreFromModules(modules: string[]): Partial<Record<Domain, number>> {
  const scores: Partial<Record<Domain, number>> = {};
  for (const m of modules) {
    const domain = MODULE_DOMAIN[m];
    if (domain) scores[domain] = (scores[domain] ?? 0) + 1;
  }
  return scores;
}

function mergeDomainScores(
  ...sources: Partial<Record<Domain, number>>[]
): Domain | null {
  const total: Partial<Record<Domain, number>> = {};
  for (const src of sources) {
    for (const [domain, score] of Object.entries(src) as [Domain, number][]) {
      total[domain] = (total[domain] ?? 0) + score;
    }
  }

  // Evaluate for Full Stack
  // If a project has a strong absolute signal (>= 4) for both Frontend and Backend
  // 4 points means a tech is either the 2nd largest language, or there are 2 distinct libraries
  const front = total["Frontend"] ?? 0;
  const back = total["Backend"] ?? 0;
  if (front >= 4 && back >= 4) {
    total["Full Stack"] = Math.max(front, back) + 1;
  }

  const sorted = (Object.entries(total) as [Domain, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  return sorted[0]?.[0] ?? null;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Infer the project domain from all available signals.
 * Each signal source is weighted:
 *   README domain   → high trust (explicit human description)
 *   Tech stack      → high trust (ordered by usage)
 *   Languages       → medium trust
 *   Modules         → low trust (structural hints)
 */
export function inferDomain(signals: Signals): Domain | null {
  const techScores     = scoreFromTech(signals.techStack ?? []);
  const langScores     = scoreFromLanguages(signals.languages ?? []);
  const moduleScores   = scoreFromModules(signals.modules ?? []);

  // README domain gets a hard bonus of 6 pts (highest single signal)
  const readmeBonus: Partial<Record<Domain, number>> = {};
  if (signals.readmeDomain) {
    readmeBonus[signals.readmeDomain] = 6;
  }

  return mergeDomainScores(readmeBonus, techScores, langScores, moduleScores);
}

/**
 * Normalize a raw domain string to a canonical Domain value.
 */
export function normalizeDomain(raw: string | null | undefined): Domain | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (/front/.test(lower)) return "Frontend";
  if (/back|api|server/.test(lower)) return "Backend";
  if (/ml|ai|machine|deep|data.?sci/.test(lower)) return "ML / AI";
  if (/dev.?ops|infra|cloud|deploy/.test(lower)) return "DevOps";
  if (/mobile|android|ios|flutter/.test(lower)) return "Mobile";
  return "Other";
}

/**
 * Infer skill domain from a single technology name.
 */
export function inferSkillDomain(name: string): string {
  const lower = name.toLowerCase();
  if (/react|vue|next|angular|html|css|tailwind|svelte|frontend/.test(lower)) return "Frontend";
  if (/node|express|django|flask|spring|fastapi|graphql|rails|backend/.test(lower)) return "Backend";
  if (/python|tensorflow|pytorch|keras|scikit|pandas|numpy|ml/.test(lower)) return "ML / AI";
  if (/docker|kubernetes|aws|azure|gcp|terraform|devops|linux/.test(lower)) return "DevOps";
  if (/swift|kotlin|flutter|android|ios|mobile|react.?native/.test(lower)) return "Mobile";
  if (/postgres|mysql|mongodb|redis|sql|database|prisma|firebase/.test(lower)) return "Backend";
  return "Other";
}