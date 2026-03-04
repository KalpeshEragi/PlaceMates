import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { GitHubUnauthorizedError, syncUserGithubRepos } from "../services/githubService";
import { processUserGithubRepositories } from "../services/githubAnalysisService";
import { prisma } from "../lib/prisma";

export async function getGithubInsights(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [dashboardInsight, repositories] = await Promise.all([
      prisma.userDashboardInsight.findUnique({
        where: { userId: req.userId },
      }),
      prisma.githubRepository.findMany({
        where: { userId: req.userId },
        orderBy: { finalScore: "desc" },
        select: {
          id: true,
          name: true,
          repoUrl: true,
          description: true,
          language: true,
          stars: true,
          forks: true,
          totalLoc: true,
          detectedDomain: true,
          resumeScore: true,
          impactScore: true,
          finalScore: true,
          processedAt: true,
        },
      }),
    ]);

    return res.status(200).json({
      topProjects: dashboardInsight?.topProjects ?? [],
      topSkills: dashboardInsight?.topSkills ?? [],
      topDomains: dashboardInsight?.topDomains ?? [],
      repositories,
    });
  } catch (error) {
    console.error("Failed to fetch GitHub insights:", error);
    return res.status(500).json({
      error: "insights_fetch_failed",
      message: "Failed to fetch GitHub insights. Please try again later.",
    });
  }
}


export async function syncGithubRepos(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { syncedCount } = await syncUserGithubRepos(req.userId);

    return res.status(200).json({
      success: true,
      syncedCount,
    });
  } catch (error) {
    if (error instanceof GitHubUnauthorizedError) {
      return res.status(401).json({
        error: "github_token_expired",
        message: "Your GitHub connection has expired. Please reconnect GitHub.",
      });
    }

    console.error("Failed to sync GitHub repos:", error);
    return res.status(500).json({
      error: "github_sync_failed",
      message: "Failed to sync GitHub repositories. Please try again later.",
    });
  }
}

export async function analyzeGithubRepos(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }


  processUserGithubRepositories(req.userId).catch((err) => {
    console.error("GitHub repo analysis failed:", err);
  });

  return res.status(202).json({
    success: true,
    status: "queued",
    message: "Repository analysis started. Insights will be available shortly.",
  });
}

