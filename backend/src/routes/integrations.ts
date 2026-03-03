import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getIntegrationStatus } from "../controllers/integrationsController";

const router = Router();

router.get("/status", requireAuth, getIntegrationStatus);

export default router;
