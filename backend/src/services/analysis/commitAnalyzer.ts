/**
 * analysis/commitAnalyzer.ts
 *
 * Offline, rule-based commit message analysis with deep feature extraction.
 *
 * Responsibilities:
 *   1. Parse conventional commit prefixes (feat, fix, refactor, …)
 *   2. Extract human-readable feature strings from subject lines
 *   3. Detect high-level capability areas (auth, payment, search, …)
 *   4. Extract verb-phrase contribution narratives for bullet use
 *   5. Group related commits into feature clusters
 *   6. Produce a CommitAnalysis used downstream by the template engine
 */

import type { CommitAnalysis, CommitType } from "../types/index";

// ─────────────────────────────────────────────
// Conventional commit prefix map
// ─────────────────────────────────────────────

const COMMIT_TYPE_MAP: Record<string, CommitType> = {
  feat:     "feat",
  feature:  "feat",
  fix:      "fix",
  bugfix:   "fix",
  hotfix:   "fix",
  refactor: "refactor",
  perf:     "perf",
  optimize: "perf",
  optimise: "perf",
  test:     "test",
  tests:    "test",
  spec:     "test",
  docs:     "docs",
  doc:      "docs",
  readme:   "docs",
  chore:    "chore",
  build:    "build",
  ci:       "ci",
  style:    "style",
  lint:     "style",
  format:   "style",
};

// ─────────────────────────────────────────────
// Feature detection rules
// ─────────────────────────────────────────────

type FeatureRule = { pattern: RegExp; label: string };

const FEATURE_RULES: FeatureRule[] = [
  { pattern: /\b(auth|login|logout|signin|signup|register|password|jwt|oauth|session|token|2fa|mfa)\b/i,      label: "Authentication" },
  { pattern: /\b(dashboard|analytics|chart|graph|report|metric|stat|kpi|insight)\b/i,                         label: "Dashboard & Analytics" },
  { pattern: /\b(payment|stripe|checkout|billing|invoice|subscription|pricing|cart|order)\b/i,                label: "Payments" },
  { pattern: /\b(search|filter|query|autocomplete|elasticsearch|fuzzy|facet)\b/i,                             label: "Search & Filtering" },
  { pattern: /\b(chat|message|inbox|thread|conversation|socket|websocket|realtime|notification|push)\b/i,     label: "Messaging & Realtime" },
  { pattern: /\b(upload|download|file|attachment|storage|s3|bucket|media|image|video|blob)\b/i,               label: "File Management" },
  { pattern: /\b(email|smtp|sendgrid|mailgun|ses|newsletter|template|notification)\b/i,                        label: "Email & Notifications" },
  { pattern: /\b(admin|panel|cms|management|backoffice|role|permission|rbac|acl)\b/i,                         label: "Admin & RBAC" },
  { pattern: /\b(api|endpoint|route|rest|graphql|webhook|grpc|swagger|openapi)\b/i,                           label: "API Layer" },
  { pattern: /\b(database|migration|schema|seed|model|orm|sql|index|relation)\b/i,                            label: "Database" },
  { pattern: /\b(test|spec|unit|integration|e2e|coverage|mock|stub|fixture)\b/i,                              label: "Testing" },
  { pattern: /\b(docker|container|kubernetes|helm|deploy|ci|cd|pipeline|action|workflow|build)\b/i,           label: "DevOps & CI/CD" },
  { pattern: /\b(cache|redis|memcache|ttl|invalidat|cdn)\b/i,                                                 label: "Caching" },
  { pattern: /\b(profile|user|account|setting|preference|onboard)\b/i,                                        label: "User Management" },
  { pattern: /\b(ml|model|train|predict|infer|nlp|classification|embedding|vector)\b/i,                       label: "ML/AI" },
  { pattern: /\b(log|monitor|trace|alert|sentry|datadog|observ|health|metric)\b/i,                            label: "Monitoring & Logging" },
  { pattern: /\b(export|import|csv|json|pdf|excel|report|generate|format)\b/i,                                label: "Data Export/Import" },
  { pattern: /\b(map|geo|location|coordinate|gps|distance|address|geocode)\b/i,                               label: "Geolocation" },
  { pattern: /\b(form|validation|input|sanitiz|schema)\b/i,                                                   label: "Form Validation" },
  { pattern: /\b(responsive|layout|component|ui|style|theme|design)\b/i,                                      label: "UI Components" },
  { pattern: /\b(middleware|guard|interceptor|pipe|decorator)\b/i,                                             label: "Middleware" },
  { pattern: /\b(pagination|infinite|cursor|offset|lazy)\b/i,                                                 label: "Pagination" },
  { pattern: /\b(cron|scheduler|queue|job|worker|background|bull)\b/i,                                        label: "Background Jobs" },
];

