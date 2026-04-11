import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getProfileInsights,
  getProfileData,
  updateProfileData,
} from "../controllers/profileController";

const profileRouter = Router();

// GET /api/profile/insights — computed profile insights
profileRouter.get("/insights", requireAuth, getProfileInsights);

// GET /api/profile/data — editable profile payload
profileRouter.get("/data", requireAuth, getProfileData);

// PUT /api/profile/data — save profile edits
profileRouter.put("/data", requireAuth, updateProfileData);

export default profileRouter;
