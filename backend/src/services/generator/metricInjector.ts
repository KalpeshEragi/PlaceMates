/**
 * generator/metricInjector.ts
 *
 * Offline, deterministic metric injection.
 * Parses quiz answers and replaces placeholder tokens in base bullets.
 *
 * Placeholders supported:
 *   [X]%          → percentage improvement
 *   [X]ms / [Y]ms → latency values
 *   [N] users     → usage scale
 *   [X]           → generic numeric
 */

import { prisma } from "../../lib/prisma";
import type { QuizAnswers } from "../types/index";

/** Normalize legacy controller keys (improvement / reduction / users) and merge into QuizAnswers. */
export function normalizeQuizAnswers(raw: Record<string, unknown>): QuizAnswers {
  const improvements =
    (typeof raw.improvements === "string" ? raw.improvements : null) ??
    (typeof raw.improvement === "string" ? raw.improvement : "") ??
    "";
  const reductions =
    (typeof raw.reductions === "string" ? raw.reductions : null) ??
    (typeof raw.reduction === "string" ? raw.reduction : "") ??
    "";
  const usageScale =
    (typeof raw.usageScale === "string" ? raw.usageScale : null) ??
    (typeof raw.users === "string" ? raw.users : "") ??
    "";
  const additionalContext =
    typeof raw.additionalContext === "string" ? raw.additionalContext : undefined;
  return { improvements, reductions, usageScale, additionalContext };
}

/**
 * Apply metric placeholder replacement to an in-memory bullet list (no DB).
 */
export function applyMetricsToBulletStrings(
  baseBullets: string[],
  answers: QuizAnswers,
): string[] {
  const improvementText = answers.improvements ?? "";
  const reductionText = answers.reductions ?? "";
  const scaleText = answers.usageScale ?? "";
  const extraText = answers.additionalContext ?? "";

  const allText = [improvementText, reductionText, extraText].join(" ");

  const percentages = extractMetrics(improvementText).filter((m) => m.unit === "%");
  const latency = extractLatencyPair(reductionText);
  const scale = extractScale(scaleText);
  const generic = extractMetrics(allText);

  return baseBullets.map((bullet) => {
    if (!hasPlaceholders(bullet)) return bullet;
    return injectIntoBullet(bullet, percentages, latency, scale, generic);
  });
}

// ─────────────────────────────────────────────
// Extraction helpers
// ─────────────────────────────────────────────

type ExtractedMetric = {
  raw: string;      // e.g. "40%"
  numeric: number;
  unit: string;     // "%", "ms", "s", "k", ""
  context: string;  // "reduced load time by 40%" — the surrounding text
};

/** Extract all numeric values with optional units from a string */
function extractMetrics(text: string): ExtractedMetric[] {
  const results: ExtractedMetric[] = [];
  if (!text?.trim()) return results;

  // Pattern: optional digit separator, number, optional decimal, optional unit
  const pattern = /(\d[\d,]*(?:\.\d+)?)\s*(%|ms|s\b|k\b|x\b|times?)?/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0].trim();
    const numStr = match[1].replace(/,/g, "");
    const unit = (match[2] ?? "").toLowerCase();
    const numeric = parseFloat(numStr);
    if (isNaN(numeric)) continue;

    results.push({ raw, numeric, unit, context: text });
  }

  return results;
}

/** Extract two latency values for "from X to Y" patterns */
function extractLatencyPair(text: string): { from: string; to: string } | null {
  const pattern = /from\s+(\d[\d,.]*\s*m?s)\s+to\s+(\d[\d,.]*\s*m?s)/i;
  const match = text.match(pattern);
  if (!match) return null;
  return { from: match[1].trim(), to: match[2].trim() };
}

