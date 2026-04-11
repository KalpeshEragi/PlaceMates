/**
 * profileController.ts
 *
 * Routes:
 *   GET  /api/profile/insights — computed profile insights (read-only)
 *   GET  /api/profile/data     — editable profile data
 *   PUT  /api/profile/data     — save profile edits
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { computeProfileInsights } from "../services/profileInsightsService";
import { inferSkillDomain } from "../services/analysis/domainDetector";

// ─── GET /api/profile/insights ──────────────────────────────

export async function getProfileInsights(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const insights = await computeProfileInsights(req.userId);
    return res.status(200).json(insights);
  } catch (error) {
    console.error("[Profile] insights failed:", error);
    return res.status(500).json({ error: "Failed to compute profile insights." });
  }
}

// ─── GET /api/profile/data ──────────────────────────────────

export async function getProfileData(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [userAuth, profile, summary, projects, skills, experiences, educations, awards, certifications] =
      await Promise.all([
        prisma.userAuth.findUnique({
          where: { id: req.userId },
          select: {
            email: true,
            githubLogin: true,
            githubConnected: true,
            linkedinImported: true,
          },
        }),
        prisma.userProfile.findUnique({
          where: { userId: req.userId },
          select: { name: true, avatarUrl: true, profileImageUrl: true },
        }),
        prisma.userSummary.findUnique({
          where: { userId: req.userId },
          select: { summaryText: true, primaryDomain: true },
        }),
        prisma.project.findMany({
          where: { userId: req.userId },
          orderBy: [{ rankingScore: "desc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            name: true,
            repoUrl: true,
            domain: true,
            projectType: true,
            techStack: true,
            description: true,
            finalBullets: true,
            baseBullets: true,
            rankingScore: true,
          },
        }),
        prisma.skill.findMany({
          where: { userId: req.userId },
          select: { id: true, name: true, domain: true, source: true },
        }),
        prisma.experience.findMany({
          where: { userId: req.userId },
          orderBy: { id: "asc" },
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
          orderBy: { id: "asc" },
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
      ]);

    if (!userAuth) return res.status(404).json({ error: "User not found." });

    return res.status(200).json({
      email: userAuth.email,
      githubLogin: userAuth.githubLogin,
      githubConnected: userAuth.githubConnected,
      linkedinImported: userAuth.linkedinImported,
      name: profile?.name ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      summary: summary?.summaryText ?? null,
      primaryDomain: summary?.primaryDomain ?? null,
      projects,
      skills,
      experiences,
      educations,
      awards,
      certifications,
    });
  } catch (error) {
    console.error("[Profile] data fetch failed:", error);
    return res.status(500).json({ error: "Failed to load profile data." });
  }
}

// ─── PUT /api/profile/data ──────────────────────────────────

type ExperienceInput = {
  id?: string;
  role: string;
  company: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
};

type EducationInput = {
  id?: string;
  institution: string;
  degree?: string | null;
  field?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  gpa?: string | null;
};

export async function updateProfileData(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body as {
    name?: string;
    summary?: string;
    skills?: string[];
    experiences?: ExperienceInput[];
    educations?: EducationInput[];
  };

  const userId = req.userId;

  try {
    await prisma.$transaction(async (tx) => {
      // ── Update name ──
      if (typeof body.name === "string") {
        await tx.userProfile.upsert({
          where: { userId },
          create: { userId, name: body.name.trim() || null },
          update: { name: body.name.trim() || null },
        });
      }

      // ── Update summary ──
      if (typeof body.summary === "string") {
        await tx.userSummary.upsert({
          where: { userId },
          create: { userId, summaryText: body.summary.trim() },
          update: { summaryText: body.summary.trim() },
        });
      }

      // ── Update skills (full replace) ──
      if (Array.isArray(body.skills)) {
        const skillNames = [...new Set(
          body.skills.map((s) => String(s).trim()).filter(Boolean),
        )];

        await tx.skill.deleteMany({ where: { userId } });

        if (skillNames.length > 0) {
          await tx.skill.createMany({
            data: skillNames.map((name) => ({
              userId,
              name,
              domain: inferSkillDomain(name),
              source: "github" as const,
            })),
          });
        }
      }

      // ── Update experiences (full replace) ──
      if (Array.isArray(body.experiences)) {
        await tx.experience.deleteMany({ where: { userId } });

        if (body.experiences.length > 0) {
          await tx.experience.createMany({
            data: body.experiences.map((e) => ({
              userId,
              role: e.role?.trim() ?? "Unknown Role",
              company: e.company?.trim() ?? "Unknown Company",
              startDate: e.startDate?.trim() || null,
              endDate: e.endDate?.trim() || null,
              description: e.description?.trim() || null,
            })),
          });
        }
      }

      // ── Update education (full replace) ──
      if (Array.isArray(body.educations)) {
        await tx.education.deleteMany({ where: { userId } });

        if (body.educations.length > 0) {
          await tx.education.createMany({
            data: body.educations.map((e) => ({
              userId,
              institution: e.institution?.trim() ?? "Unknown Institution",
              degree: e.degree?.trim() || null,
              field: e.field?.trim() || null,
              startDate: e.startDate?.trim() || null,
              endDate: e.endDate?.trim() || null,
              gpa: e.gpa?.trim() || null,
            })),
          });
        }
      }
    });

    return res.status(200).json({ success: true, message: "Profile updated." });
  } catch (error) {
    console.error("[Profile] update failed:", error);
    return res.status(500).json({ error: "Failed to update profile." });
  }
}
