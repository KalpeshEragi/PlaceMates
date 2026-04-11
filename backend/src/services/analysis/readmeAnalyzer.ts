/**
 * analysis/readmeAnalyzer.ts
 *
 * Fully offline, rule-based README analysis with deep feature extraction.
 *
 * Responsibilities:
 *   1. Strip markdown noise (badges, headers, code blocks, HTML)
 *   2. Extract the first meaningful paragraph as a summary
 *   3. Extract high-frequency keywords (TF-weighted, stop-word filtered)
 *   4. Infer domain from keyword signals
 *   5. Detect explicitly mentioned technologies
 *   6. Extract headings as architectural/feature signals
 *   7. Map keywords → concrete features (auth/login → "user authentication system")
 */

import type { ReadmeAnalysis, Domain } from "../types/index";

// ─────────────────────────────────────────────
// Stop words
// ─────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","for","nor","so","yet","in","on","at","to",
  "of","by","from","with","into","through","as","is","are","was","were","be",
  "been","being","have","has","had","do","does","did","will","would","could",
  "should","may","might","shall","can","this","that","these","those","it","its",
  "we","our","you","your","they","their","i","my","he","she","him","her","us",
  "also","if","then","than","when","where","which","who","how","not","no","more",
  "all","any","each","every","both","few","many","some","such","only","just",
  "about","above","after","before","between","during","over","under","within",
  "without","against","along","among","around","because","since","while","though",
  "although","however","therefore","thus","hence","here","there","now","up","down",
  "out","off","back","into","onto","upon","across",
]);

// ─────────────────────────────────────────────
// Domain keyword signals
// ─────────────────────────────────────────────

const DOMAIN_SIGNALS: Record<Domain, RegExp> = {
  Frontend: /\b(react|vue|angular|svelte|html|css|scss|tailwind|webpack|vite|ui|interface|component|browser|frontend|client.?side|spa|pwa|next\.?js|nuxt|gatsby|styled.?components|material.?ui|chakra)\b/i,
  Backend:  /\b(node|express|fastapi|django|flask|spring|rails|api|rest|graphql|grpc|server|endpoint|middleware|microservice|backend|server.?side|postgresql|mysql|mongodb|redis|prisma|orm|sql)\b/i,
  ML:       /\b(machine.?learning|deep.?learning|neural.?network|tensorflow|pytorch|keras|scikit|pandas|numpy|model|train|predict|inference|dataset|accuracy|nlp|computer.?vision|reinforcement|transformer|llm|bert|gpt)\b/i,
  DevOps:   /\b(docker|kubernetes|k8s|terraform|ansible|jenkins|github.?actions|ci.?cd|pipeline|deploy|infrastructure|cloud|aws|gcp|azure|devops|helm|nginx|traefik|monitoring|prometheus|grafana)\b/i,
  Mobile:   /\b(android|ios|swift|kotlin|flutter|react.?native|mobile|app.?store|play.?store|xcode|gradle|expo)\b/i,
  Other:    /$/,  // never matches as a primary signal
};

// ─────────────────────────────────────────────
// Keyword → Feature mapping (30+ rules)
// ─────────────────────────────────────────────

type FeatureMapping = { pattern: RegExp; label: string };

