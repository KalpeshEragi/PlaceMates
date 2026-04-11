/**
 * profileInsightsService.ts
 *
 * Stateless computation engine — reads existing user data from the DB and
 * produces meaningful profile insights. No mutations, no side-effects.
 *
 * Input:  userId
 * Output: ProfileInsights object
 */

import { prisma } from "../lib/prisma";
import { inferSkillDomain } from "./analysis/domainDetector";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ContributionSummary =
  | "frontend-heavy"
  | "backend-heavy"
  | "balanced"
  | "unknown";

export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";

export interface ProfileInsights {
  primaryDomain: string | null;
  secondaryDomain: string | null;
  skillDistribution: Record<string, number>;
  topTechnologies: { name: string; count: number }[];
  projectStats: {
    totalProjects: number;
    fullStackProjects: number;
    mobileProjects: number;
    frontendProjects: number;
    backendProjects: number;
    mlProjects: number;
  };
  contributionSummary: ContributionSummary;
  experienceLevel: ExperienceLevel;
  profileStrength: number;
}

// ─────────────────────────────────────────────
// Domain mapping (aligned with domainDetector.ts)
// ─────────────────────────────────────────────

const TECH_TO_DOMAIN: Record<string, string> = {
  // Frontend
  react: "Frontend", vue: "Frontend", angular: "Frontend", svelte: "Frontend",
  "next.js": "Frontend", nextjs: "Frontend", nuxt: "Frontend", gatsby: "Frontend",
  webpack: "Frontend", vite: "Frontend", tailwind: "Frontend", bootstrap: "Frontend",
  html: "Frontend", css: "Frontend", scss: "Frontend", sass: "Frontend",
  javascript: "Frontend", typescript: "Frontend", jquery: "Frontend",

  // Backend
  node: "Backend", "node.js": "Backend", express: "Backend", fastapi: "Backend",
  django: "Backend", flask: "Backend", spring: "Backend", rails: "Backend",
  nestjs: "Backend", graphql: "Backend", grpc: "Backend", rest: "Backend",
  prisma: "Backend", postgresql: "Backend", mysql: "Backend", mongodb: "Backend",
  redis: "Backend", postgres: "Backend", java: "Backend", "c#": "Backend",
  go: "Backend", rust: "Backend", ruby: "Backend", php: "Backend",
  elixir: "Backend", python: "Backend",

  // ML / AI
  tensorflow: "ML/AI", pytorch: "ML/AI", keras: "ML/AI", "scikit-learn": "ML/AI",
  pandas: "ML/AI", numpy: "ML/AI", "hugging face": "ML/AI", transformers: "ML/AI",
  langchain: "ML/AI", llama: "ML/AI", r: "ML/AI", julia: "ML/AI",

  // DevOps
  docker: "DevOps", kubernetes: "DevOps", terraform: "DevOps", ansible: "DevOps",
  jenkins: "DevOps", nginx: "DevOps", aws: "DevOps", gcp: "DevOps", azure: "DevOps",

  // Mobile
  flutter: "Mobile", "react native": "Mobile", swift: "Mobile", kotlin: "Mobile",
  android: "Mobile", ios: "Mobile", expo: "Mobile", dart: "Mobile",
};

const FRONTEND_SIGNALS = new Set([
  "react", "vue", "angular", "svelte", "next.js", "nextjs", "nuxt", "gatsby",
  "html", "css", "scss", "sass", "tailwind", "bootstrap", "webpack", "vite",
  "javascript", "typescript", "jquery",
]);

const BACKEND_SIGNALS = new Set([
  "node", "node.js", "express", "fastapi", "django", "flask", "spring", "rails",
  "nestjs", "graphql", "grpc", "prisma", "postgresql", "mysql", "mongodb",
  "redis", "postgres", "java", "c#", "go", "rust", "ruby", "php", "python",
  "elixir",
]);

const MOBILE_SIGNALS = new Set([
  "flutter", "react native", "swift", "kotlin", "android", "ios", "expo", "dart",
]);

const ML_SIGNALS = new Set([
  "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
  "hugging face", "transformers", "langchain", "llama", "r", "julia",
]);

// ─────────────────────────────────────────────
// 1. DOMAIN DETECTION
// ─────────────────────────────────────────────

