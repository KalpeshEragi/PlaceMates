import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import {
  uploadProfileImage,
  uploadProjectImage,
} from "../controllers/uploadController";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed."));
    }
  },
});

const uploadRouter = Router();

// POST /api/upload/profile-image
uploadRouter.post("/profile-image", requireAuth, upload.single("image"), uploadProfileImage);

// POST /api/upload/project-image/:projectId
uploadRouter.post("/project-image/:projectId", requireAuth, upload.single("image"), uploadProjectImage);

export default uploadRouter;