// ─────────────────────────────────────────────
// Noise patterns to completely skip
// ─────────────────────────────────────────────

const NOISE_PATTERNS = [
  /^(wip|WIP):?\s*/,
  /^(temp|tmp):?\s*/i,
  /^merge\s+(pull\s+request|branch|remote)/i,
  /^revert\s+/i,
  /^bump\s+version/i,
  /^initial\s+commit$/i,
  /^\d+\.\d+\.\d+/,         // version tags
  /^update\s+readme/i,
  /^update\s+package/i,
  /^update\s+dependencies/i,
  /^minor\s+(fix|update|change)/i,
  /^typo/i,
  /^formatting/i,
  /^cleanup/i,
  /^clean\s+up/i,
  /^remove\s+unused/i,
  /^fix\s+typo/i,
  /^fix\s+lint/i,
  /^prettier/i,
  /^eslint/i,
];

// ─────────────────────────────────────────────
// Verb-phrase extraction patterns
// ─────────────────────────────────────────────

const VERB_PHRASE_PATTERNS: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray) => string }> = [
  // "implemented JWT authentication" → "JWT authentication"
  { pattern: /^(?:implement|add|create|build|develop|introduce|set\s+up)\s+(.+)/i, extract: (m) => m[1] },
  // "feat: user profile page" → "user profile page"
  { pattern: /^(?:feat|feature)(?:\([^)]*\))?:\s*(.+)/i, extract: (m) => m[1] },
  // "add: search functionality" → "search functionality"
  { pattern: /^(?:add|implement)(?:\([^)]*\))?:\s*(.+)/i, extract: (m) => m[1] },
  // "fix: login redirect issue" → "login redirect fix"
  { pattern: /^(?:fix|resolve|patch)(?:\([^)]*\))?:?\s*(.+)/i, extract: (m) => m[1] + " fix" },
  // "refactor: database queries" → "database query optimization"
  { pattern: /^(?:refactor|optimize|improve)(?:\([^)]*\))?:?\s*(.+)/i, extract: (m) => m[1] + " optimization" },
];

// Words that indicate a substantive commit subject (not just chore)
const SUBSTANTIVE_WORDS = /\b(auth|api|database|user|payment|search|dashboard|chat|upload|notification|test|deploy|cache|profile|admin|middleware|route|component|service|model|schema|controller|module|feature|page|form|validation|security|performance|query|filter|config|session|token|email|file|export|import|report|analytics|monitor|webhook|socket|integration)\b/i;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseSubject(raw: string): { type: CommitType; subject: string } | null {
  const firstLine = raw.split("\n")[0].trim();
  if (!firstLine || firstLine.length < 3) return null;

  // Check for noise
  for (const noise of NOISE_PATTERNS) {
    if (noise.test(firstLine)) return null;
  }

  // Try conventional commit: "type(scope): description"
  const conventionalMatch = firstLine.match(
    /^([a-z]+)(?:\([^)]*\))?!?:\s*(.+)$/i,
  );

  if (conventionalMatch) {
    const rawType = conventionalMatch[1].toLowerCase();
    const commitType: CommitType = COMMIT_TYPE_MAP[rawType] ?? "other";
    const subject = conventionalMatch[2].trim();
    return { type: commitType, subject };
  }

  // Non-conventional — classify from leading verb
  let commitType: CommitType = "other";
  if (/^(add|implement|create|build|introduce|feat)/i.test(firstLine)) commitType = "feat";
  else if (/^(fix|resolve|patch|correct|bug)/i.test(firstLine)) commitType = "fix";
  else if (/^(refactor|clean|restructure|reorganize|extract)/i.test(firstLine)) commitType = "refactor";
  else if (/^(optimiz|optimis|improv|boost|speed|perf)/i.test(firstLine)) commitType = "perf";
  else if (/^(test|spec|coverage)/i.test(firstLine)) commitType = "test";
  else if (/^(doc|readme|comment)/i.test(firstLine)) commitType = "docs";
  else if (/^(style|lint|format)/i.test(firstLine)) commitType = "style";
  else if (/^(deploy|release|publish|build)/i.test(firstLine)) commitType = "build";

  return { type: commitType, subject: firstLine };
}

