import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { triggerMatching } from "../controllers/jobsController";

const router = Router();

// ── User-facing routes (require JWT auth) ─────────────────
router.post("/trigger-matching", requireAuth, triggerMatching);

export default router;
