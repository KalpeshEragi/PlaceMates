import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAllResumes } from "../controllers/adminController.js";

const router = Router();

// For simplicity in this project, just requiring standard auth. 
// In production, we could check for an 'admin' role.
router.get("/all-resumes", requireAuth, getAllResumes);

export default router;
