/**
 * integrationsController.ts
 *
 * Routes:
 *   GET /api/integrations/status — return connection + data-readiness state
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

export async function getIntegrationStatus(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await prisma.userAuth.findUnique({
      where: { id: req.userId },
      select: {
        githubConnected: true,
        githubLogin: true,
        linkedinImported: true,
        onboardingStage: true,
        _count: {
          select: {
            projects: true,
            skills: true,
            experiences: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({
      githubConnected: user.githubConnected,
      githubLogin: user.githubLogin ?? null,
      linkedinImported: user.linkedinImported,
      onboardingStage: user.onboardingStage,
      dataSummary: {
        projects: user._count.projects,
        skills: user._count.skills,
        experiences: user._count.experiences,
      },
    });
  } catch (error) {
    console.error("[Integrations] Status fetch failed:", error);
    return res.status(500).json({ error: "Failed to fetch integration status." });
  }
}