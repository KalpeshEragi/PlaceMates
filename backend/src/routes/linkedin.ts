// ────────────────────────────────────────────────────────────
// LinkedIn Import — Route
// ────────────────────────────────────────────────────────────
//
// POST /api/linkedin/import
//   - Requires JWT auth
//   - Accepts multipart/form-data with field "file" (ZIP)
//   - Max 50 MB
// ────────────────────────────────────────────────────────────

import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { processLinkedInZip } from "../services/linkedinImport.js";

const router = Router();

// ── Multer config ──────────────────────────────────────────

const storage = multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
        // Unique name to avoid collisions
        const unique = `linkedin-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB
    },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== ".zip") {
            return cb(new Error("Only .zip files are allowed"));
        }
        cb(null, true);
    },
});

// ── POST /import ───────────────────────────────────────────

router.post(
    "/import",
    requireAuth,
    (req, res, next) => {
        // Handle multer errors (file too large, wrong type, etc.)
        upload.single("file")(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(413).json({ error: "File too large. Max size is 50 MB." });
                }
                return res.status(400).json({ error: err.message });
            }
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            next();
        });
    },
    async (req: AuthRequest, res: Response) => {
        try {
            const file = (req as any).file as Express.Multer.File | undefined;

            if (!file) {
                return res.status(400).json({
                    error: "No file uploaded. Send a ZIP file in the 'file' field.",
                });
            }

            console.log(
                `[LinkedIn Import] Received ${file.originalname} (${(file.size / 1024).toFixed(1)} KB) from user ${req.userId}`
            );

            // Run the import pipeline
            const result = await processLinkedInZip(file.path, req.userId!);

            return res.json({
                success: true,
                message: "LinkedIn data imported successfully",
                data: {
                    profile: result.linkedInProfile,
                    stats: {
                        filesProcessed: result.filesProcessed.length,
                        filesSkipped: result.filesSkipped.length,
                        processedFiles: result.filesProcessed,
                        skippedFiles: result.filesSkipped,
                    },
                },
            });
        } catch (err) {
            console.error("[LinkedIn Import] Error:", err);

            const message =
                err instanceof Error ? err.message : "Failed to process LinkedIn data";

            return res.status(422).json({ error: message });
        }
    }
);

export default router;
