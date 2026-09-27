import { Router } from "express";
import { getInsights } from "../controllers/insightsController.js";

const router = Router();

// ── Public market insights (no auth required) ─────────────
router.get("/", getInsights);

export default router;
