/**
 * onboardingGuard.ts
 *
 * Simplified 4-stage state machine:
 *   new → github_connected → linkedin_imported → ready
 *
 * "ready" is set automatically once both pipelines have run at least once.
 */

import type { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "./auth";

const STAGES = [
  "new",
  "github_connected",
  "linkedin_imported",
  "ready",
] as const;

export type OnboardingStage = (typeof STAGES)[number];

function stageIndex(stage: string): number {
  return STAGES.indexOf(stage as OnboardingStage);
}

/**
 * Middleware: require the user to be at one of the given stages.
 *
 * Usage:
 *   router.post("/foo", requireAuth, requireStage("github_connected"), handler);
 */
export function requireStage(...allowed: OnboardingStage[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.userAuth.findUnique({
      where: { id: req.userId },
      select: { onboardingStage: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!allowed.includes(user.onboardingStage as OnboardingStage)) {
      return res.status(403).json({
        error: "Action not allowed at current onboarding stage",
        currentStage: user.onboardingStage,
        requiredStages: allowed,
      });
    }

    return next();
  };
}

/**
 * Advance a user's stage by exactly one step.
 * Silently succeeds if the user is already at or past the target.
 */
export async function advanceStage(
  userId: string,
  target: OnboardingStage,
): Promise<boolean> {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: { onboardingStage: true },
  });

  if (!user) return false;

  const currentIdx = stageIndex(user.onboardingStage);
  const targetIdx = stageIndex(target);

  if (targetIdx <= currentIdx) return true; // already there

  if (targetIdx !== currentIdx + 1) {
    console.warn(
      `[Onboarding] Blocked skip: ${user.onboardingStage} → ${target} for user ${userId}`,
    );
    return false;
  }

  await prisma.userAuth.update({
    where: { id: userId },
    data: { onboardingStage: target },
  });

  console.log(`[Onboarding] ${user.onboardingStage} → ${target} (user: ${userId})`);
  return true;
}

/**
 * Mark the user as fully ready once both pipelines have produced data.
 * Call this at the end of both analysis pipelines.
 */
export async function markReadyIfComplete(userId: string): Promise<void> {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: {
      onboardingStage: true,
      githubConnected: true,
      linkedinImported: true,
    },
  });

  if (!user) return;
  if (user.onboardingStage === "ready") return;

  if (user.githubConnected && user.linkedinImported) {
    await prisma.userAuth.update({
      where: { id: userId },
      data: { onboardingStage: "ready" },
    });
    console.log(`[Onboarding] User ${userId} marked as ready`);
  }
}