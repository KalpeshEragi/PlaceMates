/**
 * textUtils.ts
 * 
 * Shared text utilities for portfolio templates.
 * Handles truncation, fallback text, and text safety.
 */

/**
 * Truncate text to a maximum character count, adding ellipsis if needed.
 */
export function truncateText(text: string, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  // Break at the last space before maxChars to avoid cutting words
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > maxChars * 0.6 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

/**
 * Limit an array of bullets to a maximum count.
 */
export function limitBullets(bullets: string[] | undefined, max: number = 2): string[] {
  if (!bullets || bullets.length === 0) return [];
  return bullets.slice(0, max);
}
