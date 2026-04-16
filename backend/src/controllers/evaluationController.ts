/**
 * evaluationController.ts
 *
 * Phase 8: Evaluation endpoints for research metrics.
 */

import { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import {
  runEvaluation,
  runGlobalEvaluation,
} from "../services/evaluation/evaluationService";

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
