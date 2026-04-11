import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getAnalyzedProjects,
  getProjectCandidates,
  getSelectedProjects,
  selectPortfolioProjects,
  batchFinalizeProjects,
  updateProjectImpact,
} from "../controllers/projectsController";

const projectsRouter = Router();

projectsRouter.get("/candidates", requireAuth, getProjectCandidates);
projectsRouter.get("/selected", requireAuth, getSelectedProjects);
projectsRouter.post("/select", requireAuth, selectPortfolioProjects);

projectsRouter.get("/analyzed", requireAuth, getAnalyzedProjects);
projectsRouter.post("/batch-finalize", requireAuth, batchFinalizeProjects);
projectsRouter.post("/:id/update-impact", requireAuth, updateProjectImpact);

export default projectsRouter;
