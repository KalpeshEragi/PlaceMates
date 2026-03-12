// src/services/linkedin/skillEngine.ts

import { SKILL_CLUSTERS } from "../../utils/skillClusterMap";

interface RawSkill {
  [key: string]: string;
}

export interface ProcessedSkill {
  skillName: string;
  normalizedName: string;
  frequency: number;
  cluster: string;
  strengthScore: number;
}

export function processSkills(skills: RawSkill[]): ProcessedSkill[] {
  if (!skills.length) return [];

  const frequencyMap: Record<string, number> = {};

  for (const skill of skills) {
    const raw =
      skill["Name"] ||
      skill["Skill Name"] ||
      skill["Skill"] ||
      "";

    if (!raw) continue;

    const normalized = normalizeSkill(raw);

    frequencyMap[normalized] =
      (frequencyMap[normalized] || 0) + 1;
  }

  const processed: ProcessedSkill[] = [];

  for (const [normalizedName, frequency] of Object.entries(frequencyMap)) {
    const cluster = detectCluster(normalizedName);

    processed.push({
      skillName: normalizedName,
      normalizedName,
      frequency,
      cluster,
      strengthScore: computeStrengthScore(frequency),
    });
  }

  return processed.sort((a, b) => b.strengthScore - a.strengthScore);
}

/**
 * Normalizes variations like:
 * React.js → react
 * NodeJS → node
 */
function normalizeSkill(raw: string): string {
  let skill = raw.trim().toLowerCase();

  // Remove .js suffix only at end of word (e.g. "React.js" → "react")
  skill = skill.replace(/\.js\b/g, "");

  // Replace standalone "js" token only (not substrings like "faiss", "nestjs")
  skill = skill.replace(/\bjs\b/g, "javascript");

  // Common shorthand normalizations
  skill = skill.replace(/\bnodejs\b/g, "node");
  skill = skill.replace(/\breactjs\b/g, "react");
  skill = skill.replace(/\bc plus plus\b/g, "c++");

  return skill;
}

function detectCluster(skill: string): string {
  for (const [cluster, keywords] of Object.entries(SKILL_CLUSTERS)) {
    for (const keyword of keywords) {
      // Use word-boundary regex to avoid single-letter keywords (like "c")
      // matching inside unrelated skill names (e.g. "c" inside "version control")
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(^|\\s|\\b)${escaped}(\\s|\\b|$)`, "i");
      if (pattern.test(skill)) {
        return cluster;
      }
    }
  }

  return "Other";
}

function computeStrengthScore(frequency: number): number {
  // Basic scoring for now
  // Later we can weight by recency or project count
  return Math.min(100, frequency * 20);
}