const KEYWORD_FEATURE_MAP: FeatureMapping[] = [
  // Authentication & Authorization
  { pattern: /\b(auth|login|logout|signin|signup|register|password|jwt|oauth|session|token|2fa|mfa|sso|credential)\b/i, label: "user authentication system" },
  // API & Networking
  { pattern: /\b(api|endpoint|rest|restful|graphql|grpc|webhook|swagger|openapi|route|router)\b/i, label: "API layer" },
  // Database & ORM
  { pattern: /\b(database|db|mongo|mongodb|postgres|postgresql|mysql|sqlite|redis|prisma|orm|sequelize|mongoose|migration|schema|seed|query|sql)\b/i, label: "database management layer" },
  // Dashboard & Analytics
  { pattern: /\b(dashboard|analytics|chart|graph|report|metric|stat|kpi|insight|visualization)\b/i, label: "analytics dashboard" },
  // Admin panel
  { pattern: /\b(admin|backoffice|cms|management.?panel|role|permission|rbac|acl)\b/i, label: "admin panel with role-based access" },
  // Payments
  { pattern: /\b(payment|stripe|checkout|billing|invoice|subscription|pricing|cart|order|e.?commerce)\b/i, label: "payment processing system" },
  // Real-time
  { pattern: /\b(chat|message|inbox|socket|websocket|realtime|real.?time|notification|push|live)\b/i, label: "real-time communication system" },
  // Search
  { pattern: /\b(search|filter|query|autocomplete|elasticsearch|fuzzy|facet|full.?text)\b/i, label: "search and filtering engine" },
  // File management
  { pattern: /\b(upload|download|file.?management|attachment|storage|s3|bucket|media|image.?upload|video)\b/i, label: "file upload and storage system" },
  // Email & Notifications
  { pattern: /\b(email|smtp|sendgrid|mailgun|ses|newsletter|template|notification.?system)\b/i, label: "email notification service" },
  // Testing
  { pattern: /\b(test|testing|unit.?test|integration.?test|e2e|coverage|jest|vitest|cypress|playwright|pytest)\b/i, label: "automated testing suite" },
  // CI/CD
  { pattern: /\b(docker|container|kubernetes|helm|deploy|ci.?cd|pipeline|github.?actions|jenkins|workflow)\b/i, label: "CI/CD deployment pipeline" },
  // Caching
  { pattern: /\b(cache|caching|redis|memcache|ttl|cdn)\b/i, label: "caching layer" },
  // User management
  { pattern: /\b(profile|user.?management|account|setting|preference|onboard)\b/i, label: "user profile management" },
  // ML/AI
  { pattern: /\b(ml|machine.?learning|model|train|predict|classification|embedding|vector|neural|nlp)\b/i, label: "machine learning pipeline" },
  // Monitoring
  { pattern: /\b(log|logging|monitor|trace|alert|sentry|datadog|observ|health|telemetry)\b/i, label: "monitoring and observability" },
  // Data export
  { pattern: /\b(export|import|csv|json|pdf|excel|report.?generation)\b/i, label: "data export and reporting" },
  // Geolocation
  { pattern: /\b(map|geo|location|coordinate|gps|distance|address|geocode)\b/i, label: "geolocation service" },
  // State management
  { pattern: /\b(redux|zustand|mobx|recoil|state.?management|context|store)\b/i, label: "state management architecture" },
  // Responsive design
  { pattern: /\b(responsive|mobile.?first|adaptive|media.?query|breakpoint|flexbox|grid.?layout)\b/i, label: "responsive UI design" },
  // Form handling
  { pattern: /\b(form|validation|input|form.?handling|formik|react.?hook.?form|zod|yup)\b/i, label: "form validation system" },
  // Scheduling / Background
  { pattern: /\b(cron|scheduler|queue|job|worker|background|bull|agenda|celery)\b/i, label: "background job processing" },
  // Rate limiting / Security
  { pattern: /\b(rate.?limit|throttl|sanitiz|xss|csrf|cors|helmet|security)\b/i, label: "security hardening" },
  // Internationalization
  { pattern: /\b(i18n|internationalization|localization|l10n|translation|multi.?language)\b/i, label: "internationalization support" },
  // Pagination
  { pattern: /\b(pagination|infinite.?scroll|cursor|offset|lazy.?load)\b/i, label: "pagination system" },
  // Markdown / Rich text
  { pattern: /\b(markdown|rich.?text|wysiwyg|editor|formatting)\b/i, label: "rich text editor" },
  // Blog / Content
  { pattern: /\b(blog|post|article|content|comment|feed|timeline)\b/i, label: "content management system" },
  // Booking / Calendar
  { pattern: /\b(book|booking|reservation|calendar|schedule|appointment|slot)\b/i, label: "booking and scheduling system" },
  // Collaboration
  { pattern: /\b(collaborat|workspace|team|invite|shared|multiplayer)\b/i, label: "collaborative workspace" },
  // Wallet / Crypto
  { pattern: /\b(wallet|crypto|blockchain|web3|metamask|ethereum|solidity)\b/i, label: "blockchain integration" },
];

