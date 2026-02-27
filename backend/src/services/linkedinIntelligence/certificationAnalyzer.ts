// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence — Certification / Course Analyzer
// ────────────────────────────────────────────────────────────
//
// Maps certifications and courses to:
//   - Learning direction (e.g., cloud, AI, security)
//   - Specialization signals
// ────────────────────────────────────────────────────────────

import type { LinkedInCertification } from "../../utils/linkedin/types.js";
import type { LearningDirection } from "./types.js";

// ── Certification → Direction Maps ────────────────────────

const DIRECTION_KEYWORDS: Record<string, string[]> = {
    cloud: [
        "aws", "amazon web services", "gcp", "google cloud",
        "azure", "cloud practitioner", "solutions architect",
        "cloud engineer", "cloud computing", "cloud native",
        "cloud foundry", "cloud security", "cloudformation",
    ],
    ai: [
        "machine learning", "deep learning", "artificial intelligence",
        "neural network", "nlp", "natural language", "computer vision",
        "tensorflow", "pytorch", "data science", "ai ",
        "ml engineer", "ml ops", "generative ai", "llm",
        "hugging face", "reinforcement learning",
    ],
    data: [
        "data engineer", "data analysis", "data analytics",
        "big data", "apache spark", "hadoop", "etl",
        "data pipeline", "data warehouse", "sql",
        "power bi", "tableau", "looker", "dbt",
    ],
    security: [
        "cybersecurity", "security+", "cissp", "ceh",
        "ethical hacking", "penetration testing", "soc",
        "network security", "information security", "oscp",
        "comptia security", "security analyst",
    ],
    devops: [
        "docker", "kubernetes", "ci/cd", "devops",
        "terraform", "ansible", "jenkins", "site reliability",
        "sre", "monitoring", "observability", "helm",
        "gitops", "infrastructure as code",
    ],
    web: [
        "web development", "full stack", "frontend",
        "react", "angular", "vue", "javascript", "typescript",
        "html", "css", "node.js", "responsive design",
    ],
    mobile: [
        "android", "ios", "react native", "flutter",
        "mobile development", "swift", "kotlin",
        "mobile app",
    ],
    blockchain: [
        "blockchain", "web3", "solidity", "ethereum",
        "smart contract", "cryptocurrency", "defi", "nft",
    ],
    networking: [
        "ccna", "ccnp", "network+", "comptia network",
        "networking", "cisco", "routing", "switching",
    ],
    project_management: [
        "pmp", "scrum master", "agile", "prince2",
        "csm", "safe", "kanban", "project management",
    ],
};

// ── Specialization Signal Patterns ────────────────────────

const SPECIALIZATION_KEYWORDS = [
    "professional", "associate", "expert", "advanced",
    "specialist", "practitioner", "architect", "master",
    "certified", "accredited",
];

// ── Main Analyzer ─────────────────────────────────────────

/**
 * Analyze certifications/courses to infer learning direction
 * and specialization signals.
 */
export function analyzeCertifications(
    certifications: LinkedInCertification[]
): LearningDirection {
    if (certifications.length === 0) {
        return {
            learningDirection: [],
            specializationSignals: [],
        };
    }

    const learningDirections = new Set<string>();
    const specializationSignals = new Set<string>();

    for (const cert of certifications) {
        const text = [cert.name, cert.authority]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        // ── Match learning directions ────────────────────
        for (const [direction, keywords] of Object.entries(DIRECTION_KEYWORDS)) {
            for (const kw of keywords) {
                if (text.includes(kw)) {
                    learningDirections.add(direction);
                    break;
                }
            }
        }

        // ── Detect specialization signals ────────────────
        for (const signal of SPECIALIZATION_KEYWORDS) {
            if (text.includes(signal)) {
                // Build a meaningful signal string
                const certName = cert.name || "Unknown Certification";
                specializationSignals.add(`${certName} (${signal})`);
                break; // one signal per cert is enough
            }
        }
    }

    return {
        learningDirection: [...learningDirections],
        specializationSignals: [...specializationSignals],
    };
}
