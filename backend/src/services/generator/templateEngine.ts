/**
 * templateEngine.ts
 *
 * Builds a placeholder context from ProjectInsight / TemplateEngineInput,
 * then expands every applicable template into candidate sentences.
 *
 * Expansion rules:
 *   {module} / {area}      → generates one sentence per detected module (max 3)
 *   {feature}              → generates one sentence per detected feature (max 3)
 *   {commitNarrative}      → generates one sentence per narrative phrase (max 3)
 *   Both module+feature    → uses first module + first feature (no cross-product)
 *
 * A template is skipped when any var in requiredVars resolves to "".
 * Sentences with leftover "{…}" tokens are also discarded.
 *
 * Hard validation: every expanded sentence MUST contain at least 1 feature,
 * module, or tech reference — otherwise it is discarded.
 */

import { TEMPLATES, type BulletTemplate } from "./templates";
import type { ProjectInsight } from "../types/index";
import { buildProjectInsight } from "../analysis/projectInsight";

// ─────────────────────────────────────────────
// Public input type (backward compat)
// ─────────────────────────────────────────────

export interface TemplateEngineInput {
  projectName: string;
  projectType: "solo" | "collaborative";
  techStack: string[];
  modules: string[];
  domain: string | null;
  readmeSummary: string | null;
  commitMessages: string[];
  contributionFiles: string[];
  collaborators?: number;
  detectedFeatures?: string[];
  commitTypes?: Partial<Record<string, number>>;
  // Extended fields from enhanced pipeline
  contributionNarrative?: string[];
  readmeFeatures?: string[];
  readmeMentionedTech?: string[];
  architectureStyle?: string;
  featureConfidence?: Array<{
    name: string;
    confidence: number;
    sources: Array<"readme" | "files" | "commits">;
  }>;
}

// ─────────────────────────────────────────────
// Internal placeholder context
// ─────────────────────────────────────────────

interface PlaceholderContext {
  // scalar
  projectName: string;
  primaryTech: string;
  secondaryTech: string;
  tertiaryTech: string;
  techList: string;
  techPair: string;
  domain: string;
  moduleList: string;
  collaborators: string;
  projectType: string;
  complexity: string;
  architectureStyle: string;

  // arrays for expansion
  modules: string[];
  features: string[];
  commitNarratives: string[];
  supportedFeaturePool: string[];

  // For validation
  techStackLower: string[];
  featurePool: string[];
  modulePool: string[];
}

// ─────────────────────────────────────────────
// Fallback values for optional placeholders
// ─────────────────────────────────────────────

const FALLBACKS: Record<string, string> = {
  domain: "software",
  area: "core",
  moduleList: "core services",
  architectureStyle: "modular",
  complexity: "moderate",
};

// ─────────────────────────────────────────────
// Tech-list formatting
// ─────────────────────────────────────────────

function formatTechList(stack: string[]): string {
  if (stack.length === 0) return "";
  if (stack.length === 1) return stack[0];
  if (stack.length === 2) return `${stack[0]} and ${stack[1]}`;
  const all = stack.slice(0, 3);
  return `${all.slice(0, -1).join(", ")}, and ${all[all.length - 1]}`;
}

function formatTechPair(stack: string[]): string {
  if (stack.length === 0) return "";
  if (stack.length === 1) return stack[0];
  return `${stack[0]} and ${stack[1]}`;
}

function formatModuleList(modules: string[]): string {
  if (modules.length === 0) return FALLBACKS.moduleList;
  if (modules.length === 1) return modules[0];
  if (modules.length === 2) return `${modules[0]} and ${modules[1]}`;
  return `${modules.slice(0, -1).join(", ")}, and ${modules[modules.length - 1]}`;
}

// ─────────────────────────────────────────────
// Context builder
// ─────────────────────────────────────────────

function buildContext(input: TemplateEngineInput, insight: ProjectInsight): PlaceholderContext {
  const stack = input.techStack.slice(0, 3);
  const collabs = input.collaborators ?? 1;

  // Strict anti-hallucination: only features with confidence >= 0.6 are usable.
  const confidentFeatures = (input.featureConfidence ?? [])
    .filter((f) => f.confidence >= 0.6)
    .map((f) => f.name);
  const features = insight.features.filter((feature) =>
    confidentFeatures.includes(feature.toLowerCase()) ||
    confidentFeatures.includes(feature),
  );

  const modules = insight.modules.length > 0
    ? insight.modules
    : input.modules;

  return {
    projectName:       input.projectName,
    primaryTech:       stack[0] ?? "",
    secondaryTech:     stack[1] ?? "",
    tertiaryTech:      stack[2] ?? "",
    techList:          formatTechList(stack),
    techPair:          formatTechPair(stack),
    domain:            input.domain ?? FALLBACKS.domain,
    moduleList:        formatModuleList(modules),
    collaborators:     collabs > 1 ? String(collabs) : "multiple",
    projectType:       input.projectType,
    complexity:        insight.complexity,
    architectureStyle: insight.architectureStyle,
    modules:           modules,
    features:          features,
    commitNarratives:  insight.contributionNarrative,
    techStackLower:    input.techStack.map((t) => t.toLowerCase()),
    featurePool:       features.map((f) => f.toLowerCase()),
    modulePool:        modules.map((m) => m.toLowerCase()),
    supportedFeaturePool: confidentFeatures.map((f) => f.toLowerCase()),
  };
}

