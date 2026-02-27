// ────────────────────────────────────────────────────────────
// Profile Routes — Smart Profile Generation
// ────────────────────────────────────────────────────────────
//
// POST /api/profile/generate-smart
//   - Requires JWT auth
//   - Runs the full smart profile pipeline
//   - Returns generated profile JSON
// ────────────────────────────────────────────────────────────

import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { generateSmartProfile } from "../services/smartProfile.js";
import { processGitHubIntelligence } from "../services/githubIntelligence/index.js";
import { processLinkedInIntelligence } from "../services/linkedinIntelligence/index.js";

import { generateCareerIntelligence } from "../services/careerIntelligence/index.js";

const router = Router();

// ── POST /generate-smart ──────────────────────────────────

router.post(
    "/generate-smart",
    requireAuth,
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            console.log(`[Profile Route] Smart profile generation requested by user ${req.userId}`);

            const smartProfile = await generateSmartProfile(req.userId);

            return res.json({
                success: true,
                message: "Smart profile generated successfully",
                data: {
                    smartProfile,
                },
            });
        } catch (err) {
            console.error("[Profile Route] Smart profile generation failed:", err);

            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to generate smart profile";

            // Distinguish between user-facing errors and server errors
            const status = message.includes("not found") ? 404 : 500;

            return res.status(status).json({
                success: false,
                error: message,
            });
        }
    }
);

// ── POST /analyze-github ─────────────────────────────────

router.post(
    "/analyze-github",
    requireAuth,
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            console.log(`[Profile Route] GitHub analysis requested by user ${req.userId}`);

            const githubAnalysis = await processGitHubIntelligence(req.userId);

            return res.json({
                success: true,
                message: "GitHub intelligence analysis complete",
                data: {
                    githubAnalysis,
                },
            });
        } catch (err) {
            console.error("[Profile Route] GitHub analysis failed:", err);

            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to analyze GitHub profile";

            const status = message.includes("not found")
                ? 404
                : message.includes("No GitHub")
                    ? 400
                    : 500;

            return res.status(status).json({
                success: false,
                error: message,
            });
        }
    }
);

// ── POST /analyze-linkedin ───────────────────────────────

router.post(
    "/analyze-linkedin",
    requireAuth,
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            console.log(`[Profile Route] LinkedIn analysis requested by user ${req.userId}`);

            const linkedinInsights = await processLinkedInIntelligence(req.userId);

            return res.json({
                success: true,
                message: "LinkedIn intelligence analysis complete",
                data: {
                    linkedinInsights,
                },
            });
        } catch (err) {
            console.error("[Profile Route] LinkedIn analysis failed:", err);

            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to analyze LinkedIn profile";

            const status = message.includes("not found")
                ? 404
                : message.includes("No LinkedIn")
                    ? 400
                    : 500;

            return res.status(status).json({
                success: false,
                error: message,
            });
        }
    }
);

// ── POST /generate-intelligence ──────────────────────────

router.post(
    "/generate-intelligence",
    requireAuth,
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            console.log(`[Profile Route] Career intelligence generation requested by user ${req.userId}`);

            const careerIntelligence = await generateCareerIntelligence(req.userId);

            return res.json({
                success: true,
                message: "Career intelligence generated successfully",
                data: {
                    careerIntelligence,
                },
            });
        } catch (err) {
            console.error("[Profile Route] Career intelligence generation failed:", err);

            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to generate career intelligence";

            const status = message.includes("not found")
                ? 404
                : message.includes("No analysis")
                    ? 400
                    : 500;

            return res.status(status).json({
                success: false,
                error: message,
            });
        }
    }
);

export default router;

