/**
 * resumeController.ts
 *
 * Routes:
 *   POST /api/resume/upload   — accept PDF, persist path, mark resumeUploaded
 *   POST /api/resume/analyze  — run extraction pipeline (async)
 *   GET  /api/resume/data     — return extracted resume data
 */

import type { Response } from "express";
import path from "path";
import type { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { processResume } from "../services/ResumeExtractionService";

// ─── POST /api/resume/upload ─────────────────────────────────

export async function uploadResume(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  if (!req.file) {
    return res.status(400).json({ error: "No PDF file uploaded." });
  }

  try {
    const relativePath = path.relative(process.cwd(), req.file.path);

    await prisma.userAuth.update({
      where: { id: req.userId },
      data: {
        resumeUploaded: true,
        resumeFilePath: relativePath,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Resume uploaded. Run /analyze to extract and process it.",
    });
  } catch (error) {
    console.error("[Resume] Upload failed:", error);
    return res.status(500).json({ error: "Failed to save resume." });
  }
}

// ─── POST /api/resume/analyze ────────────────────────────────
// Fires async — returns 202 immediately.

export async function analyzeResume(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const userId = req.userId;

  // Verify the file has been uploaded
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: { resumeFilePath: true },
  });

  if (!user?.resumeFilePath) {
    return res.status(400).json({
      error: "No resume file found. Please upload a resume first.",
    });
  }

  await prisma.userAuth.update({
    where: { id: userId },
    data: { analysisStatus: "running" },
  });

  // Fire-and-forget (same pattern as LinkedIn analyze)
  processResume(userId).catch((err) =>
    console.error("[Resume] Extraction pipeline failed:", err),
  );

  return res.status(202).json({
    success: true,
    status: "queued",
    message: "Resume extraction started. Data will be available shortly.",
  });
}

// ─── GET /api/resume/data ────────────────────────────────────

export async function getResumeData(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [experiences, educations, certifications, skills, projects] =
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

        prisma.certification.findMany({
          where: { userId: req.userId },
          select: { id: true, name: true, issuer: true, issuedAt: true },
        }),

        prisma.skill.findMany({
          where: { userId: req.userId, source: { in: ["resume", "both"] } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, domain: true, source: true },
        }),

        prisma.project.findMany({
          where: {
            userId: req.userId,
            repoUrl: { startsWith: "resume://" },
          },
          select: {
            id: true,
            name: true,
            projectType: true,
            techStack: true,
            description: true,
          },
        }),
      ]);

    return res.status(200).json({
      experiences,
      educations,
      certifications,
      skills,
      projects,
    });
  } catch (error) {
    console.error("[Resume] Failed to fetch data:", error);
    return res.status(500).json({ error: "Failed to fetch resume data." });
  }
}
