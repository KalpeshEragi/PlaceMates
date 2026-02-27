// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence — Career Intent Parser
// ────────────────────────────────────────────────────────────
//
// Parses the About/Summary text to extract:
//   - Career intent keywords
//   - Target domains
//   - Motivation signals
//   - Specialization direction
// ────────────────────────────────────────────────────────────

import type { CareerIntent } from "./types.js";

// ── Domain Keyword Maps ───────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
    backend: [
        "backend", "back-end", "server-side", "api development",
        "microservices", "distributed systems", "scalable backend",
        "rest api", "graphql", "system design",
    ],
    frontend: [
        "frontend", "front-end", "client-side", "ui/ux", "user interface",
        "web development", "responsive design", "single page",
        "spa", "web app",
    ],
    fullstack: [
        "full stack", "fullstack", "full-stack", "end-to-end development",
    ],
    mobile: [
        "mobile development", "mobile app", "android", "ios",
        "react native", "flutter", "cross-platform",
    ],
    ai: [
        "artificial intelligence", "machine learning", "deep learning",
        "nlp", "natural language processing", "computer vision",
        "neural network", "data science", "ml engineer",
        "ai engineer", "ml ops",
    ],
    data: [
        "data engineering", "data pipeline", "etl", "data warehouse",
        "big data", "analytics", "business intelligence",
        "data analysis", "data analyst",
    ],
    cloud: [
        "cloud", "aws", "gcp", "azure", "cloud native",
        "cloud architecture", "cloud engineer", "devops",
        "infrastructure", "site reliability", "sre",
    ],
    cybersecurity: [
        "cybersecurity", "security", "infosec", "penetration testing",
        "ethical hacking", "network security", "application security",
        "vulnerability", "soc", "incident response",
    ],
    blockchain: [
        "blockchain", "web3", "smart contract", "decentralized",
        "defi", "cryptocurrency", "solidity", "ethereum",
    ],
    embedded: [
        "embedded", "iot", "internet of things", "firmware",
        "microcontroller", "hardware", "fpga", "rtos",
    ],
    gamedev: [
        "game development", "game dev", "unity", "unreal",
        "game design", "gaming",
    ],
};

// ── Motivation Signal Patterns ────────────────────────────

const MOTIVATION_PATTERNS = [
    "passionate about", "passionate for",
    "interested in", "fascinated by",
    "love building", "love creating", "love working",
    "driven by", "motivated by",
    "enthusiastic about", "eager to",
    "dedicated to", "committed to",
    "aspiring", "aspire to",
    "looking to", "seeking to",
    "excited about", "excited by",
    "aim to", "aiming to",
    "strive to", "striving to",
    "goal is to", "my goal",
    "dream of", "dreaming of",
];

// ── Specialization Keywords ───────────────────────────────

const SPECIALIZATION_SIGNALS = [
    "specialize", "specializing", "specialized",
    "focus on", "focused on", "focusing on",
    "expert in", "expertise in",
    "proficient in", "proficiency in",
    "deep dive", "deep diving",
    "niche", "domain expertise",
    "core competency", "core skill",
];

// ── Main Parser ───────────────────────────────────────────

/**
 * Parse About/Summary text for career intent signals.
 *
 * @param aboutText     - LinkedIn About/Summary section
 * @param headline      - LinkedIn headline (optional, adds context)
 */
export function parseCareerIntent(
    aboutText: string,
    headline?: string
): CareerIntent {
    const text = [aboutText, headline].filter(Boolean).join(" ");
    const lower = text.toLowerCase();

    if (!lower.trim()) {
        return {
            careerIntentKeywords: [],
            targetDomains: [],
            motivationSignals: [],
            specializationDirection: [],
        };
    }

    // ── Extract target domains ───────────────────────────
    const targetDomains: string[] = [];
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        for (const kw of keywords) {
            if (lower.includes(kw)) {
                targetDomains.push(domain);
                break; // one match per domain is enough
            }
        }
    }

    // ── Extract motivation signals ───────────────────────
    const motivationSignals: string[] = [];
    for (const pattern of MOTIVATION_PATTERNS) {
        if (lower.includes(pattern)) {
            // Extract the phrase + the following ~40 chars for context
            const idx = lower.indexOf(pattern);
            const snippet = text.substring(idx, idx + pattern.length + 40).trim();
            // Cut at sentence boundary if possible
            const endIdx = snippet.search(/[.!?\n]/);
            motivationSignals.push(
                endIdx > 0 ? snippet.substring(0, endIdx).trim() : snippet.trim()
            );
        }
    }

    // ── Extract specialization direction ─────────────────
    const specializationDirection: string[] = [];
    for (const signal of SPECIALIZATION_SIGNALS) {
        if (lower.includes(signal)) {
            const idx = lower.indexOf(signal);
            const snippet = text.substring(idx, idx + signal.length + 50).trim();
            const endIdx = snippet.search(/[.!?\n]/);
            specializationDirection.push(
                endIdx > 0 ? snippet.substring(0, endIdx).trim() : snippet.trim()
            );
        }
    }

    // ── Extract career intent keywords ───────────────────
    // Combine domain mentions + specialization snippets into keywords
    const careerIntentKeywords: string[] = [...new Set([
        ...targetDomains,
        ...extractKeyPhrases(lower),
    ])];

    return {
        careerIntentKeywords,
        targetDomains: [...new Set(targetDomains)],
        motivationSignals: [...new Set(motivationSignals)],
        specializationDirection: [...new Set(specializationDirection)],
    };
}

// ── Key Phrase Extraction ─────────────────────────────────

/**
 * Extract notable career-relevant phrases from text.
 */
function extractKeyPhrases(lower: string): string[] {
    const KEY_PHRASES = [
        "scalable systems", "scalable backend", "distributed systems",
        "high performance", "low latency", "real-time",
        "open source", "startup", "product development",
        "software architecture", "system design",
        "automation", "developer experience", "developer tools",
        "platform engineering", "infrastructure",
        "research", "innovation", "entrepreneurship",
        "problem solving", "competitive programming",
        "technical leadership", "team building",
    ];

    return KEY_PHRASES.filter((phrase) => lower.includes(phrase));
}
