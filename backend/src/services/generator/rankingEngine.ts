/**
 * rankingEngine.ts
 *
 * Advanced scoring, deduplication, and diversity-enforced selection engine.
 *
 * Scoring breakdown (max ~22 pts):
 *   Strong verb           +3
 *   Medium verb           +2
 *   Feature presence      +3
 *   Module mention        +2
 *   Tech stack mention    +2
 *   Domain relevance      +1
 *   Ideal length (10–20w) +2
 *   Contains project name +1
 *   Purpose clause        +2
 *   Unique starting verb  +2 (re-evaluated per selection)
 *
 * Hard reject rules:
 *   - Generic phrases ("worked on", "helped with") → -5
 *   - Missing feature AND module AND tech → REJECT
 *   - Too short (< 8 words) or too long (> 25 words) → REJECT
 *   - Repeated starting verb (already selected) → REJECT
 *
 * Deduplication:
 *   - Jaccard similarity threshold: 0.4 (aggressive)
 *   - Bigram overlap check for structural similarity
 *
 * Diversity enforcement:
 *   Final 4 bullets must fill slots:
 *     1. Feature slot — mentions a specific detected feature
 *     2. Architecture slot — describes design/structure decision
 *     3. Impact slot — describes outcome or optimization
 *     4. Flexible slot — best remaining
 *
 * Deterministic: no randomness — same input always produces same output.
 */

import type { TemplateEngineInput } from "./templateEngine";
import type { BulletSlot } from "../types/index";

// ─────────────────────────────────────────────
// Verb tiers
// ─────────────────────────────────────────────

const STRONG_VERBS = new Set([
  "architected", "engineered", "designed", "orchestrated", "containerized",
  "containerised", "hardened", "scaled", "unified", "established",
  "drove", "led", "planned",
]);

const MEDIUM_VERBS = new Set([
  "developed", "implemented", "built", "constructed", "delivered",
  "created", "integrated", "shipped", "automated", "optimized",
  "optimised", "streamlined", "deployed", "structured",
]);

const DECENT_VERBS = new Set([
  "contributed", "authored", "refined", "extended", "improved",
  "enhanced", "resolved", "refactored", "reduced", "owned",
  "connected", "secured", "coded", "programmed", "defined",
]);

const WEAK_VERBS = new Set([
  "added", "wrote", "set", "made", "used", "worked", "helped",
]);

const PENALTY_PHRASES = [
  "worked on", "helped with", "was involved", "participated in",
  "was responsible for", "assisted with", "basic", "simple",
  "built a project", "shipped system", "made a",
];

// ─────────────────────────────────────────────
// Purpose clause detection
// ─────────────────────────────────────────────

const PURPOSE_PATTERNS = [
  /\bto\s+(improve|enhance|enable|streamline|reduce|increase|support|power|handle|ensure)/i,
  /\bfor\s+(production|scalab|reliab|maintainab|secur|performan)/i,
  /\benabling\b/i,
  /\breducing\b/i,
  /\bimproving\b/i,
  /\bensuring\b/i,
  /\bwith\s+(robust|clean|comprehensive|industry|full)/i,
];

// ─────────────────────────────────────────────
// Stop words for Jaccard similarity
// ─────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "in", "on", "with", "to",
  "of", "by", "using", "from", "as", "at", "into", "through",
  "its", "their", "our", "is", "are", "was", "were", "be", "been",
  "this", "that", "these", "those", "it",
]);

// ─────────────────────────────────────────────
// Slot classification heuristics
// ─────────────────────────────────────────────

const ARCH_VERBS = new Set(["architected", "structured", "designed", "established", "defined", "planned"]);
const IMPACT_VERBS = new Set(["optimized", "optimised", "streamlined", "automated", "secured", "hardened", "resolved", "refactored", "scaled", "improved", "enhanced", "reduced", "containerized", "containerised"]);
const CONTRIBUTION_VERBS = new Set(["contributed", "drove", "led", "owned", "authored", "delivered"]);

function classifySlot(text: string, firstWord: string): BulletSlot {
  if (CONTRIBUTION_VERBS.has(firstWord) && /collaborat|team|contributor|engineer/i.test(text)) return "contribution";
  if (ARCH_VERBS.has(firstWord)) return "architecture";
  if (IMPACT_VERBS.has(firstWord)) return "impact";
  // Check for feature-heavy content
  if (/\b(authentication|dashboard|payment|search|messaging|file|email|admin|caching|monitoring|pipeline|export|geolocation|validation|notification)\b/i.test(text)) {
    return "feature";
  }
  return "flexible";
}

// ─────────────────────────────────────────────
// Sentence scorer
// ─────────────────────────────────────────────

