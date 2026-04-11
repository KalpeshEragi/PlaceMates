/**
 * userController.ts
 *
 * Routes:
 *   POST /api/user/template  — save chosen portfolio + resume template IDs
 *   GET  /api/user/portfolio — return the user's portfolio URL
 *   GET  /api/user/preview-data — full portfolio + resume payload for template preview
 *   POST /api/user/finalize-output — persist edited summary, bullets, skills, templates
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { buildUserOutputPayload } from "../services/userOutputPayload";

/** URL-safe slug; `portfolioSlug` is globally unique — avoid collisions across users. */
function sanitizePortfolioSlugPart(raw: string): string {
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s.slice(0, 48);
}

async function resolveUniquePortfolioSlug(base: string, userId: string): Promise<string> {
  let root = sanitizePortfolioSlugPart(base);
  if (!root) {
    root = `user-${userId.replace(/-/g, "").slice(0, 12)}`;
  }

  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const row = await prisma.userPortfolio.findUnique({
      where: { portfolioSlug: candidate },
      select: { userId: true },
    });
    if (!row || row.userId === userId) {
      return candidate;
    }
  }

  return `${root}-${userId.replace(/-/g, "").slice(0, 8)}`;
}

// ─── POST /api/user/template ─────────────────────────────────

export async function saveTemplate(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const { portfolioTemplate, resumeTemplate } = req.body;

  if (!portfolioTemplate || !resumeTemplate) {
    return res.status(400).json({
      error: "Both portfolioTemplate and resumeTemplate are required.",
    });
  }

  try {
    await prisma.userAuth.update({
      where: { id: req.userId },
      data: {
        portfolioTemplateId: portfolioTemplate,
        resumeTemplateId: resumeTemplate,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Template preferences saved.",
      portfolioTemplate,
      resumeTemplate,
    });
  } catch (error) {
    console.error("[User] Template save failed:", error);
    return res.status(500).json({ error: "Failed to save template preferences." });
  }
}

// ─── GET /api/user/portfolio ─────────────────────────────────

export async function getPortfolio(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Try to find existing portfolio
    const portfolio = await prisma.userPortfolio.findUnique({
      where: { userId: req.userId },
      select: { portfolioSlug: true },
    });

    if (portfolio) {
      const baseUrl = env.FRONTEND_URL || "http://localhost:3000";
      return res.status(200).json({
        portfolioUrl: `${baseUrl}/u/${portfolio.portfolioSlug}`,
      });
    }

    // If no portfolio yet, generate a slug from the user's profile or email
    const user = await prisma.userAuth.findUnique({
      where: { id: req.userId },
      select: {
        email: true,
        githubLogin: true,
        profile: { select: { name: true } },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const rawBase =
      user.githubLogin ||
      user.profile?.name?.toLowerCase().replace(/\s+/g, "-") ||
      user.email.split("@")[0] ||
      req.userId;

    const slug = await resolveUniquePortfolioSlug(rawBase, req.userId);

    // Create the portfolio record
    await prisma.userPortfolio.upsert({
      where: { userId: req.userId },
      create: {
        userId: req.userId,
        publicEmail: user.email,
        githubUrl: user.githubLogin
          ? `https://github.com/${user.githubLogin}`
          : null,
        portfolioSlug: slug,
      },
      update: {},
    });

    const baseUrl = env.FRONTEND_URL || "http://localhost:3000";
    return res.status(200).json({
      portfolioUrl: `${baseUrl}/u/${slug}`,
    });
  } catch (error) {
    console.error("[User] Portfolio fetch failed:", error);
    return res.status(500).json({ error: "Failed to fetch portfolio." });
  }
}

// ─── GET /api/user/preview-data ──────────────────────────────

export async function getPreviewData(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = await buildUserOutputPayload(req.userId);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[User] preview-data failed:", error);
    return res.status(500).json({ error: "Failed to load preview data." });
  }
}

// ─── POST /api/user/finalize-output ─────────────────────────

type FinalizeProjectInput = {
  id: string;
  finalBullets: string[];
  projectIntent?: string | null;
};

export async function finalizeOutput(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body as {
    portfolioTemplate?: string;
    resumeTemplate?: string;
    summary?: string;
    skills?: string[];
    projects?: FinalizeProjectInput[];
  };

  const { portfolioTemplate, resumeTemplate, summary, skills, projects } = body;

  if (!portfolioTemplate || !resumeTemplate || typeof summary !== "string") {
    return res.status(400).json({
      error: "portfolioTemplate, resumeTemplate, and summary are required.",
    });
  }

  if (!Array.isArray(projects) || projects.length === 0) {
    return res.status(400).json({ error: "projects must be a non-empty array." });
  }

  const skillNames = Array.isArray(skills)
    ? [...new Set(skills.map((s) => String(s).trim()).filter(Boolean))]
    : [];

  try {
    const userRow = await prisma.userAuth.findUnique({
      where: { id: userId },
      select: { selectedProjectIds: true },
    });
    const allowed = new Set(userRow?.selectedProjectIds ?? []);

    for (const p of projects) {
      if (!p.id || !Array.isArray(p.finalBullets)) {
        return res.status(400).json({ error: "Each project needs id and finalBullets array." });
      }
    }

    if (allowed.size > 0) {
      const incoming = new Set(projects.map((p) => p.id));
      if (incoming.size !== allowed.size || [...allowed].some((id) => !incoming.has(id))) {
        return res.status(400).json({
          error: "Include every selected project with finalBullets.",
        });
      }
    }

    const existing = await prisma.project.findMany({
      where: { userId, id: { in: projects.map((p) => p.id) } },
      select: { id: true },
    });
    if (existing.length !== projects.length) {
      return res.status(400).json({ error: "One or more project IDs are invalid." });
    }

    const existingSummary = await prisma.userSummary.findUnique({
      where: { userId },
      select: { primaryDomain: true },
    });

    await prisma.$transaction(
      async (tx) => {
        await tx.userAuth.update({
          where: { id: userId },
          data: {
            portfolioTemplateId: portfolioTemplate,
            resumeTemplateId: resumeTemplate,
            onboardingOutputFinalizedAt: new Date(),
          },
        });

        await tx.userSummary.upsert({
          where: { userId },
          create: {
            userId,
            summaryText: summary.trim(),
            primaryDomain: existingSummary?.primaryDomain ?? null,
          },
          update: { summaryText: summary.trim() },
        });

        for (const p of projects) {
          await tx.project.update({
            where: { id: p.id, userId },
            data: {
              finalBullets: p.finalBullets.map((b) => String(b).trim()).filter(Boolean),
              ...(typeof p.projectIntent === "string"
                ? { projectIntent: p.projectIntent.trim() || null }
                : {}),
            },
          });
        }

        await tx.skill.deleteMany({ where: { userId } });
        if (skillNames.length > 0) {
          await tx.skill.createMany({
            data: skillNames.map((name) => ({
              userId,
              name,
              domain: null,
              source: "github" as const,
            })),
          });
        }
      },
      { maxWait: 10000, timeout: 15000 },
    );

    const payload = await buildUserOutputPayload(userId);

    return res.status(200).json({
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error("[User] finalize-output failed:", error);
    return res.status(500).json({ error: "Failed to save final output." });
  }
}