// ─────────────────────────────────────────────
// Placeholder substitution
// ─────────────────────────────────────────────

function substitute(text: string, map: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => map[key] ?? `{${key}}`);
}

function hasUnresolvedPlaceholders(text: string): boolean {
  return /\{[a-zA-Z]+\}/.test(text);
}

// ─────────────────────────────────────────────
// Required-var validation
// ─────────────────────────────────────────────

function requiredVarsAvailable(
  tmpl: BulletTemplate,
  ctx: PlaceholderContext,
  moduleVal: string,
  featureVal: string,
  narrativeVal: string,
): boolean {
  const resolved: Record<string, string> = {
    projectName:       ctx.projectName,
    primaryTech:       ctx.primaryTech,
    secondaryTech:     ctx.secondaryTech,
    tertiaryTech:      ctx.tertiaryTech,
    techList:          ctx.techList,
    techPair:          ctx.techPair,
    domain:            ctx.domain,
    moduleList:        ctx.moduleList,
    collaborators:     ctx.collaborators,
    projectType:       ctx.projectType,
    complexity:        ctx.complexity,
    architectureStyle: ctx.architectureStyle,
    module:            moduleVal,
    area:              moduleVal || FALLBACKS.area,
    feature:           featureVal,
    commitFeature:     featureVal, // backward compat
    commitNarrative:   narrativeVal,
  };

  return tmpl.requiredVars.every((v) => {
    const val = resolved[v] ?? "";
    return val.trim() !== "";
  });
}

// ─────────────────────────────────────────────
// Hard validation: sentence must contain real content
// ─────────────────────────────────────────────

function passesContentValidation(sentence: string, ctx: PlaceholderContext): boolean {
  const lower = sentence.toLowerCase();

  // Must contain at least one of: tech mention, feature reference, or module reference
  const hasTech = ctx.techStackLower.some((t) => lower.includes(t));
  const hasFeature = ctx.featurePool.some((f) => {
    // Check if any significant word from the feature appears
    const words = f.split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => lower.includes(w));
  });
  const hasModule = ctx.modulePool.some((m) => lower.includes(m));

  const hasUnsupportedFeatureClaim =
    /\b(authentication|admin|dashboard|analytics|database|payment|search|realtime|notification|api)\b/i.test(
      sentence,
    ) &&
    !ctx.supportedFeaturePool.some((supported) =>
      lower.includes(supported.split(/\s+/).find((w) => w.length > 3) ?? supported),
    );

  if (hasUnsupportedFeatureClaim) return false;
  return hasTech || hasFeature || hasModule;
}

// ─────────────────────────────────────────────
// Sentence polishing
// ─────────────────────────────────────────────

function polishSentence(sentence: string): string {
  let s = sentence.trim();
  // Capitalize first letter
  s = s.charAt(0).toUpperCase() + s.slice(1);
  // Remove double spaces
  s = s.replace(/\s{2,}/g, " ");
  // Ensure no trailing comma
  s = s.replace(/,\s*$/, "");
  return s;
}

// ─────────────────────────────────────────────
// Template expansion
// ─────────────────────────────────────────────

