import { Router } from "express";
import { validateInternalApiKey } from "../middleware/validateInternalApiKey";
import {
  getUserFullProfile,
  generateResume,
  n8nCallback,
  triggerPlacemate,
  bulkUpsertJobs,
  getEligibleUsers,
  semanticMatchForN8n,
} from "../controllers/internalController";

const router = Router();

// All internal routes are protected by X-API-Key header validation
router.use(validateInternalApiKey);

// ── Internal endpoints (called by n8n / internal services) ──
router.get("/user-full-profile/:userId", getUserFullProfile);
router.post("/generate-resume", generateResume);
router.post("/n8n-callback", n8nCallback);
router.post("/trigger-placemate", triggerPlacemate);
router.post("/jobs/bulk-upsert", bulkUpsertJobs);
// ── Phase 4: New semantic endpoints ──
router.get("/eligible-users", getEligibleUsers);
router.post("/semantic-match", semanticMatchForN8n);

export default router;
