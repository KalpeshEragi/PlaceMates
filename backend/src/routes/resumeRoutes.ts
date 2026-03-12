import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { resumeJdUpload } from "../middleware/resumeUpload";
import { analyzeJobDescription, getComparisonScores, getAtsScore, getUserData, improveText } from "../controllers/resumeController";

const router = Router();

// POST /api/resume/analyze-jd
// Accepts an optional file upload (pdf/docx/txt) and/or pasted text.
router.post(
  "/analyze-jd",
  requireAuth,
  (req, res, next) => {
    resumeJdUpload.single("file")(req, res, (error: unknown) => {
      if (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Invalid file upload",
        });
      }
      return next();
    });
  },
  analyzeJobDescription
);

// GET /api/resume/comparison-scores
// Returns per-project and per-experience relevance scores against the latest JD insight.
router.get("/comparison-scores", requireAuth, getComparisonScores);

// POST /api/resume/ats-score
// Evaluates a draft resume against the latest Job Description requirements
router.post("/ats-score", requireAuth, getAtsScore);

// GET /api/resume/user-data
// Returns all LinkedIn data for resume form autofill
router.get("/user-data", requireAuth, getUserData);

// POST /api/resume/improve-text
// Uses Gemini AI to rewrite a resume description to be professional and concise
router.post("/improve-text", requireAuth, improveText);

export default router;
