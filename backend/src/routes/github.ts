import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  syncGithubRepos,
  analyzeGithubRepos,
  getGithubData,
} from "../controllers/githubController";
 
const githubRouter = Router();
 
// POST /api/github/sync    — pull repos from GitHub API
githubRouter.post("/sync", requireAuth, syncGithubRepos);
 
// POST /api/github/analyze — run analysis pipeline (async, returns 202)
githubRouter.post("/analyze", requireAuth, analyzeGithubRepos);
 
// GET  /api/github/data    — return Projects + Skills from DB
githubRouter.get("/data", requireAuth, getGithubData);
 
export default githubRouter;