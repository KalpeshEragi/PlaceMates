/**
 * githubController.ts
 *
 * Routes:
 *   POST /api/github/sync     — fetch all repos from GitHub API and score them
 *   POST /api/github/analyze  — run analysis pipeline (async): projects + skills
 *   GET  /api/github/data     — return stored Projects and Skills for this user
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { GitHubUnauthorizedError, syncUserGithubRepos } from "../services/githubService";
import { processUserGithubRepositories } from "../services/githubAnalysisService";
import { prisma } from "../lib/prisma";

// ─── POST /api/github/sync ───────────────────────────────────

export async function syncGithubRepos(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { syncedCount } = await syncUserGithubRepos(req.userId);

    return res.status(200).json({
      success: true,
      syncedCount,
      message: `${syncedCount} repositories synced.`,
    });
  } catch (error) {
    if (error instanceof GitHubUnauthorizedError) {
      return res.status(401).json({
        error: "github_token_expired",
        message: "GitHub connection expired. Please reconnect.",
      });
    }

    console.error("[GitHub] Sync failed:", error);
    return res.status(500).json({
      error: "github_sync_failed",
      message: "Failed to sync repositories. Please try again.",
    });
  }
}

// ─── POST /api/github/analyze ────────────────────────────────
// Fires async — returns 202 immediately.

export async function analyzeGithubRepos(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const userId = req.userId;

  // Mark analysis as running
  await prisma.userAuth.update({
    where: { id: userId },
    data: { analysisStatus: "running", analysisError: null },
  });

  // Fire and forget — track success/failure via DB
  processUserGithubRepositories(userId)
    .then(async () => {
      await prisma.userAuth.update({
        where: { id: userId },
        data: { analysisStatus: "success", analysisError: null },
      });
      console.log(`[GitHub] Analysis completed for user ${userId}`);
    })
    .catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[GitHub] Analysis pipeline failed for user ${userId}:`, message);
      await prisma.userAuth.update({
        where: { id: userId },
        data: { analysisStatus: "failed", analysisError: message },
      });
    });

  return res.status(202).json({
    success: true,
    status: "running",
    message: "Analysis started. Projects and skills will be available shortly.",
  });
}

// ─── GET /api/github/data ─────────────────────────────────────

export async function getGithubData(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [projects, skills] = await Promise.all([
      prisma.project.findMany({
        where: { userId: req.userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          repoUrl: true,
          domain: true,
          projectType: true,
          collaborators: true,
          techStack: true,
          description: true,
          baseBullets: true,
          finalBullets: true,
          updatedAt: true,
        },
      }),

      prisma.skill.findMany({
        where: { userId: req.userId, source: { in: ["github", "both"] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, domain: true, source: true },
      }),
    ]);

    return res.status(200).json({ projects, skills });
  } catch (error) {
    console.error("[GitHub] Failed to fetch data:", error);
    return res.status(500).json({ error: "Failed to fetch GitHub data." });
  }
}