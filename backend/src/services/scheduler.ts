import cron from "node-cron";
import { randomUUID } from "crypto";
import axios from "axios";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { buildN8nPayload } from "../controllers/workflowController";

/**
 * Daily job matching scheduler.
 *
 * Runs at 02:00 AM IST (Asia/Kolkata) every day.
 * Triggers n8n for every user who has:
 *   1. Completed onboarding (onboardingOutputFinalizedAt is set)
 *   2. Set job preferences
 *   3. No currently active workflow run
 *
 * Requests are staggered with 500ms delays to avoid overwhelming n8n.
 */
export function startScheduler() {
  // "0 2 * * *" = every day at 02:00 IST
  cron.schedule(
    "0 2 * * *",
    async () => {
      console.log("[Scheduler] Starting daily job matching run...");

      try {
        // Find all eligible users
        const eligibleUsers = await prisma.userAuth.findMany({
          where: {
            jobPreferences: { isNot: null },
            onboardingOutputFinalizedAt: { not: null },
          },
          include: {
            jobPreferences: true,
            profile: true,
            skills: true,
            experiences: true,
            educations: true,
            awards: true,
            certifications: true,
            projects: {
              orderBy: { rankingScore: "desc" },
              take: 6,
            },
            summary: true,
            portfolio: true,
          },
        });

        console.log(
          `[Scheduler] Found ${eligibleUsers.length} eligible users`
        );

        let triggered = 0;
        let skipped = 0;
        let failed = 0;

        for (const user of eligibleUsers) {
          // Skip if user has an active run
          const activeRun = await prisma.workflowRun.findFirst({
            where: {
              userId: user.id,
              status: { in: ["pending", "processing"] },
            },
          });

          if (activeRun) {
            console.log(
              `[Scheduler] Skipping user ${user.id} — active run exists`
            );
            skipped++;
            continue;
          }

          const requestId = randomUUID();

          // Create run record
          await prisma.workflowRun.create({
            data: {
              userId: user.id,
              requestId,
              triggerType: "cron",
              status: "pending",
            },
          });

          // Build and send payload
          const payload = buildN8nPayload(requestId, user);

          try {
            await axios.post(env.N8N_WEBHOOK_URL, payload, {
              headers: {
                "Content-Type": "application/json",
                "x-n8n-secret": env.N8N_WEBHOOK_SECRET,
              },
              timeout: 10000,
            });
            console.log(
              `[Scheduler] Triggered for user ${user.id}, requestId=${requestId}`
            );
            triggered++;
          } catch (err: any) {
            console.error(
              `[Scheduler] Failed for user ${user.id}:`,
              err.message
            );
            await prisma.workflowRun.update({
              where: { requestId },
              data: {
                status: "failed",
                error: `Cron trigger failed: ${err.message}`,
              },
            });
            failed++;
          }

          // Stagger requests to avoid overwhelming n8n
          await new Promise((r) => setTimeout(r, 500));
        }

        console.log(
          `[Scheduler] Daily run complete — triggered: ${triggered}, skipped: ${skipped}, failed: ${failed}`
        );
      } catch (error) {
        console.error("[Scheduler] Fatal error:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("⏰ Scheduler initialized — daily job matching at 02:00 AM IST");
}