function detectDomains(
  projects: { techStack: string[]; domain: string | null }[],
  skills: { name: string; domain: string | null }[],
): { primary: string | null; secondary: string | null } {
  const domainCounts = new Map<string, number>();

  // Count from project tech stacks
  for (const project of projects) {
    for (const tech of project.techStack) {
      const domain = TECH_TO_DOMAIN[tech.toLowerCase()];
      if (domain) {
        domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
      }
    }
    // Also use the project's inferred domain
    if (project.domain) {
      domainCounts.set(project.domain, (domainCounts.get(project.domain) ?? 0) + 2);
    }
  }

  // Count from skills
  for (const skill of skills) {
    const domain = skill.domain ?? inferSkillDomain(skill.name);
    if (domain && domain !== "Other") {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
  }

  const sorted = [...domainCounts.entries()].sort((a, b) => b[1] - a[1]);

  return {
    primary: sorted[0]?.[0] ?? null,
    secondary: sorted[1]?.[0] ?? null,
  };
}

// ─────────────────────────────────────────────
// 2. SKILL DISTRIBUTION
// ─────────────────────────────────────────────

function computeSkillDistribution(
  projects: { techStack: string[] }[],
  skills: { name: string; domain: string | null }[],
): Record<string, number> {
  const domainCounts = new Map<string, number>();
  let totalSignals = 0;

  // Count from project tech stacks
  for (const project of projects) {
    for (const tech of project.techStack) {
      const domain = TECH_TO_DOMAIN[tech.toLowerCase()];
      if (domain) {
        domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
        totalSignals++;
      }
    }
  }

  // Count from skills
  for (const skill of skills) {
    const domain = skill.domain ?? inferSkillDomain(skill.name);
    if (domain && domain !== "Other") {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
      totalSignals++;
    }
  }

  if (totalSignals === 0) return {};

  const distribution: Record<string, number> = {};
  for (const [domain, count] of domainCounts) {
    distribution[domain] = Math.round((count / totalSignals) * 100);
  }

  return distribution;
}

// ─────────────────────────────────────────────
// 3. TOP TECHNOLOGIES
// ─────────────────────────────────────────────

function computeTopTechnologies(
  projects: { techStack: string[] }[],
): { name: string; count: number }[] {
  const techCounts = new Map<string, number>();

  for (const project of projects) {
    for (const tech of project.techStack) {
      const normalized = tech.trim();
      if (normalized) {
        techCounts.set(normalized, (techCounts.get(normalized) ?? 0) + 1);
      }
    }
  }

  return [...techCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

// ─────────────────────────────────────────────
// 4. PROJECT STATS
// ─────────────────────────────────────────────

function computeProjectStats(projects: { techStack: string[]; domain: string | null }[]) {
  let fullStack = 0;
  let mobile = 0;
  let frontend = 0;
  let backend = 0;
  let ml = 0;

  for (const project of projects) {
    const lower = project.techStack.map((t) => t.toLowerCase());
    const hasFrontend = lower.some((t) => FRONTEND_SIGNALS.has(t));
    const hasBackend = lower.some((t) => BACKEND_SIGNALS.has(t));
    const hasMobile = lower.some((t) => MOBILE_SIGNALS.has(t));
    const hasMl = lower.some((t) => ML_SIGNALS.has(t));

    if (hasFrontend && hasBackend) fullStack++;
    if (hasFrontend) frontend++;
    if (hasBackend) backend++;
    if (hasMobile) mobile++;
    if (hasMl) ml++;
  }

  return {
    totalProjects: projects.length,
    fullStackProjects: fullStack,
    mobileProjects: mobile,
    frontendProjects: frontend,
    backendProjects: backend,
    mlProjects: ml,
  };
}

// ─────────────────────────────────────────────
// 5. CONTRIBUTION ANALYSIS
// ─────────────────────────────────────────────

function analyzeContribution(
  projects: { techStack: string[]; domain: string | null }[],
): ContributionSummary {
  if (projects.length === 0) return "unknown";

  let frontendWeight = 0;
  let backendWeight = 0;

  for (const project of projects) {
    const lower = project.techStack.map((t) => t.toLowerCase());
    const fCount = lower.filter((t) => FRONTEND_SIGNALS.has(t)).length;
    const bCount = lower.filter((t) => BACKEND_SIGNALS.has(t)).length;
    frontendWeight += fCount;
    backendWeight += bCount;
  }

  const total = frontendWeight + backendWeight;
  if (total === 0) return "unknown";

  const frontendRatio = frontendWeight / total;

  if (frontendRatio >= 0.65) return "frontend-heavy";
  if (frontendRatio <= 0.35) return "backend-heavy";
  return "balanced";
}

// ─────────────────────────────────────────────
// 6. EXPERIENCE LEVEL ESTIMATION
// ─────────────────────────────────────────────

function estimateExperienceLevel(
  projectCount: number,
  techVariety: number,
  experienceCount: number,
): ExperienceLevel {
  // Score-based estimation
  let score = 0;

  // Projects
  if (projectCount >= 8) score += 3;
  else if (projectCount >= 4) score += 2;
  else if (projectCount >= 1) score += 1;

  // Tech variety
  if (techVariety >= 8) score += 3;
  else if (techVariety >= 5) score += 2;
  else if (techVariety >= 2) score += 1;

  // Work experience
  if (experienceCount >= 3) score += 3;
  else if (experienceCount >= 1) score += 2;

  if (score >= 7) return "Advanced";
  if (score >= 4) return "Intermediate";
  return "Beginner";
}

// ─────────────────────────────────────────────
// 7. PROFILE STRENGTH
// ─────────────────────────────────────────────

function computeProfileStrength(data: {
  hasSummary: boolean;
  projectCount: number;
  skillCount: number;
  hasExperience: boolean;
  hasEducation: boolean;
  techDiversity: number;
}): number {
  let score = 0;

  if (data.hasSummary) score += 10;
  if (data.projectCount > 3) score += 20;
  if (data.skillCount > 5) score += 20;
  if (data.hasExperience) score += 20;
  if (data.hasEducation) score += 10;

  // Tech diversity (unique domains used)
  if (data.techDiversity >= 4) score += 20;
  else if (data.techDiversity >= 3) score += 15;
  else if (data.techDiversity >= 2) score += 10;
  else if (data.techDiversity >= 1) score += 5;

  return Math.min(score, 100);
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export async function computeProfileInsights(
  userId: string,
): Promise<ProfileInsights> {
  const [projects, skills, experiences, educations, summary] =
    await Promise.all([
      prisma.project.findMany({
        where: { userId },
        select: {
          techStack: true,
          domain: true,
        },
      }),
      prisma.skill.findMany({
        where: { userId },
        select: { name: true, domain: true },
      }),
      prisma.experience.findMany({
        where: { userId },
        select: { id: true },
      }),
      prisma.education.findMany({
        where: { userId },
        select: { id: true },
      }),
      prisma.userSummary.findUnique({
        where: { userId },
        select: { summaryText: true },
      }),
    ]);

  // 1. Domain detection
  const { primary, secondary } = detectDomains(projects, skills);

  // 2. Skill distribution
  const skillDistribution = computeSkillDistribution(projects, skills);

  // 3. Top technologies
  const topTechnologies = computeTopTechnologies(projects);

  // 4. Project stats
  const projectStats = computeProjectStats(projects);

  // 5. Contribution analysis
  const contributionSummary = analyzeContribution(projects);

  // 6. Unique techs across all projects (for experience & strength)
  const uniqueTechs = new Set<string>();
  for (const p of projects) {
    for (const t of p.techStack) uniqueTechs.add(t.toLowerCase());
  }

  // Unique domains
  const uniqueDomains = new Set<string>();
  for (const [, count] of Object.entries(skillDistribution)) {
    if (count > 0) uniqueDomains.add("counted");
  }
  // Better: count actual distinct domains
  const domainSet = new Set<string>();
  for (const p of projects) {
    for (const t of p.techStack) {
      const d = TECH_TO_DOMAIN[t.toLowerCase()];
      if (d) domainSet.add(d);
    }
  }

  // 6. Experience level
  const experienceLevel = estimateExperienceLevel(
    projects.length,
    uniqueTechs.size,
    experiences.length,
  );

  // 7. Profile strength
  const profileStrength = computeProfileStrength({
    hasSummary: Boolean(summary?.summaryText && summary.summaryText.length > 10),
    projectCount: projects.length,
    skillCount: skills.length,
    hasExperience: experiences.length > 0,
    hasEducation: educations.length > 0,
    techDiversity: domainSet.size,
  });

  return {
    primaryDomain: primary,
    secondaryDomain: secondary,
    skillDistribution,
    topTechnologies,
    projectStats,
    contributionSummary,
    experienceLevel,
    profileStrength,
  };
}
