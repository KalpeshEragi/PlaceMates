/**
 * resume.ts
 *
 * Routes for the "Upload Resume" onboarding flow.
 *
 *   POST /api/resume/upload   — upload a PDF resume
 *   POST /api/resume/analyze  — trigger LLM extraction pipeline
 *   GET  /api/resume/data     — retrieve extracted resume data
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { resumeUpload } from "../middleware/resumeUpload";
import {
  uploadResume,
  analyzeResume,
  getResumeData,
} from "../controllers/resumeController";

const resumeRouter = Router();

// POST /api/resume/upload
resumeRouter.post(
  "/upload",
  requireAuth,
  (req, res, next) => {
    resumeUpload.single("file")(req, res, (err: unknown) => {
      if (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Invalid file upload",
        });
      }
      return next();
    });
  },
  uploadResume,
);

// POST /api/resume/analyze — async pipeline, returns 202
resumeRouter.post("/analyze", requireAuth, analyzeResume);

// GET /api/resume/data
resumeRouter.get("/data", requireAuth, getResumeData);

export default resumeRouter;
