import type { ReadmeAnalysis, ComplexityLevel } from "./geminiService";

export interface RepoMetrics {
  totalLoc: number;
  stars: number;
  forks: number;
  readmeAnalysis: ReadmeAnalysis | null;
}

function normalizeLoc(loc: number): number {
  if (loc <= 0) return 0;
  const locPerK = loc / 1000;
  const score = Math.min(100, Math.log10(1 + locPerK) * 40);
  return Math.max(0, Math.min(100, score));
}

function normalizeStars(stars: number): number {
  const capped = Math.min(stars, 2000);
  return (capped / 2000) * 100;
}

function normalizeForks(forks: number): number {
  const capped = Math.min(forks, 500);
  return (capped / 500) * 100;
}

function complexityScore(level: ComplexityLevel): number {
  switch (level) {
    case "Beginner":
      return 40;
    case "Intermediate":
      return 70;
    case "Advanced":
      return 90;
    default:
      return 50;
  }
}

export interface RepoScoreComponents {
  locScore: number;
  readmeScore: number;
  starsScore: number;
  forksScore: number;
  complexityScore: number;
  impactScore: number;
  finalScore: number;
}

export function computeProjectScore(metrics: RepoMetrics): RepoScoreComponents {
  const { totalLoc, stars, forks, readmeAnalysis } = metrics;

  const locScore = normalizeLoc(totalLoc);
  const starsScore = normalizeStars(stars);
  const forksScore = normalizeForks(forks);

  const readmeScore =
    readmeAnalysis?.readmeQualityScore != null ? readmeAnalysis.readmeQualityScore : 0;

  const complexityLevel: ComplexityLevel = readmeAnalysis?.complexityLevel ?? "Beginner";
  const complexityScoreVal = complexityScore(complexityLevel);

  const impactScore = readmeAnalysis?.impactScore ?? 0;

  const finalScore =
    0.3 * locScore +
    0.25 * readmeScore +
    0.1 * starsScore +
    0.05 * forksScore +
    0.15 * complexityScoreVal +
    0.15 * impactScore;

  return {
    locScore,
    readmeScore,
    starsScore,
    forksScore,
    complexityScore: complexityScoreVal,
    impactScore,
    finalScore,
  };
}

