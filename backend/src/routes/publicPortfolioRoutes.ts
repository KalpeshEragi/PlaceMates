import { Router } from "express";
import { getPublicPortfolio } from "../controllers/publicPortfolioController";

const router = Router();

// GET /api/portfolio/:slug  (public, no auth)
router.get("/:slug", getPublicPortfolio);

export default router;
