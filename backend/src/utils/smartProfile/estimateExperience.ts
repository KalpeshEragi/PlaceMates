// ────────────────────────────────────────────────────────────
// Smart Profile — Experience Level Estimation
// ────────────────────────────────────────────────────────────
//
// Parses LinkedIn experience dates to estimate total years
// of professional experience, then maps to a level label.
// ────────────────────────────────────────────────────────────

interface ExperienceEntry {
    startDate?: string;
    endDate?: string;
}

/**
 * Estimate the user's experience level from LinkedIn work history.
 *
 * Mapping:
 *   0 years        → "Student"
 *   < 2 years      → "Beginner"
 *   2 – 5 years    → "Intermediate"
 *   > 5 years      → "Experienced"
 *
 * @param experiences - LinkedIn experience entries with start/end dates
 * @returns Experience level label and computed total years
 */
export function estimateExperienceLevel(
    experiences: ExperienceEntry[]
): {
    level: string;
    totalYears: number;
} {
    if (!experiences || experiences.length === 0) {
        return { level: "Student", totalYears: 0 };
    }

    let totalMonths = 0;

    for (const exp of experiences) {
        const start = parseDate(exp.startDate);
        const end = parseDate(exp.endDate) || new Date();

        if (!start) continue;

        // Ensure end >= start
        const diffMs = end.getTime() - start.getTime();
        if (diffMs <= 0) continue;

        const months = diffMs / (1000 * 60 * 60 * 24 * 30.44);
        totalMonths += months;
    }

    const totalYears = Math.round((totalMonths / 12) * 10) / 10; // 1 decimal place

    let level: string;

    if (totalYears === 0) {
        level = "Student";
    } else if (totalYears < 2) {
        level = "Beginner";
    } else if (totalYears <= 5) {
        level = "Intermediate";
    } else {
        level = "Experienced";
    }

    return { level, totalYears };
}

/**
 * Parse a date string in various formats:
 *   - "Jan 2020", "January 2020"
 *   - "2020-01", "2020-01-15"
 *   - "2020"
 *   - "Present" / empty → returns null (treated as current date by caller)
 */
function parseDate(dateStr: string | undefined): Date | null {
    if (!dateStr || !dateStr.trim()) return null;

    const cleaned = dateStr.trim().toLowerCase();

    // "present" or "current" means ongoing
    if (cleaned === "present" || cleaned === "current") return null;

    // Try ISO / standard date parse first
    const iso = new Date(dateStr);
    if (!isNaN(iso.getTime())) return iso;

    // Try "Month Year" format (e.g., "Jan 2020", "January 2020")
    const monthYearMatch = cleaned.match(
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})$/
    );
    if (monthYearMatch) {
        const monthStr = monthYearMatch[1];
        const year = parseInt(monthYearMatch[2], 10);
        const monthIndex = MONTH_MAP[monthStr] ?? 0;
        return new Date(year, monthIndex, 1);
    }

    // Try just a year (e.g., "2020")
    const yearMatch = cleaned.match(/^(\d{4})$/);
    if (yearMatch) {
        return new Date(parseInt(yearMatch[1], 10), 0, 1);
    }

    return null;
}

const MONTH_MAP: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3,
    may: 4, jun: 5, jul: 6, aug: 7,
    sep: 8, oct: 9, nov: 10, dec: 11,
};
