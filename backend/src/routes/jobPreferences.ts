import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getJobPreferences,
  createOrUpdateJobPreferences,
} from "../controllers/jobPreferencesController";

const router = Router();

// All routes require authentication
router.use(requireAuth);

router.get("/", getJobPreferences);
router.post("/", createOrUpdateJobPreferences);

export default router;