-- AlterTable
ALTER TABLE "UserAuth" ADD COLUMN "selectedProjectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserAuth" ADD COLUMN "onboardingQuizCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "rankingScore" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "projectIntent" TEXT;
ALTER TABLE "Project" ADD COLUMN "impactEntries" JSONB;
ALTER TABLE "Project" ADD COLUMN "contributionArea" TEXT;
ALTER TABLE "Project" ADD COLUMN "quizExtraNotes" TEXT;
