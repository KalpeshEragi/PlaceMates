/**
 * resumeUpload.ts
 *
 * Multer configuration for resume PDF file uploads.
 * Mirrors the linkedinUpload.ts pattern — disk storage under uploads/resumes/.
 */

import multer from "multer";
import fs from "fs";
import path from "path";
import type { AuthRequest } from "./auth";

const uploadDir = path.resolve(process.cwd(), "uploads", "resumes");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req: AuthRequest, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.userId}-${Date.now()}${extension || ".pdf"}`);
  },
});

function pdfFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const isPdfMime = file.mimetype === "application/pdf";
  const isPdfName = file.originalname.toLowerCase().endsWith(".pdf");

  if (isPdfMime || isPdfName) {
    return cb(null, true);
  }

  return cb(new Error("Only PDF files are allowed"));
}

export const resumeUpload = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});
