import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { linkedinUpload } from "../middleware/linkedinUpload";
import { uploadLinkedinZip } from "../controllers/linkedinController";

const router = Router();

router.post("/upload", requireAuth, (req, res, next) => {
  linkedinUpload.single("file")(req, res, (error: unknown) => {
    if (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid upload",
      });
    }

    return next();
  });
}, uploadLinkedinZip);

export default router;
