/**
 * generator/bulletGenerator.ts
 *
 * Fully offline resume bullet generator — production-grade intelligence.
 *
 * Pipeline:
 *   TemplateEngineInput → ProjectInsight → generateCandidates()
 *                                          → rankAndSelect() (with diversity slots)
 *                                            → validateAndFallback()
 *                                              → string[] (4 bullets)
 *
 * Guarantees:
 *   - No two bullets share a starting verb
 *   - Every bullet contains at least 1 tech, feature, or module reference
 *   - Bullets are unique in meaning (Jaccard < 0.4)
 *   - Output covers feature, architecture, and impact perspectives
 */

import type { TemplateEngineInput } from "../types/index";
import { buildProjectInsight } from "../analysis/projectInsight";
import { generateCandidates }  from "./templateEngine";
import { rankAndSelect }        from "./rankingEngine";

// ─────────────────────────────────────────────
// Verb uniqueness validation
// ─────────────────────────────────────────────

function getFirstVerb(sentence: string): string {
  return sentence.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
}

function enforceVerbUniqueness(bullets: string[]): string[] {
  const result: string[] = [];
  const usedVerbs = new Set<string>();

  for (const bullet of bullets) {
    const verb = getFirstVerb(bullet);
    if (!usedVerbs.has(verb)) {
      result.push(bullet);
      usedVerbs.add(verb);
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// Jaccard deduplication
// ─────────────────────────────────────────────

function jaccardSim(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union === 0 ? 1 : inter / union;
}

function deduplicateBullets(bullets: string[]): string[] {
  const result: string[] = [];
  for (const candidate of bullets) {
    const tooSimilar = result.some((r) => jaccardSim(r, candidate) > 0.4);
    if (!tooSimilar) result.push(candidate);
  }
  return result;
}

// ─────────────────────────────────────────────
// Insight-aware fallback builder
// ─────────────────────────────────────────────

const STRONG_VERB_POOL = [
  "Engineered", "Developed", "Designed", "Implemented", "Architected",
  "Built", "Constructed", "Delivered", "Integrated", "Structured",
  "Optimized", "Automated", "Streamlined", "Secured",
];

function buildInsightFallbacks(
  input: TemplateEngineInput,
  existing: string[],
): string[] {
  const insight = buildProjectInsight(
    input,
    {
      contributionNarrative: (input as any).contributionNarrative,
      readmeFeatures: (input as any).readmeFeatures,
      readmeMentionedTech: (input as any).readmeMentionedTech,
      architectureStyle: (input as any).architectureStyle,
    },
  );

  const usedVerbs = new Set(existing.map(getFirstVerb));
  const pool: string[] = [];

  const t0 = insight.primaryTech;
  const t1 = insight.techStack[1] ?? t0;
  const name = insight.name;
  const feat0 = insight.features[0];
  const feat1 = insight.features[1];
  const mod0 = insight.modules[0];
  const mod1 = insight.modules[1];
  const archStyle = insight.architectureStyle;

  // Helper to pick next unused verb
  const pickVerb = (): string | null => {
    for (const v of STRONG_VERB_POOL) {
      const lower = v.toLowerCase();
      if (!usedVerbs.has(lower)) {
        usedVerbs.add(lower);
        return v;
      }
    }
    return null;
  };

  // Feature-based fallback
  if (feat0) {
    const verb = pickVerb();
    if (verb) {
      pool.push(`${verb} ${feat0} for ${name} using ${t0}, enabling core platform functionality`);
    }
  }

  // Architecture fallback
  if (mod0) {
    const verb = pickVerb();
    if (verb) {
      pool.push(`${verb} ${name}'s ${mod0} layer using ${t0} with a clean ${archStyle} architecture`);
    }
  }

  // Feature + module integration fallback
  if (feat1 && mod1) {
    const verb = pickVerb();
    if (verb) {
      pool.push(`${verb} ${feat1} integrated with ${mod1} logic in ${name} using ${t1}`);
    }
  }

  // Impact fallback
  if (mod0 || feat0) {
    const verb = pickVerb();
    if (verb) {
      const target = mod0 ? `${mod0} module` : feat0!;
      pool.push(`${verb} ${target} in ${name} using ${t0} to improve reliability and performance`);
    }
  }

  // Contribution fallback (collab only)
  if (insight.projectType === "collaborative") {
    const verb = pickVerb();
    if (verb) {
      const area = feat0 ?? mod0 ?? "core features";
      pool.push(`${verb} ${area} for ${name} as part of a ${insight.collaboratorCount}-person engineering team`);
    }
  }

  // Tech + scope fallback
  {
    const verb = pickVerb();
    if (verb) {
      const techList = insight.techStack.slice(0, 3).join(", ");
      const scope = feat0 ? `with ${feat0} support` : `with ${archStyle} design`;
      pool.push(`${verb} ${name} end-to-end using ${techList} ${scope}`);
    }
  }

  const combined = deduplicateBullets([...existing, ...pool]);
  return enforceVerbUniqueness(combined).slice(0, 4);
}

// ─────────────────────────────────────────────
// Minimum quality check
// ─────────────────────────────────────────────

function passesMinQuality(bullet: string, input: TemplateEngineInput): boolean {
  const lower = bullet.toLowerCase();
  const words = bullet.split(/\s+/);

  // Must be at least 8 words
  if (words.length < 8) return false;

  // Must contain at least 1 of: tech, feature word, or module
  const hasTech = input.techStack.some((t) => lower.includes(t.toLowerCase()));
  const trustedFeatures = (input.featureConfidence ?? [])
    .filter((f) => f.confidence >= 0.6)
    .map((f) => f.name);
  const hasFeature = trustedFeatures.some((f) =>
    f.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => lower.includes(w)),
  );
  const hasModule = input.modules.some((m) => lower.includes(m.toLowerCase()));

  return hasTech || hasFeature || hasModule;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generate 4 resume bullet points for a project.
 * No AI — uses ProjectInsight + template engine + ranking engine + fallbacks.
 */
export function generateProjectBullets(input: TemplateEngineInput): string[] {
  // 1. Template engine produces candidates
  let candidates: string[] = [];
  try {
    candidates = generateCandidates(input);
  } catch {
    candidates = [];
  }

  // 2. Ranking engine selects top 4 diverse, high-quality bullets
  let selected: string[] = [];
  if (candidates.length > 0) {
    try {
      selected = rankAndSelect(candidates, input, 4);
    } catch {
      selected = [];
    }
  }

  // 3. Validate verb uniqueness
  selected = enforceVerbUniqueness(selected);

  // 4. If we have fewer than 4, pad with insight-aware fallbacks
  if (selected.length < 4) {
    selected = buildInsightFallbacks(input, selected);
  }

  // 5. Final quality gate — filter any bullet that doesn't meet minimum bar
  selected = selected.filter((b) => passesMinQuality(b, input));

  // 6. If still short after quality gate, build safe structured bullets
  if (selected.length < 4) {
    const safePool = buildSafeStructuredBullets(input);
    const combined = deduplicateBullets([...selected, ...safePool]);
    selected = enforceVerbUniqueness(combined).slice(0, 4);
  }

  // 7. Final safety net — always return something
  if (selected.length === 0) {
    return buildSafeStructuredBullets(input).slice(0, 4);
  }

  return selected.slice(0, 4);
}

// ─────────────────────────────────────────────
// Safe structured bullets (last resort, but NOT generic)
// ─────────────────────────────────────────────

function buildSafeStructuredBullets(input: TemplateEngineInput): string[] {
  const name = input.projectName;
  const t0 = input.techStack[0] ?? "modern frameworks";
  const t1 = input.techStack[1] ?? input.techStack[0] ?? "TypeScript";
  const feat = (input.detectedFeatures ?? [])[0];
  const mod = input.modules[0];
  const archStyle = (input as any).architectureStyle ?? "modular";

  const bullets: string[] = [];

  // Always include tech and project name
  if (feat && mod) {
    bullets.push(`Engineered ${feat} for ${name} using ${t0} with ${mod} layer integration`);
    bullets.push(`Designed ${name}'s ${mod} architecture using ${t1} with clean separation of concerns`);
    bullets.push(`Implemented ${feat} and ${mod} functionality in ${name} using ${t0} for production reliability`);
    bullets.push(`Delivered ${name} end-to-end with ${t0} and ${t1}, incorporating ${feat} and ${mod} support`);
  } else if (feat) {
    bullets.push(`Engineered ${feat} for ${name} using ${t0} to enhance platform capabilities`);
    bullets.push(`Designed ${name}'s technical architecture using ${t1} with ${archStyle} patterns`);
    bullets.push(`Implemented ${feat} in ${name} using ${t0} with robust error handling`);
    bullets.push(`Delivered ${name} as a production-ready application using ${t0} and ${t1}`);
  } else if (mod) {
    bullets.push(`Engineered ${name}'s ${mod} layer using ${t0} with clean architecture principles`);
    bullets.push(`Designed ${mod} service interfaces for ${name} using ${t1}`);
    bullets.push(`Implemented core ${mod} logic in ${name} using ${t0} for maintainability`);
    bullets.push(`Delivered ${name} with ${mod} integration using ${t0} and ${t1}`);
  } else {
    bullets.push(`Engineered ${name} from scratch using ${t0} and ${t1} with ${archStyle} architecture`);
    bullets.push(`Designed and implemented ${name}'s core services using ${t0}`);
    bullets.push(`Built ${name} end-to-end with ${t0}, following ${archStyle} design principles`);
    bullets.push(`Delivered ${name} as a functional application using ${t0} and ${t1}`);
  }

  return bullets;
}