// ─────────────────────────────────────────────
// Known technology names (for explicit mention detection)
// ─────────────────────────────────────────────

const KNOWN_TECH = [
  "React","Vue","Angular","Svelte","Next.js","Nuxt","Gatsby","Vite","Webpack",
  "Tailwind","Bootstrap","Material UI","Chakra UI",
  "Node.js","Express","Fastify","NestJS","Django","Flask","FastAPI","Spring Boot",
  "Rails","Laravel","Phoenix","ASP.NET",
  "GraphQL","REST","gRPC","WebSocket","tRPC",
  "PostgreSQL","MySQL","SQLite","MongoDB","Redis","Cassandra","DynamoDB","Supabase","Firebase",
  "Prisma","TypeORM","Sequelize","Mongoose",
  "TypeScript","JavaScript","Python","Go","Rust","Java","C++","C#","Ruby","PHP","Swift","Kotlin",
  "Docker","Kubernetes","Terraform","Ansible","GitHub Actions","Jenkins","CircleCI","AWS","GCP","Azure",
  "TensorFlow","PyTorch","Keras","scikit-learn","Pandas","NumPy","Hugging Face",
  "Flutter","React Native","Expo","Xcode",
  "Jest","Vitest","Cypress","Playwright","pytest","JUnit",
  "Stripe","Twilio","SendGrid","Auth0","Clerk",
  "Elasticsearch","Kafka","RabbitMQ","NATS",
  "Nginx","Traefik","Caddy",
  "OpenAI","LangChain","LlamaIndex",
];

