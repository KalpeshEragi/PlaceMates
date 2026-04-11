-- AlterTable: Add GitHub metadata and AI enrichment fields to Project
ALTER TABLE "Project" ADD COLUMN "stars" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "forks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "repoDescription" TEXT;
ALTER TABLE "Project" ADD COLUMN "readmeExcerpt" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastPushedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "repoSize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "aiDescription" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Project" ADD COLUMN "aiComplexity" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiUniqueAngle" TEXT;
