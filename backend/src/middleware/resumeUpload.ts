import multer from "multer";
import fs from "fs";
import path from "path";
import type { AuthRequest } from "./auth";

const uploadDir = path.resolve(process.cwd(), "uploads", "resume-jd");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req: AuthRequest, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.userId}-${Date.now()}${extension}`);
  },
});

const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);

function jdFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMETYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
    return cb(null, true);
  }
  return cb(new Error("Only PDF, DOCX, and TXT files are allowed"));
}

export const resumeJdUpload = multer({
  storage,
  fileFilter: jdFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});
