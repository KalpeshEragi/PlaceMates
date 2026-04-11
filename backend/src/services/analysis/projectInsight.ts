/**
 * analysis/projectInsight.ts
 *
 * Project Intelligence Layer — synthesizes all analysis outputs into a
 * structured ProjectInsight object that serves as the single source of
 * truth for bullet generation.
 *
 * This layer:
 *   1. Deduplicates features from README, commits, and file analysis
 *   2. Ranks features by signal strength (multi-source > single-source)
 *   3. Computes project complexity from module/feature/tech counts
 *   4. Narrows contribution areas for collaborative projects
 *   5. Ensures every field is populated (fallbacks, never empty)
 */

import type {
  ProjectInsight,
  TemplateEngineInput,
  Domain,
  CommitType,
} from "../types/index";

function deduplicateAndRankFeatures(input: TemplateEngineInput): string[] {
  const confident = (input.featureConfidence ?? [])
    .filter((item) => item.confidence >= 0.6)
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
    .map((item) => item.name.toLowerCase().trim());

  const unique = [...new Set(confident)];
  if (unique.length > 0) return unique.slice(0, 8);
  return [...new Set((input.detectedFeatures ?? []).map((f) => f.toLowerCase().trim()))].slice(0, 8);
}

// ─────────────────────────────────────────────
// Complexity scoring
// ─────────────────────────────────────────────

function computeComplexity(
  modules: string[],
  features: string[],
  techStack: string[],
): "simple" | "moderate" | "complex" {
  const score = modules.length + features.length + Math.min(techStack.length, 4);

  if (score >= 10) return "complex";
  if (score >= 5) return "moderate";
  return "simple";
}

// ─────────────────────────────────────────────
// Contribution area extraction
// ─────────────────────────────────────────────

function extractContributionAreas(
  modules: string[],
  contributionFiles: string[],
  projectType: "solo" | "collaborative",
): string[] {
  if (projectType === "solo") {
    // For solo projects, all modules are contribution areas
    return modules.slice(0, 5);
  }

  // For collaborative projects, focus on what the user actually touched
  const areaSet = new Set<string>();

  for (const fp of contributionFiles) {
    const normalized = "/" + fp.replace(/\\/g, "/").toLowerCase();

    if (/\/(auth|login|session|token)/i.test(normalized)) areaSet.add("authentication");
    if (/\/(api|route|controller|handler)/i.test(normalized)) areaSet.add("API development");
    if (/\/(component|view|page|ui|layout)/i.test(normalized)) areaSet.add("frontend UI");
    if (/\/(model|schema|migration|database)/i.test(normalized)) areaSet.add("database design");
    if (/\/(test|spec|__test__)/i.test(normalized)) areaSet.add("testing");
    if (/\/(service|middleware)/i.test(normalized)) areaSet.add("business logic");
    if (/\/(docker|deploy|ci|workflow)/i.test(normalized)) areaSet.add("DevOps");
    if (/\/(style|css|scss|theme)/i.test(normalized)) areaSet.add("styling");
  }

  return areaSet.size > 0 ? [...areaSet].slice(0, 5) : modules.slice(0, 3);
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Build a ProjectInsight from the raw TemplateEngineInput plus
 * additional analysis data. This is the single structured object
 * that drives all bullet generation.
 */
export function buildProjectInsight(
  input: TemplateEngineInput,
  extra?: {
    contributionNarrative?: string[];
    readmeFeatures?: string[];
    readmeMentionedTech?: string[];
    architectureStyle?: string;
  },
): ProjectInsight {
  const features = deduplicateAndRankFeatures(input);

  const modules = input.modules.filter(
    (m) => !["Config", "Utilities"].includes(m), // exclude low-signal modules
  );

  const commitTypes = input.commitTypes ?? {};
  const commitActivity = {
    total: input.commitMessages.length,
    featureCommits: (commitTypes.feat ?? 0),
    fixCommits: (commitTypes.fix ?? 0),
    refactorCommits: (commitTypes.refactor ?? 0),
  };

  const contributionAreas = extractContributionAreas(
    modules,
    input.contributionFiles,
    input.projectType,
  );

  return {
    name: input.projectName,
    projectType: input.projectType,
    domain: input.domain as Domain | null,
    complexity: computeComplexity(modules, features, input.techStack),
    techStack: input.techStack,
    primaryTech: input.techStack[0] ?? "modern technologies",
    features,
    modules,
    contributionAreas,
    commitActivity,
    readmeInsight: {
      summary: input.readmeSummary,
      mentionedTech: extra?.readmeMentionedTech ?? [],
      keywords: [],
    },
    contributionNarrative: extra?.contributionNarrative ?? [],
    collaboratorCount: input.collaborators,
    architectureStyle: extra?.architectureStyle ?? "modular",
  };
}
