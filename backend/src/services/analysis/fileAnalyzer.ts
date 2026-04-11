/**
 * analysis/fileAnalyzer.ts
 *
 * Detects architectural modules, feature areas, and architecture style
 * from file paths. Fully rule-based, no dependencies beyond core Node types.
 */

import type { FileAnalysis } from "../types/index";

// ─────────────────────────────────────────────
// Module detection rules
// ─────────────────────────────────────────────

type Rule = [RegExp, string];

const MODULE_RULES: Rule[] = [
  [/\/(auth|login|logout|session|jwt|oauth|token|password|credential)/i, "Auth"],
  [/\/(api|route|router|controller|handler|endpoint|resolver)/i,         "API"],
  [/\/(component|view|page|screen|layout|ui|frontend|client)/i,          "UI"],
  [/\/(db|database|migration|model|schema|entity|prisma|orm|seed|query)/i, "Database"],
  [/\/(test|spec|__test__|__tests__|e2e|integration|unit|fixture|mock)/i,  "Testing"],
  [/\/(docker|ci|\.github\/workflows|deploy|infra|terraform|k8s|helm|action)/i, "DevOps"],
  [/\/(worker|queue|job|cron|task|scheduler|background)/i,               "Background Jobs"],
  [/\/(socket|websocket|realtime|live|stream|pubsub)/i,                  "Realtime"],
  [/\/(ml|model|train|infer|predict|dataset|notebook|embedding)/i,       "ML/AI"],
  [/\/(cache|redis|memcache|session)/i,                                   "Caching"],
  [/\/(email|mail|smtp|notification|push|sms|sendgrid)/i,                "Notifications"],
  [/\/(upload|storage|file|media|s3|blob|bucket)/i,                      "File Storage"],
  [/\/(payment|stripe|billing|subscription|invoice|checkout)/i,          "Payments"],
  [/\/(search|elastic|index|filter|query)/i,                              "Search"],
  [/\/(admin|dashboard|panel|backoffice|management)/i,                   "Admin"],
  [/\/(middleware|guard|interceptor|pipe|filter|decorator)/i,             "Middleware"],
  [/\/(config|env|settings|constants|config\.ts|\.env)/i,                "Config"],
  [/\/(log|logger|monitor|trace|metric|telemetry)/i,                     "Monitoring"],
  [/\/(util|helper|lib|common|shared|core)/i,                            "Utilities"],
  [/\/(service|services)/i,                                               "Service Layer"],
  [/\/(store|redux|zustand|state|context)/i,                             "State Management"],
  [/\/(hook|hooks|use[A-Z])/i,                                          "Custom Hooks"],
];

// ─────────────────────────────────────────────
// Feature detection rules (from file paths)
// ─────────────────────────────────────────────

const FEATURE_RULES: Rule[] = [
  [/\/(auth|login|signup|oauth|jwt|session)/i,         "Authentication"],
  [/\/(dashboard|analytic|chart|report|stat|metric)/i, "Dashboard & Analytics"],
  [/\/(payment|stripe|billing|invoice|checkout)/i,     "Payments"],
  [/\/(search|filter|elastic|facet)/i,                 "Search & Filtering"],
  [/\/(chat|message|socket|websocket|realtime|notify)/i, "Messaging & Realtime"],
  [/\/(upload|file|storage|media|s3|blob)/i,           "File Management"],
  [/\/(email|mail|smtp|sendgrid|mailgun)/i,             "Email & Notifications"],
  [/\/(admin|cms|panel|role|permission|rbac)/i,         "Admin & RBAC"],
  [/\/(test|spec|e2e|unit|integration)/i,               "Testing"],
  [/\/(docker|ci|deploy|pipeline|action|workflow)/i,    "DevOps & CI/CD"],
  [/\/(cache|redis)/i,                                  "Caching"],
  [/\/(user|profile|account|onboard)/i,                 "User Management"],
  [/\/(ml|model|train|predict|embed)/i,                 "ML/AI"],
  [/\/(export|import|csv|pdf|excel|report)/i,           "Data Export/Import"],
  [/\/(map|geo|location|coordinate|gps)/i,              "Geolocation"],
  [/\/(form|validation|input)/i,                        "Form Handling"],
  [/\/(i18n|locale|translation|lang)/i,                 "Internationalization"],
  [/\/(cron|scheduler|queue|job|worker)/i,              "Background Processing"],
];

// ─────────────────────────────────────────────
// Architecture style detection
// ─────────────────────────────────────────────

type ArchRule = { patterns: RegExp[]; style: string; weight: number };

