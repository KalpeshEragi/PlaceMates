import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { syncGithubRepos, analyzeGithubRepos, getGithubInsights, getGithubData, getGithubActivity } from "../controllers/githubController";

const router = Router();

// GET /api/github/insights
router.get("/insights", requireAuth, getGithubInsights);

// GET /api/github/activity — radar + pie chart activity data
router.get("/activity", requireAuth, getGithubActivity);

// POST /api/github/sync
router.post("/sync", requireAuth, syncGithubRepos);

// POST /api/github/analyze
router.post("/analyze", requireAuth, analyzeGithubRepos);

// GET /api/github/data — debug endpoint to view all stored GitHub data
router.get("/data", requireAuth, getGithubData);

export default router;

