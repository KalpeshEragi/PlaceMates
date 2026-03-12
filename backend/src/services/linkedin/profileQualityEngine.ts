// src/services/linkedin/profileQualityEngine.ts

interface ProfileData {
  profile: any;
  positions: any[];
  skills: any[];
  projects: any[];
  certifications: any[];
  education: any[];
  connections: any[];
}

export function computeAdvancedProfileScore(
  data: ProfileData
): number {
  let score = 0;

  // ---------- HEADLINE ----------
  const headline = data.profile?.Headline || data.profile?.headline || "";
  if (headline.length >= 10) score += 5;
  if (headline.length >= 30) score += 5;

  // ---------- SUMMARY ----------
  const summary = data.profile?.Summary || data.profile?.summary || "";
  if (summary.length >= 50) score += 5;
  if (summary.length >= 150) score += 10;

  // ---------- POSITIONS ----------
  if (data.positions.length >= 1) score += 5;
  if (data.positions.length >= 3) score += 5;

  let richDescriptions = 0;
  let measurableImpactCount = 0;

  for (const role of data.positions) {
    const desc = (role["Description"] || "").toLowerCase();

    if (desc.length > 100) richDescriptions++;

    if (containsMeasurableImpact(desc)) {
      measurableImpactCount++;
    }
  }

  if (richDescriptions >= 1) score += 5;
  if (richDescriptions >= 3) score += 5;

  if (measurableImpactCount >= 1) score += 5;
  if (measurableImpactCount >= 3) score += 10;

  // ---------- SKILLS ----------
  if (data.skills.length >= 5) score += 5;
  if (data.skills.length >= 10) score += 5;
  if (data.skills.length >= 20) score += 5;

  // ---------- PROJECTS ----------
  if (data.projects.length >= 1) score += 5;
  if (data.projects.length >= 3) score += 5;

  // ---------- CERTIFICATIONS ----------
  if (data.certifications.length >= 1) score += 5;

  // ---------- EDUCATION ----------
  if (data.education.length >= 1) score += 5;

  // ---------- CONNECTIONS ----------
  if (data.connections.length >= 1) score += 5;

  return Math.min(score, 100);
}

/**
 * Detects measurable impact signals like:
 * 30%, 50 users, 10x, 200ms, 5k, etc.
 */
function containsMeasurableImpact(text: string): boolean {
  const patterns = [
    /\d+%/,
    /\d+\s?(users|clients|customers|downloads)/,
    /\d+x/,
    /\d+\s?(ms|seconds|minutes)/,
    /\d+k/,
    /\d+\s?(increase|reduction|growth|improvement)/,
  ];

  return patterns.some((pattern) => pattern.test(text));
}