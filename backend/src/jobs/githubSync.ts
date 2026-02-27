import cron from "node-cron";
import { prisma } from "../lib/prisma";

/**
 * Refreshes GitHub repos for all users who have connected GitHub.
 * Can be called directly (for manual refresh) or via cron schedule.
 */
export async function syncAllGithubRepos(): Promise<void> {
    console.log("[GitHub Sync] Starting sync for all connected users...");

    const githubAccounts = await prisma.oAuthAccount.findMany({
        where: {
            provider: "github",
            accessToken: { not: null },
        },
        include: {
            user: { include: { profile: true } },
        },
    });

    console.log(`[GitHub Sync] Found ${githubAccounts.length} GitHub-connected user(s)`);

    for (const account of githubAccounts) {
        try {
            const res = await fetch(
                "https://api.github.com/user/repos?per_page=100&sort=updated",
                {
                    headers: {
                        Authorization: `Bearer ${account.accessToken}`,
                        Accept: "application/vnd.github+json",
                    },
                }
            );

            if (!res.ok) {
                console.warn(
                    `[GitHub Sync] Failed for user ${account.userId} — HTTP ${res.status}`
                );
                continue;
            }

            const repos = await res.json();

            const existingData =
                (account.user.profile?.importedData as Record<string, unknown>) || {};

            await prisma.userProfile.update({
                where: { userId: account.userId },
                data: {
                    importedData: {
                        ...existingData,
                        githubRepos: repos,
                        githubSyncedAt: new Date().toISOString(),
                    },
                },
            });

            console.log(
                `[GitHub Sync] ✅ Updated ${(repos as unknown[]).length} repos for user ${account.userId}`
            );
        } catch (err) {
            console.error(`[GitHub Sync] ❌ Error for user ${account.userId}:`, err);
        }
    }

    console.log("[GitHub Sync] Sync complete.");
}

/**
 * Register the cron job — runs every 6 hours.
 */
export function startGithubSyncJob(): void {
    // Every 6 hours: at minute 0, every 6th hour
    cron.schedule("0 */6 * * *", () => {
        syncAllGithubRepos().catch((err) =>
            console.error("[GitHub Sync] Unhandled error in cron:", err)
        );
    });

    console.log("⏰ GitHub sync cron job registered (every 6 hours)");
}