interface ScoredCandidate {
  text: string;
  score: number;
  slot: BulletSlot;
  verb: string;
}

const CLAIMED_FEATURE_KEYWORDS = [
  "authentication",
  "admin",
  "dashboard",
  "analytics",
  "database",
  "payment",
  "search",
  "realtime",
  "notification",
  "api",
];

function hasUnsupportedFeatureClaim(
  text: string,
  supportedFeatures: string[],
): boolean {
  const lower = text.toLowerCase();
  const hasFeatureKeyword = CLAIMED_FEATURE_KEYWORDS.some((k) => lower.includes(k));
  if (!hasFeatureKeyword) return false;
  if (supportedFeatures.length === 0) return true;
  return !supportedFeatures.some((feature) => {
    const words = feature
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    return words.some((word) => lower.includes(word));
  });
}

function scoreCandidate(
  text: string,
  input: TemplateEngineInput,
): ScoredCandidate {
  let score = 0;
  const lower = text.toLowerCase();
  const words = text.split(/\s+/);
  const wordCount = words.length;
  const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const supportedFeatures = (input.featureConfidence ?? [])
    .filter((f) => f.confidence >= 0.6)
    .map((f) => f.name.toLowerCase());

  // ── Hard reject: length ──────────────────────
  if (wordCount < 8 || wordCount > 25) {
    return { text, score: -100, slot: "flexible", verb: firstWord };
  }

  // ── 1. Action verb strength ──────────────────
  if (STRONG_VERBS.has(firstWord))      score += 3;
  else if (MEDIUM_VERBS.has(firstWord)) score += 2;
  else if (DECENT_VERBS.has(firstWord)) score += 1;
  else if (WEAK_VERBS.has(firstWord))   score += 0;
  else                                  score += 0;

  // ── 2. Generic phrase penalty ────────────────
  for (const phrase of PENALTY_PHRASES) {
    if (lower.includes(phrase)) { score -= 5; break; }
  }

  // ── 3. Feature presence (+3) ────────────────
  const features = input.detectedFeatures ?? [];
  const hasFeature = features.some((f) => {
    const fWords = f.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return fWords.some((w) => lower.includes(w));
  });
  if (hasFeature) score += 3;

  // ── 4. Module mention (+2) ──────────────────
  const moduleMentioned = input.modules.some((m) =>
    lower.includes(m.toLowerCase()),
  );
  if (moduleMentioned) score += 2;

  // ── 5. Tech stack mention (+2) ──────────────
  const techMentioned = input.techStack.some((t) =>
    lower.includes(t.toLowerCase()),
  );
  if (techMentioned) score += 2;

  // ── Hard reject: no feature AND no module AND no tech ──
  if (!hasFeature && !moduleMentioned && !techMentioned) {
    return { text, score: -100, slot: "flexible", verb: firstWord };
  }

  if (hasUnsupportedFeatureClaim(text, supportedFeatures)) {
    return { text, score: -100, slot: "flexible", verb: firstWord };
  }

  // ── 6. Domain mention (+1) ──────────────────
  if (input.domain && lower.includes(input.domain.toLowerCase())) {
    score += 1;
  }

  // ── 7. Ideal length score ───────────────────
  if (wordCount >= 10 && wordCount <= 20) score += 2;
  else if (wordCount >= 8 && wordCount <= 25) score += 1;

  // ── 8. Contains project name (+1) ───────────
  if (lower.includes(input.projectName.toLowerCase())) score += 1;

  // ── 9. Purpose clause (+2) ──────────────────
  const hasPurpose = PURPOSE_PATTERNS.some((p) => p.test(text));
  if (hasPurpose) score += 2;

  // ── Classify slot ──────────────────────────
  const slot = classifySlot(text, firstWord);

  return { text, score, slot, verb: firstWord };
}

// ─────────────────────────────────────────────
// Jaccard similarity (content words only)
// ─────────────────────────────────────────────

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z]/g, ""))
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─────────────────────────────────────────────
// Bigram overlap (structural similarity)
// ─────────────────────────────────────────────

