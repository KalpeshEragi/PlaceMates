// src/services/linkedin/growthEngine.ts

interface RawPosition {
  [key: string]: string;
}

export function computeCareerGrowth(
  positions: RawPosition[],
  totalExperienceYears: number
): number | null {
  if (!positions.length || totalExperienceYears <= 0) {
    return null;
  }

  // Sort by start date ascending
  const sorted = [...positions].sort((a, b) => {
    const aDate = Date.parse(a["Started On"] || "");
    const bDate = Date.parse(b["Started On"] || "");
    return aDate - bDate;
  });

  const levels: number[] = [];

  for (const role of sorted) {
    const title = (role["Title"] || "").toLowerCase();
    const level = mapTitleToLevel(title);
    levels.push(level);
  }

  if (!levels.length) return null;

  const lowest = Math.min(...levels);
  const highest = Math.max(...levels);

  const growth = (highest - lowest) / totalExperienceYears;

  return Number(growth.toFixed(2));
}

/**
 * Maps job titles to career level.
 * Expand this gradually.
 */
function mapTitleToLevel(title: string): number {
  if (!title) return 1;

  if (title.includes("intern")) return 1;
  if (title.includes("trainee")) return 1;

  if (title.includes("junior")) return 2;

  if (title.includes("developer") ||
      title.includes("engineer") ||
      title.includes("analyst")) return 3;

  if (title.includes("senior")) return 4;

  if (title.includes("lead") ||
      title.includes("manager")) return 5;

  if (title.includes("director") ||
      title.includes("head")) return 6;

  return 2; // default mild contributor
}