/**
 * updateOnboardingStatus.ts
 * 
 * A targeted seed/utility script that updates existing users in the database
 * to ensure that their `onboardingOutputFinalizedAt` field is populated.
 * 
 * This enables the /api/internal/eligible-users endpoint to accurately pick up
 * these onboarded users for the n8n workflows.
 * 
 * Usage:
 *   npx tsx scripts/updateOnboardingStatus.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function main() {
  console.log("── Updating user onboardingOutputFinalizedAt statuses ──");

  try {
    // We update everyone explicitly missing this field who finished onboarding
    const updatedUsers = await prisma.userAuth.updateMany({
      where: {
        onboardingOutputFinalizedAt: null,
      },
      data: {
        onboardingOutputFinalizedAt: new Date(),
        onboardingStage: "complete", // Double check stage is complete just in case
      },
    });

    console.log(`✅ Successfully updated ${updatedUsers.count} users!`);

  } catch (error) {
    console.error("❌ Failed to update users:", error);
  }
}

main()
  .catch((err) => {
    console.error("\n❌ Script failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
