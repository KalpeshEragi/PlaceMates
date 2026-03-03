import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { syncGithubRepos, analyzeGithubRepos, getGithubInsights } from "../controllers/githubController";

const router = Router();

// GET /api/github/insights
router.get("/insights", requireAuth, getGithubInsights);

// POST /api/github/sync
router.post("/sync", requireAuth, syncGithubRepos);

// POST /api/github/analyze
router.post("/analyze", requireAuth, analyzeGithubRepos);

export default router;