/** Extract scale values: "500+ users", "1k students", "over 2000 people" */
function extractScale(text: string): string | null {
  if (!text?.trim()) return null;

  const patterns = [
    /(?:over|more than|~|about|approximately)?\s*(\d[\d,.]*[k]?)\+?\s*(users?|students?|people|customers?|developers?|teams?|companies?|clients?|requests?|concurrent)/i,
    /(\d[\d,.]*[k]?)\s*\+\s*(users?|students?|people|customers?)/i,
    /(\d[\d,.]*)\s*(?:daily\s+)?(users?|students?|downloads?|installs?)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const num = m[1];
      const noun = m[2]?.toLowerCase() ?? "users";
      return `${num} ${noun}`;
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// Placeholder replacement engine
// ─────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /\[X\]%/g,
  /\[X\]ms/g,
  /\[Y\]ms/g,
  /\[X\]x/g,
  /\[N\]\s*users?/gi,
  /\[N\]\s*students?/gi,
  /\[N\]\s*people/gi,
  /\[N\]\s*customers?/gi,
  /\[X\]/g,
  /\[Y\]/g,
  /\[N\]/g,
];

function hasPlaceholders(bullet: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(bullet);
  });
}

/**
 * Inject metrics from quiz answers into a single bullet.
 * Leaves remaining placeholders if no matching value found.
 */
function injectIntoBullet(
  bullet: string,
  percentages: ExtractedMetric[],
  latency: { from: string; to: string } | null,
  scale: string | null,
  generic: ExtractedMetric[],
): string {
  let result = bullet;
  const lower = bullet.toLowerCase();

  // ── Percentage placeholder ───────────────────
  if (/\[X\]%/.test(result) && percentages.length > 0) {
    result = result.replace(/\[X\]%/, `${percentages[0].numeric}%`);
  }

  // ── Latency: [X]ms and [Y]ms ─────────────────
  if (latency) {
    if (/\[X\]ms/.test(result) && /\[Y\]ms/.test(result)) {
      result = result
        .replace(/\[X\]ms/, latency.from)
        .replace(/\[Y\]ms/, latency.to);
    } else if (/\[X\]ms/.test(result)) {
      // Just replace the "before" value
      result = result.replace(/\[X\]ms/, latency.from);
    }
  } else {
    // No latency pair — try single ms metric
    const msMetric = generic.find((m) => m.unit === "ms");
    if (msMetric) {
      result = result.replace(/\[X\]ms/, `${msMetric.numeric}ms`);
    }
  }

  // ── User scale placeholder ───────────────────
  if (/\[N\]\s*(users?|students?|people|customers?)/gi.test(result) && scale) {
    result = result.replace(/\[N\]\s*(users?|students?|people|customers?)/gi, scale);
  } else if (/\[N\]/g.test(result) && scale) {
    result = result.replace(/\[N\]/g, scale.split(" ")[0]); // just the number
  }

  // ── Generic [X] / [Y] ────────────────────────
  const remaining = generic.filter((m) => m.unit !== "ms");
  if (/\[X\]/.test(result) && remaining.length > 0) {
    result = result.replace(/\[X\]/, String(remaining[0].numeric));
  }
  if (/\[Y\]/.test(result) && remaining.length > 1) {
    result = result.replace(/\[Y\]/, String(remaining[1].numeric));
  }

  // ── Multiplier [X]x ─────────────────────────
  const multiplier = generic.find((m) => m.unit === "x");
  if (/\[X\]x/.test(result) && multiplier) {
    result = result.replace(/\[X\]x/, `${multiplier.numeric}x`);
  }

  return result;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export async function injectMetricsIntoBullets(
  projectId: string,
  userId: string,
  answers: QuizAnswers | Record<string, unknown>,
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { userId: true, baseBullets: true, finalBullets: true },
  });

  if (!project || project.userId !== userId) {
    throw new Error("Project not found or access denied.");
  }

  const baseBullets = project.baseBullets as string[];
  const normalized = normalizeQuizAnswers(answers as Record<string, unknown>);
  const finalBullets = applyMetricsToBulletStrings(baseBullets, normalized);

  // Persist
  await prisma.project.update({
    where: { id: projectId },
    data:  { finalBullets, updatedAt: new Date() },
  });

  return finalBullets;
}