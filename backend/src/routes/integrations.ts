import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getIntegrationStatus } from "../controllers/integrationsController";
 
const integrationsRouter = Router();
 
// GET /api/integrations/status
integrationsRouter.get("/status", requireAuth, getIntegrationStatus);
 
export default integrationsRouter;