/**
 * utils/textUtils.ts
 *
 * Lightweight, dependency-free text utilities.
 * No external NLP packages — pure string manipulation.
 */

// ─────────────────────────────────────────────
// String manipulation
// ─────────────────────────────────────────────

/** Capitalize first letter, lowercase the rest */
export function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ensure string ends with a period */
export function ensurePeriod(s: string): string {
  if (!s) return s;
  return /[.!?]$/.test(s.trimEnd()) ? s.trimEnd() : s.trimEnd() + ".";
}

/** Truncate to maxWords, appending ellipsis if needed */
export function truncateWords(s: string, maxWords: number): string {
  const words = s.trim().split(/\s+/);
  if (words.length <= maxWords) return s.trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

/** Remove common filler phrases from experience descriptions */
export function stripFillerPhrases(text: string): string {
  const patterns = [
    /\b(I was responsible for|my duties included?|I was tasked with|in this role[,]?\s+I|as part of my role[,]?\s+I)\b/gi,
    /\b(I was involved in|I helped with|I assisted in|I supported|I participated in)\b/gi,
    /\b(I worked on|I worked with|I worked alongside)\b/gi,
    /\b(responsibilities included?|key responsibilities?|duties included?)\b/gi,
    /\b(I also|additionally[,]?\s+I|furthermore[,]?\s+I)\b/gi,
    /^(also|additionally|furthermore)[,\s]+/gi,
  ];

  let result = text;
  for (const p of patterns) {
    result = result.replace(p, "").replace(/\s{2,}/g, " ").trim();
  }
  return result;
}

/** Split text into sentences */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

/**
 * Format an experience description in a rule-based way:
 *   1. Strip filler
 *   2. Split into sentences
 *   3. Pick first 2–3 meaningful ones
 *   4. Capitalize + period-terminate each
 */
export function formatExperienceDescription(
  _role: string,
  _company: string,
  raw: string,
): string {
  if (!raw || raw.trim().length < 15) return raw?.trim() ?? "";

  const cleaned = stripFillerPhrases(raw);
  const sentences = splitSentences(cleaned);

  const selected = sentences
    .filter((s) => s.split(/\s+/).length >= 5)   // min 5 words
    .slice(0, 3);

  if (selected.length === 0) {
    // Fallback: just clean + period
    return ensurePeriod(capitalizeFirst(cleaned.slice(0, 280)));
  }

  return selected
    .map((s) => ensurePeriod(capitalizeFirst(s)))
    .join(" ");
}

// ─────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────

const SKILL_ALIASES: Record<string, string> = {
  "react.js": "React",
  reactjs: "React",
  "node.js": "Node.js",
  nodejs: "Node.js",
  "next.js": "Next.js",
  nextjs: "Next.js",
  "vue.js": "Vue.js",
  vuejs: "Vue.js",
  "express.js": "Express",
  expressjs: "Express",
  typescript: "TypeScript",
  javascript: "JavaScript",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mongodb: "MongoDB",
  "c plus plus": "C++",
  "c/c++": "C++",
  "react native": "React Native",
  kubernetes: "Kubernetes",
  tensorflow: "TensorFlow",
  pytorch: "PyTorch",
  "scikit-learn": "scikit-learn",
};

/** Normalize a raw skill name to a canonical, display-ready form */
export function normalizeSkillName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];
  // Title-case otherwise
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────
// Keyword extraction (lightweight TF)
// ─────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","for","nor","so","yet","in","on","at","to",
  "of","by","from","with","into","through","as","is","are","was","were","be",
  "been","being","have","has","had","do","does","did","will","would","could",
  "should","may","might","shall","can","this","that","these","those","it","its",
  "we","our","you","your","they","their","i","my","he","she","him","her","us",
  "also","if","then","than","when","where","which","who","how","not","no","more",
  "all","any","each","every","both","few","many","some","such","only","just",
]);

export function extractKeywords(text: string, topN = 15): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w);
}

// ─────────────────────────────────────────────
// Oxford list formatter
// ─────────────────────────────────────────────

export function oxfordList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const last = items[items.length - 1];
  return `${items.slice(0, -1).join(", ")}, and ${last}`;
}