/**
 * researchEvaluationService.ts
 *
 * Research Evaluation: Core evaluation engine + report generator.
 *
 * Orchestrates the full research evaluation pipeline:
 *   1. Fetches test users
 *   2. Runs semantic vs keyword matching comparison
 *   3. Aggregates resume ATS scores from ResumeEvaluation table
 *   4. Supports ablation study
 *   5. Generates IEEE-paper-ready JSON + table output
 */

import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import {
  precisionAtK,
  recallAtK,
  ndcgAtK,
} from "./evaluationService";
import {
  matchJobsKeyword,
  evaluateMatching,
} from "./keywordMatchingService";
import {
  logEvalStart,
  logEvalComplete,
  logUserScore,
  logAblationMode,
  logSection,
  logTable,
  writeJsonReport,
} from "./evaluationLogger";

// ── Types ──────────────────────────────────────────────────

export interface UserEvalResult {
  userId: string;
  semantic: {
    matchCount: number;
    relevantCount: number;
    precisionAtK: number;
    recallAtK: number;
    ndcgAtK: number;
  };
  keyword: {
    matchCount: number;
    relevantCount: number;
    precisionAtK: number;
    recallAtK: number;
    ndcgAtK: number;
  };
  ats: {
    baseScore: number | null;
    draftScore: number | null;
    finalScore: number | null;
    iterationScores: number[];
    improvement: number | null;
  };
}

export interface AblationResult {
  mode: string;
  avgFinalScore: number;
  avgImprovement: number;
  avgIterations: number;
  sampleCount: number;
}

export interface EvaluationReport {
  config: {
    evalUsers: number;
    topK: number;
    iterations: number;
    timestamp: string;
  };
  matching: {
    precision_semantic: number;
    precision_keyword: number;
    recall_semantic: number;
    recall_keyword: number;
    ndcg_semantic: number;
    ndcg_keyword: number;
    semantic_match_count: number;
    keyword_match_count: number;
  };
  resume: {
    avg_base_score: number;
    avg_draft_score: number;
    avg_final_score: number;
    avg_improvement: number;
    avg_iterations: number;
    avg_improvement_per_iteration: number;
  };
  ablation: AblationResult[];
  perUser: UserEvalResult[];
}

// ── Main Evaluation Runner ─────────────────────────────────

/**
 * Run the full research evaluation pipeline.
 */
export async function runResearchEvaluation(): Promise<EvaluationReport> {
  const startTime = Date.now();
  const topK = env.EVAL_TOP_K;

  // Log start
  logEvalStart({
    evalUsers: env.EVAL_USERS,
    evalTopK: topK,
    evalIterations: env.EVAL_ITERATIONS,
    useRag: env.USE_RAG,
    useCritic: env.USE_CRITIC,
    useIteration: env.USE_ITERATION,
  });

  // ── 1. Fetch test users ──────────────────────────────────
  logSection("Fetching Test Users");

  const usersWithMatches = await prisma.jobMatch.findMany({
    distinct: ["userId"],
    select: { userId: true },
    take: env.EVAL_USERS,
  });

  const userIds = usersWithMatches.map((u) => u.userId);
  console.log(`[EVAL] Found ${userIds.length} users with matches`);

  // ── 2. Evaluate each user ────────────────────────────────
  logSection("Per-User Evaluation");

  const perUser: UserEvalResult[] = [];

  for (const userId of userIds) {
    const userResult = await evaluateUser(userId, topK);
    perUser.push(userResult);

    logUserScore({
      userId,
      semanticPrecision: userResult.semantic.precisionAtK,
      keywordPrecision: userResult.keyword.precisionAtK,
      baseScore: userResult.ats.baseScore,
      finalScore: userResult.ats.finalScore,
    });
  }

  // ── 3. Aggregate metrics ─────────────────────────────────
  logSection("Aggregating Results");

  const matching = aggregateMatchingMetrics(perUser, topK);
  const resume = aggregateResumeMetrics(perUser);

  // ── 4. Fetch ablation results ────────────────────────────
  logSection("Ablation Analysis");

  const ablation = await computeAblationResults();

  // ── 5. Build report ──────────────────────────────────────
  const report: EvaluationReport = {
    config: {
      evalUsers: env.EVAL_USERS,
      topK,
      iterations: env.EVAL_ITERATIONS,
      timestamp: new Date().toISOString(),
    },
    matching,
    resume,
    ablation,
    perUser,
  };

  // ── 6. Output results ────────────────────────────────────
  logSection("Results Summary");
  printResultsTables(report);

  const durationMs = Date.now() - startTime;
  logEvalComplete(durationMs, userIds.length);

  return report;
}

// ── Per-User Evaluation ────────────────────────────────────

