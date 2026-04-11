/**
 * summary/summaryGenerator.ts
 *
 * Fully offline, deterministic professional summary generator.
 *
 * Strategy:
 *   1. Detect primary domain + secondary domains
 *   2. Pick top 3–4 technologies
 *   3. Describe project portfolio (count, types)
 *   4. Select a template family based on available signals
 *   5. Fill and join 2–3 sentences
 *
 * Output quality is determined by input richness — the system degrades
 * gracefully to generic templates when data is sparse.
 */

import type { UserSummaryInput } from "../types/index";

// ─────────────────────────────────────────────
// Sentence template banks
// ─────────────────────────────────────────────

type SentenceTemplate = (vars: SummaryVars) => string | null;

interface SummaryVars {
  primaryDomain: string | null;
  secondaryDomain: string | null;
  topTech: string[];
  tech1: string;
  tech2: string;
  tech3: string;
  techList: string;     // "React, Node.js, and TypeScript"
  techPair: string;     // "React and Node.js"
  projectCount: number;
  soloCount: number;
  collabCount: number;
  topSkillList: string; // "React, TypeScript, GraphQL"
  domains: string[];
  domainList: string;   // "Frontend and Backend"
  hasML: boolean;
  hasDevOps: boolean;
  hasMobile: boolean;
  hasMultiDomain: boolean;
}

// ── Opening sentences (always first) ──────────

const OPENING_TEMPLATES: SentenceTemplate[] = [
  (v) =>
    v.primaryDomain && v.tech1
      ? `${v.primaryDomain} engineer with hands-on experience building production systems using ${v.techList}.`
      : null,

  (v) =>
    v.hasMultiDomain && v.domainList && v.tech1
      ? `Full-stack developer specializing in ${v.domainList} with expertise in ${v.techList}.`
      : null,

  (v) =>
    v.hasML && v.tech1
      ? `ML engineer with experience training and deploying models using ${v.techList}.`
      : null,

  (v) =>
    v.hasDevOps && v.tech1
      ? `DevOps engineer experienced in infrastructure automation and cloud deployments using ${v.techList}.`
      : null,

  (v) =>
    v.hasMobile && v.tech1
      ? `Mobile developer building cross-platform and native apps with ${v.techList}.`
      : null,

  (v) =>
    v.primaryDomain === "Backend" && v.tech1
      ? `Backend engineer designing scalable APIs and data pipelines with ${v.techList}.`
      : null,

  (v) =>
    v.primaryDomain === "Frontend" && v.tech1
      ? `Frontend developer crafting responsive, accessible interfaces using ${v.techList}.`
      : null,

  // Generic fallback
  (v) =>
    v.tech1
      ? `Software engineer with production experience in ${v.techList}.`
      : "Software engineer with experience delivering full-stack web applications.",
];

// ── Middle sentences (add depth) ──────────────

const MIDDLE_TEMPLATES: SentenceTemplate[] = [
  (v) =>
    v.projectCount >= 3
      ? `Has built and shipped ${v.projectCount}+ projects spanning ${v.domainList || v.primaryDomain || "multiple domains"}.`
      : null,

  (v) =>
    v.collabCount >= 2 && v.soloCount >= 2
      ? `Comfortable working independently on solo projects and contributing to collaborative engineering teams.`
      : null,

  (v) =>
    v.soloCount >= 3
      ? `Proven ability to own projects end-to-end, from architecture through deployment.`
      : null,

  (v) =>
    v.collabCount >= 3
      ? `Experienced collaborating in team environments with strong communication and code review practices.`
      : null,

  (v) =>
    v.hasML && v.primaryDomain !== "ML / AI"
      ? `Integrates machine learning techniques into software systems alongside core engineering work.`
      : null,

  (v) =>
    v.hasDevOps && v.primaryDomain !== "DevOps"
      ? `Applies DevOps principles including containerization, CI/CD pipelines, and cloud deployments.`
      : null,

  (v) =>
    v.tech2 && v.primaryDomain
      ? `Focuses on clean architecture and maintainable code across ${v.primaryDomain.toLowerCase()} systems.`
      : null,

  // Generic
  () => `Focused on writing clean, maintainable code with a strong emphasis on testing and documentation.`,
];

// ── Closing sentences (outcome/goal oriented) ─