function expandTemplate(tmpl: BulletTemplate, ctx: PlaceholderContext): string[] {
  const results: string[] = [];

  const needsModule    = tmpl.text.includes("{module}") || tmpl.text.includes("{area}");
  const needsFeature   = tmpl.text.includes("{feature}") || tmpl.text.includes("{commitFeature}");
  const needsNarrative = tmpl.text.includes("{commitNarrative}");

  // Decide expansion pools (cap at 3 each)
  const modulePool    = needsModule    ? ctx.modules.slice(0, 3)           : [""];
  const featurePool   = needsFeature   ? ctx.features.slice(0, 3)         : [""];
  const narrativePool = needsNarrative ? ctx.commitNarratives.slice(0, 3) : [""];

  // No cross-product: zip (index-matched), not cartesian
  const maxPairs = Math.max(modulePool.length, featurePool.length, narrativePool.length);

  for (let i = 0; i < maxPairs; i++) {
    const modVal  = needsModule    ? (modulePool[Math.min(i, modulePool.length - 1)]       ?? "") : "";
    const featVal = needsFeature   ? (featurePool[Math.min(i, featurePool.length - 1)]     ?? "") : "";
    const narVal  = needsNarrative ? (narrativePool[Math.min(i, narrativePool.length - 1)] ?? "") : "";

    // Skip if required expansion var missing
    if (needsModule && !modVal) break;
    if (needsFeature && !featVal) break;
    if (needsNarrative && !narVal) break;

    if (!requiredVarsAvailable(tmpl, ctx, modVal, featVal, narVal)) continue;

    const map: Record<string, string> = {
      projectName:       ctx.projectName,
      primaryTech:       ctx.primaryTech,
      secondaryTech:     ctx.secondaryTech,
      tertiaryTech:      ctx.tertiaryTech,
      techList:          ctx.techList,
      techPair:          ctx.techPair,
      domain:            ctx.domain,
      moduleList:        ctx.moduleList,
      collaborators:     ctx.collaborators,
      projectType:       ctx.projectType,
      complexity:        ctx.complexity,
      architectureStyle: ctx.architectureStyle,
      module:            modVal,
      area:              modVal || FALLBACKS.area,
      feature:           featVal,
      commitFeature:     featVal,
      commitNarrative:   narVal,
    };

    const sentence = polishSentence(substitute(tmpl.text, map));

    if (!hasUnresolvedPlaceholders(sentence) && sentence.length > 0) {
      // Hard validation: must contain real content
      if (passesContentValidation(sentence, ctx)) {
        results.push(sentence);
      }
    }
  }

  // For templates that need neither module, feature, nor narrative — generate once
  if (!needsModule && !needsFeature && !needsNarrative) {
    if (!requiredVarsAvailable(tmpl, ctx, "", "", "")) return [];
    const map: Record<string, string> = {
      projectName:       ctx.projectName,
      primaryTech:       ctx.primaryTech,
      secondaryTech:     ctx.secondaryTech,
      tertiaryTech:      ctx.tertiaryTech,
      techList:          ctx.techList,
      techPair:          ctx.techPair,
      domain:            ctx.domain,
      moduleList:        ctx.moduleList,
      collaborators:     ctx.collaborators,
      projectType:       ctx.projectType,
      complexity:        ctx.complexity,
      architectureStyle: ctx.architectureStyle,
      module:            "",
      area:              FALLBACKS.area,
      feature:           "",
      commitFeature:     "",
      commitNarrative:   "",
    };
    const sentence = polishSentence(substitute(tmpl.text, map));
    if (!hasUnresolvedPlaceholders(sentence)) {
      if (passesContentValidation(sentence, ctx)) {
        return [sentence];
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Filter applicable templates
// ─────────────────────────────────────────────

function isApplicable(tmpl: BulletTemplate, input: TemplateEngineInput): boolean {
  // Type filter
  if (tmpl.typeFilter !== "both" && tmpl.typeFilter !== input.projectType) return false;

  // Domain filter
  if (tmpl.preferredDomain && input.domain && tmpl.preferredDomain !== input.domain) {
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generate all candidate bullet sentences for a project.
 * Returns 20–150 strings; pass to rankAndSelect() to get the final 4.
 */
export function generateCandidates(input: TemplateEngineInput): string[] {
  // Build ProjectInsight from input
  const insight = buildProjectInsight(
    {
      projectName: input.projectName,
      projectType: input.projectType,
      techStack: input.techStack,
      modules: input.modules,
      domain: input.domain,
      readmeSummary: input.readmeSummary,
      commitMessages: input.commitMessages,
      contributionFiles: input.contributionFiles,
      collaborators: input.collaborators ?? 1,
      detectedFeatures: input.detectedFeatures,
      commitTypes: input.commitTypes as any,
    },
    {
      contributionNarrative: input.contributionNarrative,
      readmeFeatures: input.readmeFeatures,
      readmeMentionedTech: input.readmeMentionedTech,
      architectureStyle: input.architectureStyle,
    },
  );

  const ctx = buildContext(input, insight);
  const candidates: string[] = [];

  for (const tmpl of TEMPLATES) {
    if (!isApplicable(tmpl, input)) continue;
    const expanded = expandTemplate(tmpl, ctx);
    candidates.push(...expanded);
  }

  // Remove exact duplicates
  return [...new Set(candidates)];
}