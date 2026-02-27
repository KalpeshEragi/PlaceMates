// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence — Role Progression Analyzer
// ────────────────────────────────────────────────────────────
//
// Detects career progression from chronological experience entries:
//   - Internship → full-time transitions
//   - Title seniority growth
//   - Career stage determination
// ────────────────────────────────────────────────────────────

import type { LinkedInExperience } from "../../utils/linkedin/types.js";
import type { RoleProgression, CareerStage } from "./types.js";

// ── Seniority Level Map ───────────────────────────────────

const SENIORITY_LEVELS: Record<string, number> = {
    // Intern tier (0)
    intern: 0,
    trainee: 0,
    apprentice: 0,
    fellow: 0,

    // Junior tier (1)
    junior: 1,
    "jr.": 1,
    associate: 1,
    entry: 1,

    // Mid tier (2)
    mid: 2,
    "software engineer": 2,
    developer: 2,
    analyst: 2,
    consultant: 2,
    engineer: 2,

    // Senior tier (3)
    senior: 3,
    "sr.": 3,
    "sr": 3,

    // Lead tier (4)
    lead: 4,
    "team lead": 4,
    "tech lead": 4,
    "engineering lead": 4,
    principal: 4,
    staff: 4,
    architect: 4,

    // Manager tier (5)
    manager: 5,
    "engineering manager": 5,
    "project manager": 5,

    // Director+ tier (6)
    director: 6,
    vp: 6,
    "vice president": 6,
    head: 6,
    cto: 7,
    ceo: 7,
    founder: 5,
    "co-founder": 5,
};

// ── Internship Detection ──────────────────────────────────

const INTERN_PATTERNS = [
    /\bintern\b/i,
    /\binternship\b/i,
    /\btrainee\b/i,
    /\bapprentice\b/i,
];

function isInternRole(title: string): boolean {
    return INTERN_PATTERNS.some((p) => p.test(title));
}

function isFullTimeRole(title: string): boolean {
    return !isInternRole(title) && title.length > 0;
}

// ── Title Seniority Extraction ────────────────────────────

function getSeniorityLevel(title: string): number {
    const lower = title.toLowerCase();

    // Try longest match first
    const sortedKeys = Object.keys(SENIORITY_LEVELS).sort(
        (a, b) => b.length - a.length
    );

    for (const key of sortedKeys) {
        if (lower.includes(key)) {
            return SENIORITY_LEVELS[key];
        }
    }

    // Default to mid-level if title exists but no match
    return title.length > 0 ? 2 : 0;
}

// ── Duration Computation ──────────────────────────────────

function computeMonths(startDate?: string, endDate?: string): number {
    if (!startDate) return 0;

    const parseDate = (d: string): Date | null => {
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const start = parseDate(startDate);
    if (!start) return 0;

    const end = endDate ? parseDate(endDate) : new Date();
    if (!end) return 0;

    const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());

    return Math.max(0, months);
}

// ── Main Analyzer ─────────────────────────────────────────

/**
 * Analyze role progression from a list of LinkedIn experiences.
 * Experiences should be in chronological order (oldest first),
 * but the function handles unordered inputs too.
 */
export function analyzeRoleProgression(
    experiences: LinkedInExperience[]
): RoleProgression {
    if (experiences.length === 0) {
        return {
            roleProgressionScore: 0,
            careerStage: "student",
            hasInternToFulltime: false,
            seniorityGrowthDetected: false,
            totalExperienceMonths: 0,
            titleProgression: [],
        };
    }

    // ── Sort chronologically (oldest first) ──────────────
    const sorted = [...experiences].sort((a, b) => {
        const da = a.startDate ? new Date(a.startDate).getTime() : 0;
        const db = b.startDate ? new Date(b.startDate).getTime() : 0;
        return da - db;
    });

    // ── Extract title progression ────────────────────────
    const titleProgression = sorted
        .map((e) => e.title || "")
        .filter(Boolean);

    // ── Detect intern → fulltime transition ──────────────
    let hasInternToFulltime = false;
    for (let i = 0; i < sorted.length - 1; i++) {
        if (
            isInternRole(sorted[i].title || "") &&
            isFullTimeRole(sorted[i + 1].title || "")
        ) {
            hasInternToFulltime = true;
            break;
        }
    }

    // ── Detect seniority growth ──────────────────────────
    const seniorityLevels = sorted.map((e) =>
        getSeniorityLevel(e.title || "")
    );

    let seniorityGrowthDetected = false;
    let maxGrowth = 0;

    if (seniorityLevels.length >= 2) {
        const first = seniorityLevels[0];
        const last = seniorityLevels[seniorityLevels.length - 1];
        maxGrowth = last - first;
        seniorityGrowthDetected = maxGrowth > 0;
    }

    // ── Total experience months ──────────────────────────
    const totalExperienceMonths = sorted.reduce(
        (sum, e) => sum + computeMonths(e.startDate, e.endDate),
        0
    );

    // ── Career Stage determination ───────────────────────
    const careerStage = determineCareerStage(
        sorted,
        totalExperienceMonths,
        seniorityLevels
    );

    // ── Role Progression Score (0–10) ────────────────────
    let roleProgressionScore = 0;

    // Seniority growth component
    roleProgressionScore += Math.min(maxGrowth * 1.5, 4);

    // Intern → fulltime transition
    if (hasInternToFulltime) roleProgressionScore += 1.5;

    // Experience breadth (number of distinct roles)
    const uniqueTitles = new Set(titleProgression.map((t) => t.toLowerCase()));
    roleProgressionScore += Math.min(uniqueTitles.size * 0.75, 2);

    // Duration component
    if (totalExperienceMonths >= 48) roleProgressionScore += 2;
    else if (totalExperienceMonths >= 24) roleProgressionScore += 1.5;
    else if (totalExperienceMonths >= 12) roleProgressionScore += 1;
    else if (totalExperienceMonths >= 6) roleProgressionScore += 0.5;

    roleProgressionScore =
        Math.round(Math.max(0, Math.min(10, roleProgressionScore)) * 10) / 10;

    return {
        roleProgressionScore,
        careerStage,
        hasInternToFulltime,
        seniorityGrowthDetected,
        totalExperienceMonths,
        titleProgression,
    };
}

// ── Career Stage Helper ───────────────────────────────────

function determineCareerStage(
    experiences: LinkedInExperience[],
    totalMonths: number,
    seniorityLevels: number[]
): CareerStage {
    const maxSeniority = Math.max(...seniorityLevels, 0);
    const allIntern = experiences.every((e) =>
        isInternRole(e.title || "")
    );

    // If all roles are internships → student
    if (allIntern) return "student";

    // If only internships + short experience → entry
    if (totalMonths < 12 && maxSeniority <= 1) return "entry";

    // If 1–3 years and mid-level → early-career
    if (totalMonths < 36 && maxSeniority <= 2) return "early-career";

    // Otherwise → experienced
    if (totalMonths >= 36 || maxSeniority >= 3) return "experienced";

    return "early-career";
}
