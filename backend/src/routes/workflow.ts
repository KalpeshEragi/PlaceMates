import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validateN8nCallback } from "../middleware/validateRequest";
import {
  triggerWorkflow,
  receiveResults,
  getStatus,
  getMyMatches,
  saveJobs,
} from "../controllers/workflowController";

const router = Router();

// ── User-facing routes (require JWT auth) ─────────────────
router.post("/trigger", requireAuth, triggerWorkflow);
router.get("/status/:userId", requireAuth, getStatus);
router.get("/my-matches", requireAuth, getMyMatches);

// ── n8n callback route (requires shared secret, NOT JWT) ──
router.post("/n8n-result", validateN8nCallback, receiveResults);
router.post("/save-jobs", validateN8nCallback, saveJobs);

export default router;

