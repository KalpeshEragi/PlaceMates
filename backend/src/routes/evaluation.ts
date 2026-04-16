import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  runUserEvaluation,
  getGlobalEvaluation,
} from "../controllers/evaluationController";

const router = Router();

// Protected endpoints (require JWT)
router.post("/run", requireAuth, runUserEvaluation);
router.get("/results", requireAuth, getGlobalEvaluation);

export default router;
