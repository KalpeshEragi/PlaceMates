import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireStage } from "../middleware/onboardingGuard";
import { linkedinUpload } from "../middleware/linkedinUpload";
import {
  uploadLinkedinZip,
  analyzeLinkedin,
  getLinkedinData,
} from "../controllers/linkedinController";
 
const linkedinRouter = Router();
 
// POST /api/linkedin/upload
// Requires GitHub to be connected first (enforced by stage guard)
linkedinRouter.post(
  "/upload",
  requireAuth,
  requireStage("github_connected", "linkedin_imported"),
  (req, res, next) => {
    linkedinUpload.single("file")(req, res, (err: unknown) => {
      if (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Invalid file upload",
        });
      }
      return next();
    });
  },
  uploadLinkedinZip,
);
 
// POST /api/linkedin/analyze — async pipeline, returns 202
linkedinRouter.post(
  "/analyze",
  requireAuth,
  requireStage("linkedin_imported", "ready"),
  analyzeLinkedin,
);
 
// GET /api/linkedin/data
linkedinRouter.get("/data", requireAuth, getLinkedinData);
 
export default linkedinRouter;