const ARCH_RULES: ArchRule[] = [
  // MVC pattern
  {
    patterns: [/\/(model|models)\//i, /\/(view|views)\//i, /\/(controller|controllers)\//i],
    style: "MVC",
    weight: 3,
  },
  // Service-layer / Clean architecture
  {
    patterns: [/\/(service|services)\//i, /\/(controller|controllers)\//i, /\/(route|routes)\//i],
    style: "service-oriented layered",
    weight: 3,
  },
  // Microservices
  {
    patterns: [/\/(gateway|api-gateway)\//i],
    style: "microservice",
    weight: 4,
  },
  // Next.js / Pages-based routing
  {
    patterns: [/\/pages\//i, /\/app\//i],
    style: "file-based routing",
    weight: 2,
  },
  // Domain-driven design
  {
    patterns: [/\/domain\//i, /\/infrastructure\//i, /\/application\//i],
    style: "domain-driven",
    weight: 3,
  },
  // Feature-based / Module-first
  {
    patterns: [/\/features?\//i, /\/modules?\//i],
    style: "feature-modular",
    weight: 2,
  },
  // Monorepo
  {
    patterns: [/\/packages\//i, /\/apps\//i],
    style: "monorepo",
    weight: 2,
  },
  // Component-driven (frontend)
  {
    patterns: [/\/components\//i, /\/hooks?\//i, /\/layouts?\//i],
    style: "component-driven",
    weight: 1,
  },
];

function detectArchitectureStyle(filePaths: string[]): string {
  const scores: Record<string, number> = {};

  for (const filePath of filePaths) {
    const normalized = "/" + filePath.replace(/\\/g, "/");

    for (const rule of ARCH_RULES) {
      const matchCount = rule.patterns.filter((p) => p.test(normalized)).length;
      if (matchCount > 0) {
        scores[rule.style] = (scores[rule.style] ?? 0) + matchCount * rule.weight;
      }
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "modular";
}

// ─────────────────────────────────────────────
// Tech stack hints from file extensions/names
// ─────────────────────────────────────────────

const EXTENSION_TECH: [RegExp, string][] = [
  [/\.tsx?$/, "TypeScript"],
  [/\.jsx?$/, "JavaScript"],
  [/\.py$/,   "Python"],
  [/\.go$/,   "Go"],
  [/\.rs$/,   "Rust"],
  [/\.java$/, "Java"],
  [/\.kt$/,   "Kotlin"],
  [/\.swift$/,"Swift"],
  [/\.dart$/, "Dart"],
  [/\.rb$/,   "Ruby"],
  [/\.php$/,  "PHP"],
  [/\.cs$/,   "C#"],
  [/\.cpp$|\.cc$|\.cxx$/, "C++"],
  [/\.c$/,    "C"],
  [/\.html?$/,"HTML"],
  [/\.scss$|\.sass$/, "SCSS"],
  [/\.css$/,  "CSS"],
  [/prisma\.schema$|schema\.prisma$/, "Prisma"],
  [/docker(?:file|compose)/i, "Docker"],
  [/\.tf$/,   "Terraform"],
  [/\.ya?ml$/, "YAML"],
];

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export function analyzeFiles(filePaths: string[]): FileAnalysis {
  const moduleSet = new Set<string>();
  const featureSet = new Set<string>();

  for (const filePath of filePaths) {
    // Normalize Windows paths
    const normalized = "/" + filePath.replace(/\\/g, "/");

    for (const [pattern, label] of MODULE_RULES) {
      if (pattern.test(normalized)) moduleSet.add(label);
    }

    for (const [pattern, label] of FEATURE_RULES) {
      if (pattern.test(normalized)) featureSet.add(label);
    }
  }

  const architectureStyle = detectArchitectureStyle(filePaths);

  return {
    modules: [...moduleSet],
    detectedFeatures: [...featureSet],
    architectureStyle,
  };
}

/**
 * Guess additional tech from file extensions — supplements language API data.
 */
export function inferTechFromExtensions(filePaths: string[]): string[] {
  const found = new Set<string>();
  for (const filePath of filePaths) {
    for (const [pattern, tech] of EXTENSION_TECH) {
      if (pattern.test(filePath)) {
        found.add(tech);
        break;
      }
    }
  }
  return [...found];
}

/**
 * Returns the user's most-touched directory areas from contribution files.
 * Useful for collaborative projects where we only know what the user touched.
 */
export function getUserContributionAreas(filePaths: string[]): string[] {
  const areas = new Set<string>();
  for (const fp of filePaths) {
    const parts = fp.replace(/\\/g, "/").split("/");
    // Top-level directory (skip 'src', 'app', 'lib' as too generic)
    const topLevel = parts[0] === "src" || parts[0] === "app"
      ? parts[1]
      : parts[0];
    if (topLevel && topLevel.length > 1) areas.add(topLevel);
  }
  return [...areas].slice(0, 5);
}