const CLOSING_TEMPLATES: SentenceTemplate[] = [
  (v) =>
    v.hasMultiDomain
      ? `Bridges ${v.domainList || "frontend and backend"} concerns to deliver cohesive, end-to-end features.`
      : null,

  (v) =>
    v.hasML
      ? `Passionate about applying data-driven techniques to solve real-world engineering problems.`
      : null,

  (v) =>
    v.primaryDomain === "Backend"
      ? `Delivers reliable, performant backend services with emphasis on observability and scalability.`
      : null,

  (v) =>
    v.primaryDomain === "Frontend"
      ? `Committed to exceptional user experience, performance optimization, and accessibility standards.`
      : null,

  (v) =>
    v.primaryDomain === "DevOps"
      ? `Drives reliability through automation, infrastructure-as-code, and robust deployment pipelines.`
      : null,

  (v) =>
    v.primaryDomain === "Mobile"
      ? `Delivers polished mobile experiences with a focus on performance and platform-native patterns.`
      : null,

  // Generic fallbacks
  () => `Delivers reliable, well-tested software with attention to code quality and long-term maintainability.`,
  () => `Committed to continuous learning and applying modern engineering best practices to every project.`,
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function oxfordList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const last = items[items.length - 1];
  return `${items.slice(0, -1).join(", ")}, and ${last}`;
}

function pickFirst<T>(fns: ((v: T) => string | null)[], vars: T): string {
  for (const fn of fns) {
    const result = fn(vars);
    if (result) return result;
  }
  return "";
}

function deduplicateProjectCounts(projects: UserSummaryInput["topProjects"]) {
  let soloCount = 0;
  let collabCount = 0;
  for (const p of projects) {
    // We don't have projectType here, infer from bullets length as proxy
    if (p.bullets.some((b) => /collaborat|team|together/i.test(b))) {
      collabCount++;
    } else {
      soloCount++;
    }
  }
  return { soloCount, collabCount };
}

// ─────────────────────────────────────────────
// Variable builder
// ─────────────────────────────────────────────

function buildVars(input: UserSummaryInput): SummaryVars {
  const { topProjects, topSkills, topDomains, primaryDomain } = input;

  // Aggregate tech stack across all top projects, deduplicated + frequency-ranked
  const techFreq = new Map<string, number>();
  for (const p of topProjects) {
    for (const t of p.techStack) {
      techFreq.set(t, (techFreq.get(t) ?? 0) + 1);
    }
  }
  // Also incorporate topSkills
  for (const s of topSkills) {
    if (!techFreq.has(s)) techFreq.set(s, 0.5);
  }

  const topTech = [...techFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter(
      (t) =>
        // Filter out very generic or infra-only terms for the summary
        !/^(YAML|JSON|Markdown|Make|CMake|Shell|Bash|PowerShell)$/i.test(t),
    )
    .slice(0, 5);

  const [tech1 = "", tech2 = "", tech3 = ""] = topTech;
  const techList = oxfordList(topTech.slice(0, 3));
  const techPair = tech2 ? `${tech1} and ${tech2}` : tech1;
  const topSkillList = topSkills.slice(0, 4).join(", ");

  const domains = topDomains.slice(0, 3);
  const domainList =
    domains.length >= 2
      ? `${domains[0]} and ${domains[1]}`
      : domains[0] ?? "";

  const hasML = domains.includes("ML / AI") || topTech.some((t) => /tensorflow|pytorch|keras|scikit|pandas/i.test(t));
  const hasDevOps = domains.includes("DevOps") || topTech.some((t) => /docker|kubernetes|terraform|aws|gcp|azure/i.test(t));
  const hasMobile = domains.includes("Mobile") || topTech.some((t) => /flutter|react.?native|swift|kotlin/i.test(t));
  const hasMultiDomain = domains.length >= 2;

  const { soloCount, collabCount } = deduplicateProjectCounts(topProjects);

  return {
    primaryDomain: primaryDomain ?? domains[0] ?? null,
    secondaryDomain: domains[1] ?? null,
    topTech,
    tech1, tech2, tech3,
    techList,
    techPair,
    projectCount: topProjects.length,
    soloCount,
    collabCount,
    topSkillList,
    domains,
    domainList,
    hasML,
    hasDevOps,
    hasMobile,
    hasMultiDomain,
  };
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generate a 2–3 sentence professional career summary.
 * Deterministic, offline, no external dependencies.
 */
export function generateUserSummary(input: UserSummaryInput): string {
  if (
    input.topProjects.length === 0 &&
    input.topSkills.length === 0 &&
    input.topDomains.length === 0
  ) {
    return "Software engineer with experience building and shipping production-grade web applications.";
  }

  const vars = buildVars(input);

  const opening = pickFirst(OPENING_TEMPLATES, vars);
  const middle  = pickFirst(MIDDLE_TEMPLATES,  vars);
  const closing = pickFirst(CLOSING_TEMPLATES, vars);

  // Avoid repeating the same sentence if templates overlapped in content
  const sentences = [opening, middle, closing].filter(Boolean);

  // Deduplicate by first 25 chars of normalized text
  const seen = new Set<string>();
  const unique = sentences.filter((s) => {
    const key = s.toLowerCase().slice(0, 25);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.join(" ").trim() ||
    "Software engineer with experience building production-grade web applications.";
}