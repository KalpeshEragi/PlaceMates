import multer from "multer";
import fs from "fs";
import path from "path";
import type { AuthRequest } from "./auth";

const uploadDir = path.resolve(process.cwd(), "uploads", "linkedin");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req: AuthRequest, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.userId}-${Date.now()}${extension || ".zip"}`);
  },
});

function zipFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const isZipMime =
    file.mimetype === "application/zip" ||
    file.mimetype === "application/x-zip-compressed";
  const isZipName = file.originalname.toLowerCase().endsWith(".zip");

  if (isZipMime || isZipName) {
    return cb(null, true);
  }

  return cb(new Error("Only ZIP files are allowed"));
}

export const linkedinUpload = multer({
  storage,
  fileFilter: zipFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