function getBigrams(text: string): Set<string> {
  const words = text.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z]/g, "")).filter(Boolean);
  const bigrams = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]}|${words[i + 1]}`);
  }
  return bigrams;
}

function bigramOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const bg of a) {
    if (b.has(bg)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─────────────────────────────────────────────
// Diversity slot enforcement
// ─────────────────────────────────────────────

type SlotTracker = {
  feature: boolean;
  architecture: boolean;
  impact: boolean;
  contribution: boolean;
  flexible: boolean;
};

function getNextNeededSlot(tracker: SlotTracker, isCollab: boolean): BulletSlot | null {
  if (!tracker.feature) return "feature";
  if (!tracker.architecture) return "architecture";
  if (!tracker.impact) return "impact";
  if (isCollab && !tracker.contribution) return "contribution";
  return null; // all essential slots filled
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Score, deduplicate, and select the top `count` bullet sentences
 * with diversity enforcement and strict deduplication.
 */
export function rankAndSelect(
  candidates: string[],
  input: TemplateEngineInput,
  count = 4,
): string[] {
  if (candidates.length === 0) return [];

  // ── Step 1: Score all candidates ────────────
  const scored: ScoredCandidate[] = candidates.map((text) =>
    scoreCandidate(text, input),
  );

  // ── Step 2: Remove hard-rejected candidates ──
  const viable = scored.filter((s) => s.score > -50);
  if (viable.length === 0) return [];

  // ── Step 3: Sort descending by score ────────
  viable.sort((a, b) => b.score - a.score);

  // ── Step 4: Slot-aware diverse selection ────
  const selected: ScoredCandidate[] = [];
  const selectedWordSets: Set<string>[] = [];
  const selectedBigrams: Set<string>[] = [];
  const usedVerbs = new Set<string>();
  const isCollab = input.projectType === "collaborative";

  const slotTracker: SlotTracker = {
    feature: false,
    architecture: false,
    impact: false,
    contribution: false,
    flexible: false,
  };

  // Pass 1: Fill required slots (feature, architecture, impact, optional contribution)
  const slotsToFill: BulletSlot[] = ["feature", "architecture", "impact"];
  if (isCollab) slotsToFill.push("contribution");

  for (const targetSlot of slotsToFill) {
    if (selected.length >= count) break;

    // Find best candidate for this slot
    for (const candidate of viable) {
      if (candidate.slot !== targetSlot && candidate.slot !== "flexible") continue;
      // If flexible, only use for target if it actually fits
      if (candidate.slot === "flexible" && targetSlot !== "flexible") {
        // Check if this flexible candidate could fill the slot
        const lower = candidate.text.toLowerCase();
        if (targetSlot === "feature" && !(input.detectedFeatures ?? []).some((f) =>
          f.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => lower.includes(w)),
        )) continue;
        if (targetSlot === "architecture" && !ARCH_VERBS.has(candidate.verb)) continue;
        if (targetSlot === "impact" && !IMPACT_VERBS.has(candidate.verb)) continue;
        if (targetSlot === "contribution" && !CONTRIBUTION_VERBS.has(candidate.verb)) continue;
      }

      // Verb uniqueness check
      if (usedVerbs.has(candidate.verb)) continue;

      // Similarity check
      const cWords = contentWords(candidate.text);
      const cBigrams = getBigrams(candidate.text);
      const tooSimilar = selectedWordSets.some(
        (ws, idx) =>
          jaccardSimilarity(cWords, ws) > 0.4 ||
          bigramOverlap(cBigrams, selectedBigrams[idx]) > 0.35,
      );
      if (tooSimilar) continue;

      // Accept this candidate
      selected.push(candidate);
      selectedWordSets.push(cWords);
      selectedBigrams.push(cBigrams);
      usedVerbs.add(candidate.verb);
      slotTracker[targetSlot] = true;
      break;
    }
  }

  // Pass 2: Fill remaining slots with best available
  for (const candidate of viable) {
    if (selected.length >= count) break;

    // Skip already selected
    if (selected.some((s) => s.text === candidate.text)) continue;

    // Verb uniqueness
    if (usedVerbs.has(candidate.verb)) continue;

    // Similarity check
    const cWords = contentWords(candidate.text);
    const cBigrams = getBigrams(candidate.text);
    const tooSimilar = selectedWordSets.some(
      (ws, idx) =>
        jaccardSimilarity(cWords, ws) > 0.4 ||
        bigramOverlap(cBigrams, selectedBigrams[idx]) > 0.35,
    );
    if (tooSimilar) continue;

    selected.push(candidate);
    selectedWordSets.push(cWords);
    selectedBigrams.push(cBigrams);
    usedVerbs.add(candidate.verb);
  }

  return selected.map((s) => s.text);
}

// ─────────────────────────────────────────────
// Debug helper (not used in production)
// ─────────────────────────────────────────────

/**
 * Returns all candidates with their scores — useful for tuning templates.
 */
export function scoreAll(
  candidates: string[],
  input: TemplateEngineInput,
): Array<{ text: string; score: number; slot: BulletSlot; verb: string }> {
  return candidates
    .map((text) => scoreCandidate(text, input))
    .sort((a, b) => b.score - a.score);
}