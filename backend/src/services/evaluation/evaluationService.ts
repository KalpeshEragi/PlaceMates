/**
 * evaluationService.ts
 *
 * Phase 8: Evaluation Service — computes IR metrics for semantic matching quality.
 *
 * Metrics:
 *   - Precision@K: Of the top-K results, how many are relevant?
 *   - Recall@K: Of all relevant items, how many appear in top-K?
 *   - NDCG@K: Normalized Discounted Cumulative Gain (ranking quality)
 *   - ATS Score Distribution: Summary of RAG-generated resume quality
 */

import { prisma } from "../../lib/prisma";

// ── Pure Math Functions ────────────────────────────────────

/**
 * Precision@K: fraction of top-K results that are relevant.
 * A result is "relevant" if matchScore >= relevanceThreshold.
 */
export function precisionAtK(
  scores: number[],
  relevanceThreshold: number,
  k: number,
): number {
  const topK = scores.slice(0, k);
  if (topK.length === 0) return 0;
  const relevant = topK.filter((s) => s >= relevanceThreshold).length;
  return relevant / topK.length;
}

/**
 * Recall@K: fraction of all relevant items that appear in top-K.
 */
export function recallAtK(
  scores: number[],
  relevanceThreshold: number,
  k: number,
): number {
  const totalRelevant = scores.filter((s) => s >= relevanceThreshold).length;
  if (totalRelevant === 0) return 0;
  const topK = scores.slice(0, k);
  const relevantInTopK = topK.filter((s) => s >= relevanceThreshold).length;
  return relevantInTopK / totalRelevant;
}

/**
 * NDCG@K: Normalized Discounted Cumulative Gain.
 * Measures ranking quality — higher-ranked relevant items score more.
 */
export function ndcgAtK(
  scores: number[],
  k: number,
): number {
  const topK = scores.slice(0, k);

  // DCG: sum of score / log2(rank + 1)
  const dcg = topK.reduce((sum, score, i) => {
    return sum + score / Math.log2(i + 2); // +2 because rank is 1-indexed
  }, 0);

  // Ideal DCG: sort all scores descending, take top-K
  const idealScores = [...scores].sort((a, b) => b - a).slice(0, k);
  const idcg = idealScores.reduce((sum, score, i) => {
    return sum + score / Math.log2(i + 2);
  }, 0);

  if (idcg === 0) return 0;
  return dcg / idcg;
}

// ── Evaluation Runner ──────────────────────────────────────

export interface EvaluationResult {
  userId: string;
  metrics: {
    precision5: number;
    precision10: number;
    recall5: number;
    recall10: number;
    ndcg5: number;
    ndcg10: number;
  };
  semanticMatches: number;
  keywordMatches: number;
  averageAtsScore: number | null;
  resumeCount: number;
  atsDistribution: { bucket: string; count: number }[];
}

/**
 * Run evaluation for a specific user's semantic vs keyword matches.
 */
export async function runEvaluation(userId: string): Promise<EvaluationResult> {
  // Fetch all matches for the user
  const allMatches = await prisma.jobMatch.findMany({
    where: { userId },
    orderBy: { matchScore: "desc" },
    select: {
      matchScore: true,
      semanticScore: true,
      matchMethod: true,
    },
  });

  // Fetch tailored resumes for ATS distribution
  const resumes = await prisma.tailoredResume.findMany({
    where: { userId },
    select: { atsScore: true },
  });

  // Split by method
  const semanticMatches = allMatches.filter((m) => m.matchMethod === "semantic");
  const keywordMatches = allMatches.filter((m) => m.matchMethod !== "semantic");

  // Use semantic scores for evaluation (fall back to matchScore/100)
  const scores = allMatches.map(
    (m) => m.semanticScore ?? m.matchScore / 100,
  );

  const relevanceThreshold = 0.5; // 50% match = "relevant"

  // Compute metrics
  const metrics = {
    precision5: round(precisionAtK(scores, relevanceThreshold, 5)),
    precision10: round(precisionAtK(scores, relevanceThreshold, 10)),
    recall5: round(recallAtK(scores, relevanceThreshold, 5)),
    recall10: round(recallAtK(scores, relevanceThreshold, 10)),
    ndcg5: round(ndcgAtK(scores, 5)),
    ndcg10: round(ndcgAtK(scores, 10)),
  };

  // ATS score distribution
  const atsScores = resumes
    .map((r) => r.atsScore)
    .filter((s): s is number => s !== null);
  
  const atsDistribution = computeAtsDistribution(atsScores);
  const averageAtsScore =
    atsScores.length > 0
      ? round(atsScores.reduce((a, b) => a + b, 0) / atsScores.length)
      : null;

  return {
    userId,
    metrics,
    semanticMatches: semanticMatches.length,
    keywordMatches: keywordMatches.length,
    averageAtsScore,
    resumeCount: resumes.length,
    atsDistribution,
  };
}

/**
 * Run evaluation across all users who have matches.
 */
export async function runGlobalEvaluation(): Promise<{
  userResults: EvaluationResult[];
  aggregated: {
    avgPrecision5: number;
    avgRecall5: number;
    avgNdcg5: number;
    avgAtsScore: number | null;
    totalSemanticMatches: number;
    totalKeywordMatches: number;
    totalUsers: number;
  };
}> {
  // Find all users who have matches
  const usersWithMatches = await prisma.jobMatch.findMany({
    distinct: ["userId"],
    select: { userId: true },
  });

  const userResults: EvaluationResult[] = [];
  for (const { userId } of usersWithMatches) {
    const result = await runEvaluation(userId);
    userResults.push(result);
  }

  // Aggregate
  const n = userResults.length || 1;
  const totalSemantic = userResults.reduce((s, r) => s + r.semanticMatches, 0);
  const totalKeyword = userResults.reduce((s, r) => s + r.keywordMatches, 0);
  const atsScores = userResults
    .map((r) => r.averageAtsScore)
    .filter((s): s is number => s !== null);

  return {
    userResults,
    aggregated: {
      avgPrecision5: round(userResults.reduce((s, r) => s + r.metrics.precision5, 0) / n),
      avgRecall5: round(userResults.reduce((s, r) => s + r.metrics.recall5, 0) / n),
      avgNdcg5: round(userResults.reduce((s, r) => s + r.metrics.ndcg5, 0) / n),
      avgAtsScore:
        atsScores.length > 0
          ? round(atsScores.reduce((a, b) => a + b, 0) / atsScores.length)
          : null,
      totalSemanticMatches: totalSemantic,
      totalKeywordMatches: totalKeyword,
      totalUsers: userResults.length,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function computeAtsDistribution(
  scores: number[],
): { bucket: string; count: number }[] {
  const buckets = [
    { bucket: "0-20", min: 0, max: 20 },
    { bucket: "21-40", min: 21, max: 40 },
    { bucket: "41-60", min: 41, max: 60 },
    { bucket: "61-80", min: 61, max: 80 },
    { bucket: "81-100", min: 81, max: 100 },
  ];

  return buckets.map((b) => ({
    bucket: b.bucket,
    count: scores.filter((s) => s >= b.min && s <= b.max).length,
  }));
}
