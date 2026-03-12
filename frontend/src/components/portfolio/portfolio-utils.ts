import type { PortfolioCareer } from "./types";

const FALLBACK_AVATARS = [
  "/avatars/avatar1.jpg",
  "/avatars/avatar2.jpg",
  "/avatars/avatar3.png",
  "/avatars/avatar4.png",
  "/avatars/avatar5.jpg",
  "/avatars/avatar6.png",
] as const;

export function pickDeterministicAvatar(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_AVATARS[hash % FALLBACK_AVATARS.length];
}

export function slugToDisplayName(slug: string): string {
  const cleaned = slug.replace(/[-_]+/g, " ").trim();
  if (!cleaned) return "Developer";
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scoreToPercent(score: number | null | undefined): number {
  if (score == null || Number.isNaN(score)) return 0;
  const n = score > 1 ? score : score * 100;
  return Math.round(Math.max(0, Math.min(100, n)));
}

export function formatCompactNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);
  } catch {
    return String(n);
  }
}

export function safeUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // best-effort for github.com/foo or linkedin.com/in/foo
  return `https://${url}`;
}

/**
 * Generate a meaningful AI title from career domain signals.
 * Combines primaryDomain, secondaryDomain, and technicalOrientation
 * to produce titles like "AI & Backend Developer" or "ML Systems Engineer".
 */
export function generateAiTitle(career: PortfolioCareer | undefined): string {
  const primary = career?.primaryDomain?.trim() ?? null;
  const secondary = career?.secondaryDomain?.trim() ?? null;
  const orientation = career?.technicalOrientation?.trim() ?? null;

  // Map orientation to a role suffix
  const orientationSuffix: Record<string, string> = {
    "systems": "Systems Engineer",
    "product": "Product Engineer",
    "research": "Research Engineer",
    "devops": "DevOps Engineer",
    "data": "Data Engineer",
    "design": "Design Engineer",
  };

  // Try to build a rich composite title
  if (primary && secondary) {
    // e.g. "AI & Backend Developer"
    return `${primary} & ${secondary} Developer`;
  }

  if (primary && orientation) {
    const suffix = orientationSuffix[orientation.toLowerCase()] ?? "Engineer";
    // e.g. "AI Systems Engineer"
    return `${primary} ${suffix}`;
  }

  if (primary) {
    return `${primary} Engineer`;
  }

  if (orientation) {
    const suffix = orientationSuffix[orientation.toLowerCase()] ?? "Engineer";
    return `Software ${suffix}`;
  }

  return "Software Engineer";
}

/**
 * Format experience years into a human-friendly string.
 * 0.6 → "Less than 1 year"
 * 1.4 → "1+ years"
 * 2.7 → "3 years experience"
 */
export function formatExperienceYears(years: number | null | undefined): string {
  if (years == null || Number.isNaN(years)) return "";
  if (years < 1) return "Less than 1 year";
  const rounded = Math.round(years);
  if (rounded <= 1) return "1+ years";
  return `${rounded} years experience`;
}
