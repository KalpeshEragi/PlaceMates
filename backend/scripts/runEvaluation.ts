/**
 * runEvaluation.ts
 *
 * Standalone CLI script to run the full research evaluation pipeline.
 *
 * Usage:
 *   npx tsx scripts/runEvaluation.ts
 *   npx tsx scripts/runEvaluation.ts --ablation
 *
 * Environment variables (optional):
 *   EVAL_USERS=10     Number of test users to evaluate
 *   EVAL_TOP_K=5      Top-K for precision calculation
 *   EVAL_ITERATIONS=3 Max iterations per resume
 *   USE_RAG=false      Disable RAG retrieval (ablation)
 *   USE_CRITIC=false   Disable critic agent (ablation)
 *   USE_ITERATION=false Disable multi-iteration (ablation)
 *
 * Output:
 *   - Console: formatted tables
 *   - File: evaluation-output/evaluation-results.json
 *   - File: evaluation-output/evaluation-results.log
 */

import dotenv from "dotenv";
dotenv.config();

import { generateEvaluationReport, runAblationStudy } from "../src/services/evaluation/researchEvaluationService";
import { logSection, logTable, writeJsonReport } from "../src/services/evaluation/evaluationLogger";

// ── Main ───────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const runAblation = args.includes("--ablation");

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║    PlaceMates — Research Evaluation Pipeline         ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  try {
    if (runAblation) {
      // ── Ablation mode ──────────────────────────────────────
      console.log("Mode: ABLATION STUDY\n");

      const ablationResults = await runAblationStudy();

      logSection("Ablation Study Results");

      const withData = ablationResults.filter((a) => a.sampleCount > 0);
      if (withData.length > 0) {
        logTable(
          ["Mode", "Avg Final Score", "Avg Improvement", "Avg Iterations", "Samples"],
          withData.map((a) => [
            a.mode,
            a.avgFinalScore.toFixed(1),
            `+${a.avgImprovement.toFixed(1)}`,
            a.avgIterations.toFixed(1),
            a.sampleCount.toString(),
          ]),
        );
      } else {
        console.log("\n  No ablation data found in database.");
        console.log("  To generate ablation data, run the RAG pipeline with different");
        console.log("  env flag combinations (USE_RAG=false, USE_CRITIC=false, etc.)");
        console.log("  and store results via POST /api/evaluation/store\n");
      }

      writeJsonReport({ ablation: ablationResults }, "ablation-results.json");
    } else {
      // ── Full evaluation ────────────────────────────────────
      console.log("Mode: FULL EVALUATION\n");

      const { report, jsonPath } = await generateEvaluationReport();

      console.log("\n");
      console.log("════════════════════════════════════════════════════════");
      console.log("  EVALUATION COMPLETE");
      console.log("════════════════════════════════════════════════════════");
      console.log("");

      // Print quick summary for copy-paste into paper
      logSection("Paper-Ready Summary");

      console.log(`
  Semantic Matching:
    Precision@${report.config.topK}: ${report.matching.precision_semantic.toFixed(4)}

  Keyword Matching (Baseline):
    Precision@${report.config.topK}: ${report.matching.precision_keyword.toFixed(4)}

  Resume Generation:
    Base ATS Score (avg):  ${report.resume.avg_base_score}
    Final ATS Score (avg): ${report.resume.avg_final_score}
    Improvement (avg):     +${report.resume.avg_improvement}
    Iterations (avg):      ${report.resume.avg_iterations}

  Users Evaluated: ${report.perUser.length}
  Report saved to: ${jsonPath}
`);
    }
  } catch (error: any) {
    console.error("\n❌ Evaluation failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Ensure Prisma disconnects
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  }

  process.exit(0);
}

main();
