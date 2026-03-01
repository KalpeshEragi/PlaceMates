// ────────────────────────────────────────────────────────────
// Onboarding State Machine
// ────────────────────────────────────────────────────────────
//
// Allowed transitions:
//   new → github_connected → linkedin_imported
//       → data_processed → intelligence_ready
//
// Prevents skipping steps.
// ────────────────────────────────────────────────────────────

import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "./auth.js";

/**
 * Ordered onboarding stages.
 */
const STAGES = [
    "new",
    "github_connected",
    "linkedin_imported",
    "data_processed",
    "intelligence_ready",
] as const;

export type OnboardingStage = (typeof STAGES)[number];

/**
 * Get the index of a stage. Returns -1 for unknown stages.
 */
function stageIndex(stage: string): number {
    return STAGES.indexOf(stage as OnboardingStage);
}

/**
 * Middleware factory: require the user to be at one of the
 * given onboarding stage(s) before accessing this route.
 *
 * Usage:
 *   router.post("/foo", requireAuth, requireStage("github_connected", "linkedin_imported"), handler);
 */
export function requireStage(...allowedStages: OnboardingStage[]) {
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

        if (!allowedStages.includes(user.onboardingStage as OnboardingStage)) {
            return res.status(403).json({
                error: "Onboarding step not allowed at current stage",
                currentStage: user.onboardingStage,
                requiredStages: allowedStages,
            });
        }

        next();
    };
}

/**
 * Advance a user's onboarding stage if the transition is valid.
 * The target must be exactly one step ahead of the current stage.
 *
 * @returns `true` if the advance succeeded, `false` otherwise.
 */
export async function advanceStage(
    userId: string,
    targetStage: OnboardingStage
): Promise<boolean> {
    const user = await prisma.userAuth.findUnique({
        where: { id: userId },
        select: { onboardingStage: true },
    });

    if (!user) return false;

    const currentIdx = stageIndex(user.onboardingStage);
    const targetIdx = stageIndex(targetStage);

    // Allow advancing exactly one step, or staying at the same / later stage
    if (targetIdx <= currentIdx) {
        // Already at or past this stage — no-op success
        return true;
    }

    if (targetIdx !== currentIdx + 1) {
        console.warn(
            `[Onboarding] Blocked stage skip: ${user.onboardingStage} → ${targetStage} for user ${userId}`
        );
        return false;
    }

    await prisma.userAuth.update({
        where: { id: userId },
        data: { onboardingStage: targetStage },
    });

    console.log(
        `[Onboarding] Stage advanced: ${user.onboardingStage} → ${targetStage} for user ${userId}`
    );
    return true;
}

/**
 * Get the current onboarding stage for a user.
 */
export async function getCurrentStage(
    userId: string
): Promise<OnboardingStage | null> {
    const user = await prisma.userAuth.findUnique({
        where: { id: userId },
        select: { onboardingStage: true },
    });
    return (user?.onboardingStage as OnboardingStage) ?? null;
}
