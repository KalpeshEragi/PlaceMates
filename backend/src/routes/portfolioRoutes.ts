import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createPortfolio } from "../controllers/portfolioController";

const router = Router();

// POST /api/portfolio/setup
router.post("/setup", requireAuth, createPortfolio);

export default router;
