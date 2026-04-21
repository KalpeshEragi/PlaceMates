/**
 * evaluationController.ts
 *
 * Phase 8: Evaluation endpoints for research metrics.
 *
 * Endpoints:
 *   POST /api/evaluation/run       — Run evaluation for authenticated user
 *   GET  /api/evaluation/results   — Get global evaluation results (all users)
 *   POST /api/evaluation/research  — Run full research evaluation pipeline
 *   GET  /api/evaluation/report    — Get aggregated research report (JSON)
 *   POST /api/evaluation/ablation  — Run ablation study
 *   POST /api/evaluation/store     — Store a resume evaluation record
 */

import { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import {
  runEvaluation,
  runGlobalEvaluation,
} from "../services/evaluation/evaluationService";
import {
  runResearchEvaluation,
  generateEvaluationReport,
  runAblationStudy,
} from "../services/evaluation/researchEvaluationService";
import { prisma } from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// POST /api/evaluation/run
// Run evaluation for the authenticated user
// ─────────────────────────────────────────────────────────────
export const runUserEvaluation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const result = await runEvaluation(userId);
    return res.json({ success: true, evaluation: result });
  } catch (error) {
    console.error("[runUserEvaluation] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evaluation/results
// Get global evaluation results (all users)
// ─────────────────────────────────────────────────────────────
export const getGlobalEvaluation = async (req: Request, res: Response) => {
  try {
    const result = await runGlobalEvaluation();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[getGlobalEvaluation] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/evaluation/research
// Run the full research evaluation pipeline (semantic vs keyword,
// ATS score tracking, ablation aggregation)
// ─────────────────────────────────────────────────────────────
export const runResearchEval = async (req: Request, res: Response) => {
  try {
    console.log("[Evaluation] Starting research evaluation pipeline...");
    const report = await runResearchEvaluation();
    return res.json({ success: true, report });
  } catch (error) {
    console.error("[runResearchEval] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evaluation/report
// Generate and return the full evaluation report as JSON
// (also writes to evaluation-output/evaluation-results.json)
// ─────────────────────────────────────────────────────────────
export const getEvaluationReport = async (req: Request, res: Response) => {
  try {
    console.log("[Evaluation] Generating evaluation report...");
    const { report, jsonPath } = await generateEvaluationReport();
    return res.json({
      success: true,
      report,
      jsonPath,
    });
  } catch (error) {
    console.error("[getEvaluationReport] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/evaluation/ablation
// Run ablation study — computes metrics per ablation mode
// ─────────────────────────────────────────────────────────────
export const runAblation = async (req: Request, res: Response) => {
  try {
    console.log("[Evaluation] Running ablation study...");
    const results = await runAblationStudy();
    return res.json({ success: true, ablation: results });
  } catch (error) {
    console.error("[runAblation] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/evaluation/store
// Store a resume evaluation record (called after RAG pipeline
// completes to persist per-run scores for research analysis)
//
// Body: { userId, jobId, baseScore, draftScore, finalScore,
//         iterationScores, iterationsUsed, ablationMode }
// ─────────────────────────────────────────────────────────────
export const storeResumeEvaluation = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      jobId,
      baseScore,
      draftScore,
      finalScore,
      iterationScores,
      iterationsUsed,
      ablationMode,
    } = req.body;

    if (!userId || !jobId || baseScore == null || finalScore == null) {
      return res.status(400).json({
        success: false,
        message: "userId, jobId, baseScore, and finalScore are required",
      });
    }

    const evaluation = await (prisma as any).resumeEvaluation.create({
      data: {
        userId,
        jobId,
        baseScore: Math.round(baseScore),
        draftScore: Math.round(draftScore ?? baseScore),
        finalScore: Math.round(finalScore),
        iterationScores: iterationScores ?? [],
        iterationsUsed: iterationsUsed ?? 1,
        ablationMode: ablationMode ?? "full",
      },
    });

    console.log(
      `[Evaluation] Stored resume evaluation: user=${userId.slice(0, 8)}... ` +
      `base=${baseScore} → final=${finalScore} (${ablationMode ?? "full"})`
    );

    return res.json({ success: true, evaluation });
  } catch (error) {
    console.error("[storeResumeEvaluation] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