const TECH_PATTERN = new RegExp(
  `\\b(${KNOWN_TECH.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

// ─────────────────────────────────────────────
// Markdown strippers
// ─────────────────────────────────────────────

function stripMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")           // fenced code blocks
    .replace(/`[^`]*`/g, " ")                  // inline code
    .replace(/!\[.*?\]\(.*?\)/g, " ")          // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")   // links → keep label
    .replace(/^#{1,6}\s+.*$/gm, " ")           // headers
    .replace(/^\s*[-*_]{3,}\s*$/gm, " ")       // horizontal rules
    .replace(/^\s*[|].*[|]\s*$/gm, " ")        // tables
    .replace(/<[^>]+>/g, " ")                  // HTML tags
    .replace(/^\s*[-*+]\s+/gm, " ")            // list bullets
    .replace(/^\s*\d+\.\s+/gm, " ")            // numbered lists
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1") // bold/italic
    .replace(/\s{2,}/g, " ")                   // collapse whitespace
    .trim();
}

/** Skip lines that are purely badge/shield URLs or empty noise */
function isMeaninglessLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^!\[.*shields\.io/.test(trimmed)) return true;
  if (/^!\[.*badge/.test(trimmed)) return true;
  if (/^\[!\[/.test(trimmed)) return true;          // badge wrapped in link
  if (/^<!--.*-->$/.test(trimmed)) return true;     // HTML comment
  if (/^---+$/.test(trimmed)) return true;          // horizontal rule
  if (trimmed.split(/\s+/).length < 3) return true; // too short
  return false;
}

// ─────────────────────────────────────────────
// Heading extractor
// ─────────────────────────────────────────────

function extractHeadings(readme: string): string[] {
  const headings: string[] = [];
  const lines = readme.split("\n");
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/);
    if (match) {
      const heading = match[1]
        .replace(/[*_~`#]/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .trim();
      // Skip boilerplate headings
      if (!/^(table of contents|toc|license|contributing|acknowledgments?|installation|getting started|prerequisites|requirements|usage|setup|how to run|authors?)$/i.test(heading)) {
        if (heading.length >= 3 && heading.length <= 80) {
          headings.push(heading);
        }
      }
    }
  }
  return headings;
}

// ─────────────────────────────────────────────
// Paragraph extractor
// ─────────────────────────────────────────────

function extractFirstParagraph(readme: string): string | null {
  const rawLines = readme.split("\n");
  const paragraphLines: string[] = [];
  let inCodeBlock = false;
  let wordCount = 0;

  for (const line of rawLines) {
    // Track code blocks to skip them entirely
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Skip headings — but if we already have content, a heading means end of paragraph
    if (/^#{1,6}\s/.test(line.trim())) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    // Empty line = paragraph boundary
    if (!line.trim()) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    if (isMeaninglessLine(line)) continue;

    const stripped = stripMarkdown(line).trim();
    if (stripped.length < 10) continue;

    paragraphLines.push(stripped);
    wordCount += stripped.split(/\s+/).length;

    if (wordCount >= 80) break;
  }

  const text = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
  return text.length >= 30 ? text.slice(0, 350) : null;
}

// ─────────────────────────────────────────────
// Keyword extraction (TF-weighted, top N)
// ─────────────────────────────────────────────

function extractKeywords(text: string, topN = 20): string[] {
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
// Domain detection
// ─────────────────────────────────────────────

function inferDomainFromText(text: string): Domain | null {
  const scores: Partial<Record<Domain, number>> = {};

  for (const [domain, pattern] of Object.entries(DOMAIN_SIGNALS) as [Domain, RegExp][]) {
    if (domain === "Other") continue;
    const matches = text.match(pattern);
    if (matches) scores[domain] = matches.length;
  }

  const sorted = (Object.entries(scores) as [Domain, number][]).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

// ─────────────────────────────────────────────
// Tech mention detection
// ─────────────────────────────────────────────

function detectMentionedTech(text: string): string[] {
  const found = new Set<string>();
  const matches = text.matchAll(TECH_PATTERN);
  for (const m of matches) {
    // Normalize casing to match KNOWN_TECH canonical form
    const canonical = KNOWN_TECH.find(
      (t) => t.toLowerCase() === m[0].toLowerCase(),
    );
    if (canonical) found.add(canonical);
  }
  return [...found];
}

// ─────────────────────────────────────────────
// Feature extraction from keywords + headings
// ─────────────────────────────────────────────

function extractFeaturesFromText(fullText: string, headings: string[]): string[] {
  const combined = fullText + " " + headings.join(" ");
  const found = new Set<string>();

  for (const mapping of KEYWORD_FEATURE_MAP) {
    if (mapping.pattern.test(combined)) {
      found.add(mapping.label);
    }
  }

  // Also infer features from headings directly
  for (const heading of headings) {
    const lower = heading.toLowerCase();
    // Skip very generic headings
    if (/^(features?|overview|description|about|introduction)$/i.test(lower)) continue;

    // If heading is a meaningful feature name (3–6 words), add it as-is
    const words = heading.split(/\s+/);
    if (words.length >= 2 && words.length <= 6) {
      // Check if it maps to a known feature
      let matched = false;
      for (const mapping of KEYWORD_FEATURE_MAP) {
        if (mapping.pattern.test(heading)) {
          found.add(mapping.label);
          matched = true;
          break;
        }
      }
      // If not mapped, use the heading as a feature in lowercase
      if (!matched && !/^(tech|stack|built with|technologies|api|demo|screenshot|project)/i.test(lower)) {
        found.add(heading.toLowerCase());
      }
    }
  }

  return [...found].slice(0, 8); // cap at 8 unique features
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export function analyzeReadme(readme: string | null): ReadmeAnalysis {
  if (!readme || readme.trim().length < 20) {
    return { summary: null, domain: null, keywords: [], mentionedTech: [], extractedFeatures: [] };
  }

  const summary = extractFirstParagraph(readme);
  const fullText = stripMarkdown(readme);
  const keywords = extractKeywords(fullText);
  const domain = inferDomainFromText(fullText);
  const mentionedTech = detectMentionedTech(readme); // use raw for tech names
  const headings = extractHeadings(readme);
  const extractedFeatures = extractFeaturesFromText(fullText, headings);

  return { summary, domain, keywords, mentionedTech, extractedFeatures };
}