async function evaluateUser(userId: string, topK: number): Promise<UserEvalResult> {
  // --- Semantic matching data ---
  const semanticMatches = await prisma.jobMatch.findMany({
    where: { userId, matchMethod: "semantic" },
    orderBy: { matchScore: "desc" },
    select: { matchScore: true, semanticScore: true },
  });

  const semanticScores = semanticMatches.map(
    (m) => m.semanticScore ?? m.matchScore / 100,
  );

  const semanticEval = evaluateMatching(
    semanticScores.map((s) => ({ score: s })),
    topK,
    0.5,
  );

  const semanticRecall = recallAtK(semanticScores, 0.5, topK);
  const semanticNdcg = ndcgAtK(semanticScores, topK);

  // --- Keyword matching ---
  const keywordResults = await matchJobsKeyword(userId, topK);
  const keywordEval = evaluateMatching(keywordResults, topK, 0.3);
  
  const keywordScores = keywordResults.map((r) => r.score);
  const keywordRecall = recallAtK(keywordScores, 0.3, topK);
  const keywordNdcg = ndcgAtK(keywordScores, topK);

  // --- ATS scores from ResumeEvaluation ---
  const resumeEvals = await (prisma as any).resumeEvaluation.findMany({
    where: { userId, ablationMode: "full" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  let atsData: UserEvalResult["ats"] = {
    baseScore: null,
    draftScore: null,
    finalScore: null,
    iterationScores: [],
    improvement: null,
  };

  if (resumeEvals.length > 0) {
    const avgBase = avg(resumeEvals.map((e: any) => e.baseScore));
    const avgDraft = avg(resumeEvals.map((e: any) => e.draftScore));
    const avgFinal = avg(resumeEvals.map((e: any) => e.finalScore));

    // Merge all iteration scores from all evaluations
    const allIterScores = resumeEvals.flatMap((e: any) => e.iterationScores);

    atsData = {
      baseScore: Math.round(avgBase),
      draftScore: Math.round(avgDraft),
      finalScore: Math.round(avgFinal),
      iterationScores: allIterScores,
      improvement: Math.round(avgFinal - avgBase),
    };
  } else {
    // Fallback: use TailoredResume.atsScore if no evaluations exist
    const resumes = await prisma.tailoredResume.findMany({
      where: { userId },
      select: { atsScore: true, iterations: true },
    });

    if (resumes.length > 0) {
      const scores = resumes
        .map((r) => r.atsScore)
        .filter((s): s is number => s !== null);

      if (scores.length > 0) {
        const avgScore = avg(scores);
        atsData = {
          baseScore: null,
          draftScore: null,
          finalScore: Math.round(avgScore),
          iterationScores: scores,
          improvement: null,
        };
      }
    }
  }

  return {
    userId,
    semantic: {
      matchCount: semanticMatches.length,
      relevantCount: semanticEval.relevantCount,
      precisionAtK: semanticEval.precisionAtK,
      recallAtK: semanticRecall || 0,
      ndcgAtK: semanticNdcg || 0,
    },
    keyword: {
      matchCount: keywordResults.length,
      relevantCount: keywordEval.relevantCount,
      precisionAtK: keywordEval.precisionAtK,
      recallAtK: keywordRecall || 0,
      ndcgAtK: keywordNdcg || 0,
    },
    ats: atsData,
  };
}

// ── Aggregation Functions ──────────────────────────────────

function aggregateMatchingMetrics(
  results: UserEvalResult[],
  topK: number,
): EvaluationReport["matching"] {
  const n = results.length || 1;

  // Collect all semantic scores for NDCG/Recall calculation
  const allSemanticPrecisions = results.map((r) => r.semantic.precisionAtK);
  const allKeywordPrecisions = results.map((r) => r.keyword.precisionAtK);
  
  const allSemanticRecalls = results.map((r) => r.semantic.recallAtK);
  const allKeywordRecalls = results.map((r) => r.keyword.recallAtK);
  
  const allSemanticNdcgs = results.map((r) => r.semantic.ndcgAtK);
  const allKeywordNdcgs = results.map((r) => r.keyword.ndcgAtK);

  return {
    precision_semantic: round(avg(allSemanticPrecisions)),
    precision_keyword: round(avg(allKeywordPrecisions)),
    recall_semantic: round(avg(allSemanticRecalls)),
    recall_keyword: round(avg(allKeywordRecalls)),
    ndcg_semantic: round(avg(allSemanticNdcgs)),
    ndcg_keyword: round(avg(allKeywordNdcgs)),
    semantic_match_count: results.reduce((s, r) => s + r.semantic.matchCount, 0),
    keyword_match_count: results.reduce((s, r) => s + r.keyword.matchCount, 0),
  };
}

function aggregateResumeMetrics(
  results: UserEvalResult[],
): EvaluationReport["resume"] {
  const withAts = results.filter((r) => r.ats.finalScore !== null);
  const n = withAts.length || 1;

  const baseScores = withAts
    .map((r) => r.ats.baseScore)
    .filter((s): s is number => s !== null);
  const draftScores = withAts
    .map((r) => r.ats.draftScore)
    .filter((s): s is number => s !== null);
  const finalScores = withAts
    .map((r) => r.ats.finalScore)
    .filter((s): s is number => s !== null);
  const improvements = withAts
    .map((r) => r.ats.improvement)
    .filter((s): s is number => s !== null);

  const avgBase = baseScores.length > 0 ? avg(baseScores) : 0;
  const avgDraft = draftScores.length > 0 ? avg(draftScores) : 0;
  const avgFinal = finalScores.length > 0 ? avg(finalScores) : 0;
  const avgImprovement = improvements.length > 0 ? avg(improvements) : 0;

  // Compute average iterations from ResumeEvaluation data
  const allIterScores = withAts.flatMap((r) => r.ats.iterationScores);
  const avgIterations = allIterScores.length > 0
    ? allIterScores.length / n
    : env.EVAL_ITERATIONS;

  const avgImprovementPerIter = avgIterations > 0
    ? avgImprovement / avgIterations
    : 0;

  return {
    avg_base_score: round(avgBase),
    avg_draft_score: round(avgDraft),
    avg_final_score: round(avgFinal),
    avg_improvement: round(avgImprovement),
    avg_iterations: round(avgIterations),
    avg_improvement_per_iteration: round(avgImprovementPerIter),
  };
}

// ── Ablation Study ─────────────────────────────────────────

/**
 * Compute ablation results from stored ResumeEvaluation records.
 *
 * Groups evaluations by ablation_mode and computes aggregate metrics per mode.
 */
async function computeAblationResults(): Promise<AblationResult[]> {
  const modes = ["full", "no_rag", "no_critic", "no_iteration"];
  const results: AblationResult[] = [];

  for (const mode of modes) {
    const evals = await (prisma as any).resumeEvaluation.findMany({
      where: { ablationMode: mode },
      select: {
        baseScore: true,
        finalScore: true,
        iterationsUsed: true,
      },
    });

    if (evals.length === 0) {
      results.push({
        mode,
        avgFinalScore: 0,
        avgImprovement: 0,
        avgIterations: 0,
        sampleCount: 0,
      });
      continue;
    }

    const finalScores = evals.map((e: any) => e.finalScore);
    const improvements = evals.map((e: any) => e.finalScore - e.baseScore);
    const iterations = evals.map((e: any) => e.iterationsUsed);

    results.push({
      mode,
      avgFinalScore: round(avg(finalScores)),
      avgImprovement: round(avg(improvements)),
      avgIterations: round(avg(iterations)),
      sampleCount: evals.length,
    });

    logAblationMode(mode);
  }

  return results;
}

/**
 * Run the full evaluation under a specific ablation mode.
 * Temporarily sets env flags and runs the pipeline.
 */
export async function runAblationStudy(): Promise<AblationResult[]> {
  logSection("Running Ablation Study");

  // We read existing results from the database rather than
  // re-running the entire pipeline (which requires LLM calls).
  // To populate ablation data, run the RAG pipeline with different
  // env flag combinations, and the data will be stored automatically.

  return computeAblationResults();
}

// ── Report Generator ───────────────────────────────────────

/**
 * Generate the complete evaluation report.
 * This is the function users call from the CLI or API endpoint.
 */
export async function generateEvaluationReport(): Promise<{
  report: EvaluationReport;
  jsonPath: string;
}> {
  const report = await runResearchEvaluation();
  const jsonPath = writeJsonReport(report);

  return { report, jsonPath };
}

// ── Table Printer ──────────────────────────────────────────

function printResultsTables(report: EvaluationReport): void {
  // Matching comparison table
  logTable(
    ["Method", "Precision@K", "Recall@K", "NDCG@K", "Match Count"],
    [
      [
        "Semantic",
        report.matching.precision_semantic.toFixed(4),
        report.matching.recall_semantic.toFixed(4),
        report.matching.ndcg_semantic.toFixed(4),
        report.matching.semantic_match_count.toString(),
      ],
      [
        "Keyword",
        report.matching.precision_keyword.toFixed(4),
        report.matching.recall_keyword.toFixed(4),
        report.matching.ndcg_keyword.toFixed(4),
        report.matching.keyword_match_count.toString(),
      ],
    ],
    "📊 JOB MATCHING COMPARISON",
  );

  // Resume score table
  logTable(
    ["Metric", "Score"],
    [
      ["Base Resume (avg)", report.resume.avg_base_score.toString()],
      ["First Draft (avg)", report.resume.avg_draft_score.toString()],
      ["Final Resume (avg)", report.resume.avg_final_score.toString()],
      ["Improvement (avg)", `+${report.resume.avg_improvement}`],
      ["Avg Iterations", report.resume.avg_iterations.toString()],
      ["Improvement/Iteration", report.resume.avg_improvement_per_iteration.toFixed(2)],
    ],
    "📊 RESUME GENERATION QUALITY",
  );

  // Ablation table (only if data exists)
  const ablationWithData = report.ablation.filter((a) => a.sampleCount > 0);
  if (ablationWithData.length > 0) {
    logTable(
      ["Mode", "Avg Final Score", "Avg Improvement", "Avg Iterations", "Samples"],
      ablationWithData.map((a) => [
        a.mode,
        a.avgFinalScore.toFixed(1),
        `+${a.avgImprovement.toFixed(1)}`,
        a.avgIterations.toFixed(1),
        a.sampleCount.toString(),
      ]),
      "📊 ABLATION STUDY",
    );
  }
}

// ── Helpers ────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
