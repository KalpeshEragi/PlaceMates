import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  runUserEvaluation,
  getGlobalEvaluation,
  runResearchEval,
  getEvaluationReport,
  runAblation,
  storeResumeEvaluation,
} from "../controllers/evaluationController";

const router = Router();

// ── Existing endpoints (require JWT) ──────────────────────
router.post("/run", requireAuth, runUserEvaluation);
router.get("/results", requireAuth, getGlobalEvaluation);

// ── Research evaluation endpoints ─────────────────────────
router.post("/research", requireAuth, runResearchEval);
router.get("/report", requireAuth, getEvaluationReport);
router.post("/ablation", requireAuth, runAblation);
router.post("/store", requireAuth, storeResumeEvaluation);

export default router;
