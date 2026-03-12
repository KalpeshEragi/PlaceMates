// src/services/linkedin/experienceEngine.ts

interface RawPosition {
  [key: string]: string;
}

interface DateRange {
  start: number;
  end: number;
}

export interface ExperienceResult {
  totalExperienceYears: number;
  mergedRanges: DateRange[];
}

/**
 * Main function to compute accurate experience.
 * Removes overlaps and merges parallel roles.
 */
export function computeExperienceTimeline(
  positions: RawPosition[]
): ExperienceResult {
  const ranges: DateRange[] = [];

  for (const role of positions) {
    const startRaw =
      role["Start Date"] ||
      role["Started On"] ||
      role["From"];

    const endRaw =
      role["End Date"] ||
      role["Ended On"] ||
      role["To"];

    const start = parseLinkedinDate(startRaw);
    const end = parseLinkedinDate(endRaw, true);

    if (!start) continue;

    ranges.push({
      start,
      end: end ?? Date.now(),
    });
  }

  if (!ranges.length) {
    return {
      totalExperienceYears: 0,
      mergedRanges: [],
    };
  }

  // Sort ranges by start date
  ranges.sort((a, b) => a.start - b.start);

  const merged: DateRange[] = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping range → merge
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  let totalMs = 0;

  for (const r of merged) {
    totalMs += r.end - r.start;
  }

  const totalYears = totalMs / (1000 * 60 * 60 * 24 * 365);

  return {
    totalExperienceYears: Number(totalYears.toFixed(2)),
    mergedRanges: merged,
  };
}

/**
 * Robust LinkedIn date parser.
 * Handles:
 * - "Jan 2022"
 * - "February 2023"
 * - "2020"
 * - "Present"
 */
function parseLinkedinDate(
  raw?: string,
  allowPresent = false
): number | null {
  if (!raw) return null;

  const value = raw.trim().toLowerCase();

  if (allowPresent && (value === "present" || value === "current")) {
    return Date.now();
  }

  const parsed = Date.parse(raw);

  if (!isNaN(parsed)) {
    return parsed;
  }

  return null;
}