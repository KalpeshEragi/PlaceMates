// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence — Education Context Analyzer
// ────────────────────────────────────────────────────────────
//
// Extracts education context signals:
//   - Student vs professional status
//   - Field relevance to tech
//   - Graduation recency
// ────────────────────────────────────────────────────────────

import type { LinkedInEducation } from "../../utils/linkedin/types.js";
import type { EducationContext } from "./types.js";

// ── Tech-Relevant Fields ──────────────────────────────────

const HIGH_RELEVANCE_FIELDS = [
    "computer science", "computer engineering", "software engineering",
    "information technology", "information science", "informatics",
    "data science", "artificial intelligence", "machine learning",
    "cybersecurity", "information security", "network engineering",
    "computer applications", "computing", "cs", "it",
    "electrical and computer engineering", "computational",
    "web development", "software development",
];

const MEDIUM_RELEVANCE_FIELDS = [
    "electrical engineering", "electronics", "ece",
    "mathematics", "applied mathematics", "statistics",
    "physics", "applied physics",
    "mechanical engineering", "engineering",
    "biomedical engineering", "bioinformatics",
    "operations research", "industrial engineering",
];

// ── Graduation Recency Thresholds ─────────────────────────

const RECENT_THRESHOLD_YEARS = 2;
const MID_THRESHOLD_YEARS = 5;

// ── Main Analyzer ─────────────────────────────────────────

/**
 * Analyze education entries for career context signals.
 */
export function analyzeEducation(
    education: LinkedInEducation[]
): EducationContext {
    if (education.length === 0) {
        return {
            isStudent: false,
            fieldRelevanceToTech: "unknown",
            graduationRecency: "unknown",
            fields: [],
            institutions: [],
        };
    }

    // ── Collect fields and institutions ──────────────────
    const fields = education
        .map((e) => e.fieldOfStudy || e.degree || "")
        .filter(Boolean);

    const institutions = education
        .map((e) => e.schoolName || "")
        .filter(Boolean);

    // ── Determine student status ─────────────────────────
    const now = new Date();
    const isStudent = education.some((e) => {
        if (!e.endDate) return true; // no end date = possibly still enrolled
        const end = new Date(e.endDate);
        return !isNaN(end.getTime()) && end > now;
    });

    // ── Field relevance ──────────────────────────────────
    const fieldRelevanceToTech = determineFieldRelevance(fields);

    // ── Graduation recency ───────────────────────────────
    const graduationRecency = determineGraduationRecency(education);

    return {
        isStudent,
        fieldRelevanceToTech,
        graduationRecency,
        fields,
        institutions,
    };
}

// ── Field Relevance Helper ────────────────────────────────

function determineFieldRelevance(
    fields: string[]
): "high" | "medium" | "low" | "unknown" {
    if (fields.length === 0) return "unknown";

    const normalizedFields = fields.map((f) => f.toLowerCase());

    // Check for high relevance
    for (const field of normalizedFields) {
        if (HIGH_RELEVANCE_FIELDS.some((hf) => field.includes(hf))) {
            return "high";
        }
    }

    // Check for medium relevance
    for (const field of normalizedFields) {
        if (MEDIUM_RELEVANCE_FIELDS.some((mf) => field.includes(mf))) {
            return "medium";
        }
    }

    return "low";
}

// ── Graduation Recency Helper ─────────────────────────────

function determineGraduationRecency(
    education: LinkedInEducation[]
): "recent" | "mid" | "distant" | "unknown" {
    const now = new Date();
    let mostRecentEnd: Date | null = null;

    for (const edu of education) {
        if (!edu.endDate) continue;
        const end = new Date(edu.endDate);
        if (isNaN(end.getTime())) continue;

        if (!mostRecentEnd || end > mostRecentEnd) {
            mostRecentEnd = end;
        }
    }

    if (!mostRecentEnd) return "unknown";

    const yearsSinceGrad =
        (now.getTime() - mostRecentEnd.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (yearsSinceGrad < 0) return "recent"; // still in school / future end date
    if (yearsSinceGrad <= RECENT_THRESHOLD_YEARS) return "recent";
    if (yearsSinceGrad <= MID_THRESHOLD_YEARS) return "mid";
    return "distant";
}
