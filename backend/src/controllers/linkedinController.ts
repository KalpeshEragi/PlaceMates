/**
 * linkedinController.ts
 *
 * Routes:
 *   POST /api/linkedin/upload   — accept ZIP, persist path, advance stage
 *   POST /api/linkedin/analyze  — run analysis pipeline (async)
 *   GET  /api/linkedin/data     — return stored Experience, Education, Awards,
 *                                 Certifications, and LinkedIn-sourced Skills
 */

import type { Response } from "express";
import path from "path";
import type { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { advanceStage, markReadyIfComplete } from "../middleware/onboardingGuard";
import { processLinkedinZip } from "../services/linkedinAnalysisService";

// ─── POST /api/linkedin/upload ───────────────────────────────

export async function uploadLinkedinZip(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  if (!req.file) {
    return res.status(400).json({ error: "No ZIP file uploaded." });
  }

  try {
    const relativePath = path.relative(process.cwd(), req.file.path);

    await prisma.userAuth.update({
      where: { id: req.userId },
      data: {
        linkedinImported: true,
        linkedinZipPath: relativePath,
      },
    });

    await advanceStage(req.userId, "linkedin_imported");

    return res.status(200).json({
      success: true,
      message: "LinkedIn ZIP uploaded. Run /analyze to process it.",
    });
  } catch (error) {
    console.error("[LinkedIn] Upload failed:", error);
    return res.status(500).json({ error: "Failed to save LinkedIn ZIP." });
  }
}

// ─── POST /api/linkedin/analyze ──────────────────────────────
// Fires async — returns 202 immediately.

export async function analyzeLinkedin(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const userId = req.userId;

  processLinkedinZip(userId)
    .then(() => markReadyIfComplete(userId))
    .catch((err) => console.error("[LinkedIn] Analysis pipeline failed:", err));

  return res.status(202).json({
    success: true,
    status: "queued",
    message: "LinkedIn analysis started. Data will be available shortly.",
  });
}

// ─── GET /api/linkedin/data ───────────────────────────────────

export async function getLinkedinData(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [experiences, educations, awards, certifications, skills] =
      await Promise.all([
        prisma.experience.findMany({
          where: { userId: req.userId },
          orderBy: { startDate: "desc" },
          select: {
            id: true,
            role: true,
            company: true,
            startDate: true,
            endDate: true,
            description: true,
          },
        }),

        prisma.education.findMany({
          where: { userId: req.userId },
          select: {
            id: true,
            institution: true,
            degree: true,
            field: true,
            startDate: true,
            endDate: true,
            gpa: true,
          },
        }),

        prisma.award.findMany({
          where: { userId: req.userId },
          select: { id: true, title: true, description: true, issuedAt: true },
        }),

        prisma.certification.findMany({
          where: { userId: req.userId },
          select: { id: true, name: true, issuer: true, issuedAt: true },
        }),

        prisma.skill.findMany({
          where: { userId: req.userId, source: { in: ["linkedin", "both"] } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, domain: true, source: true },
        }),
      ]);

    return res.status(200).json({
      experiences,
      educations,
      awards,
      certifications,
      skills,
    });
  } catch (error) {
    console.error("[LinkedIn] Failed to fetch data:", error);
    return res.status(500).json({ error: "Failed to fetch LinkedIn data." });
  }
}