function detectFeatures(text: string): string[] {
  const found = new Set<string>();
  for (const rule of FEATURE_RULES) {
    if (rule.pattern.test(text)) found.add(rule.label);
  }
  return [...found];
}

/**
 * Extract high-signal verb phrases from commit messages.
 * These become usable in bullet templates as {commitNarrative}.
 */
function extractNarrativePhrases(subjects: string[], rawMessages: string[]): string[] {
  const phrases = new Set<string>();
  const seenNormalized = new Set<string>();

  for (const msg of rawMessages) {
    const firstLine = msg.split("\n")[0].trim();
    if (!firstLine || firstLine.length < 8) continue;

    // Skip noise
    let isNoise = false;
    for (const noise of NOISE_PATTERNS) {
      if (noise.test(firstLine)) { isNoise = true; break; }
    }
    if (isNoise) continue;

    // Try verb-phrase extraction
    for (const { pattern, extract } of VERB_PHRASE_PATTERNS) {
      const match = firstLine.match(pattern);
      if (match) {
        let phrase = extract(match)
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .trim()
          .toLowerCase();

        // Must contain a substantive word
        if (!SUBSTANTIVE_WORDS.test(phrase)) continue;

        // Clean up and capitalize
        const words = phrase.split(/\s+/).filter((w) => w.length > 1);
        if (words.length < 2 || words.length > 8) continue;

        phrase = words.join(" ");
        const normalized = words.sort().join(",");

        if (!seenNormalized.has(normalized)) {
          seenNormalized.add(normalized);
          phrases.add(phrase);
        }
        break; // take first match per message
      }
    }
  }

  // Return top 3 most informative phrases
  return [...phrases]
    .sort((a, b) => {
      // Prefer longer (more specific) phrases
      const aWords = a.split(/\s+/).length;
      const bWords = b.split(/\s+/).length;
      return bWords - aWords;
    })
    .slice(0, 3);
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export function analyzeCommits(rawMessages: string[]): CommitAnalysis {
  const commitTypes: Partial<Record<CommitType, number>> = {};
  const subjects: string[] = [];
  const featureSet = new Set<string>();

  for (const msg of rawMessages) {
    const parsed = parseSubject(msg);
    if (!parsed) continue;

    commitTypes[parsed.type] = (commitTypes[parsed.type] ?? 0) + 1;
    subjects.push(parsed.subject);

    for (const feat of detectFeatures(parsed.subject)) {
      featureSet.add(feat);
    }
  }

  // Extract narrative phrases for bullet templates
  const contributionNarrative = extractNarrativePhrases(subjects, rawMessages);

  // Limit detected features to top 5 (most signal-rich)
  const detectedFeatures = [...featureSet].slice(0, 5);

  return {
    commitTypes,
    detectedFeatures,
    subjects,
    contributionNarrative,
  };
}

/**
 * Quick helper: get a human-readable description of a commit type
 * for use in bullet templates.
 */
export function commitTypeVerb(type: CommitType): string {
  const verbs: Record<CommitType, string> = {
    feat:     "developed",
    fix:      "resolved",
    refactor: "refactored",
    perf:     "optimized",
    test:     "tested",
    docs:     "documented",
    chore:    "maintained",
    build:    "built",
    ci:       "automated",
    style:    "formatted",
    other:    "implemented",
  };
  return verbs[type] ?? "implemented";
}