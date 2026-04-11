import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  saveTemplate,
  getPortfolio,
  getPreviewData,
  finalizeOutput,
} from "../controllers/userController";

const userRouter = Router();

// POST /api/user/template  — save template preferences
userRouter.post("/template", requireAuth, saveTemplate);

// GET  /api/user/portfolio — return portfolio URL
userRouter.get("/portfolio", requireAuth, getPortfolio);

// GET /api/user/preview-data — authenticated full preview payload
userRouter.get("/preview-data", requireAuth, getPreviewData);

// POST /api/user/finalize-output — persist edited output + templates
userRouter.post("/finalize-output", requireAuth, finalizeOutput);

export default userRouter;
