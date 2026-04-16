/**
 * semanticMatchingService.ts
 *
 * Orchestrates the full semantic matching pipeline:
 *  1. Encode user profile → text → embedding
 *  2. Embed new jobs (if any unembedded)
 *  3. Cosine search → ranked results
 *
 * Falls back to null if embedding service is unavailable.
 */

import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import * as embeddingClient from "./embeddingClient";
import {
  encodeProfileToText,
  computeProfileHash,
  buildProfileDataFromPrisma,
} from "./profileTextEncoder";

export interface SemanticMatchResult {
  jobId: string;
  score: number;
  rank: number;
}

/**
 * Main pipeline: match jobs for a given user using semantic embeddings.
 *
 * Returns null if the embedding service is down (caller should fall back to keyword).
 */
export async function matchJobsForUser(
  userId: string,
): Promise<SemanticMatchResult[] | null> {
  // 1. Check if embedding service is available
  const healthy = await embeddingClient.isHealthy();
  if (!healthy) {
    console.warn("[SemanticMatch] Embedding service unavailable — skipping semantic matching");
    return null;
  }

  // 2. Load full user profile
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      skills: true,
      projects: { orderBy: { rankingScore: "desc" } },
      experiences: true,
      educations: true,
      certifications: true,
      awards: true,
      summary: true,
      embedding: true,
    },
  });

  if (!user) {
    console.error(`[SemanticMatch] User ${userId} not found`);
    return null;
  }

  // 3. Encode profile to text and check cache
  const profileData = buildProfileDataFromPrisma(user);
  const profileText = encodeProfileToText(profileData);
  const profileHash = computeProfileHash(profileText);

  let profileVector: number[];

  // Check if we have a cached embedding with the same hash
  if (
    user.embedding &&
    user.embedding.profileHash === profileHash &&
    user.embedding.embedding.length > 0
  ) {
    console.log(`[SemanticMatch] Using cached embedding for user ${userId}`);
    profileVector = user.embedding.embedding;
  } else {
    // Re-embed the profile
    console.log(`[SemanticMatch] Embedding profile for user ${userId}...`);
    const embedResult = await embeddingClient.embedProfile(userId, profileText, profileHash);
    if (!embedResult) {
      console.error("[SemanticMatch] Failed to embed profile");
      return null;
    }

    profileVector = embedResult.embedding;

    // Cache the embedding in DB
    await prisma.userEmbedding.upsert({
      where: { userId },
      create: {
        userId,
        embedding: profileVector,
        profileHash,
      },
      update: {
        embedding: profileVector,
        profileHash,
        embeddedAt: new Date(),
      },
    });
  }

  // 4. Semantic search over FAISS index
  const searchResult = await embeddingClient.semanticSearch(
    profileVector,
    20,
    env.SEMANTIC_MATCH_THRESHOLD,
  );

  if (!searchResult || searchResult.results.length === 0) {
    console.log("[SemanticMatch] No semantic matches found");
    return [];
  }

  // 5. Map FAISS results to our format
  const matches: SemanticMatchResult[] = searchResult.results.map((r) => ({
    jobId: r.job_id,
    score: r.score,
    rank: r.rank,
  }));

  console.log(
    `[SemanticMatch] Found ${matches.length} semantic matches for user ${userId} (top score: ${matches[0]?.score})`
  );

  return matches;
}

/**
 * Embed newly scraped jobs that haven't been embedded yet.
 * Called after bulkUpsertJobs (fire-and-forget pattern).
 */
export async function embedNewJobs(jobIds: string[]): Promise<number> {
  if (!jobIds.length) return 0;

  // Find jobs that are NOT yet embedded
  const jobs = await prisma.job.findMany({
    where: {
      id: { in: jobIds },
      embeddedAt: null,
    },
    select: { id: true, title: true, company: true, description: true, location: true },
  });

  if (!jobs.length) return 0;

  // Build text for each job (title + company + location + description)
  const jobTexts = jobs.map((j) => ({
    job_id: j.id,
    text: `${j.title} at ${j.company}, ${j.location}. ${j.description}`,
  }));

  const result = await embeddingClient.embedBatchJobs(jobTexts);
  if (!result) return 0;

  // Mark jobs as embedded in DB
  await prisma.job.updateMany({
    where: { id: { in: jobs.map((j) => j.id) } },
    data: { embeddedAt: new Date() },
  });

  console.log(`[SemanticMatch] Embedded ${result.count} new jobs`);
  return result.count;
}

/**
 * Force re-embed a user's profile (e.g. after they update their skills/projects).
 */
export async function refreshUserEmbedding(userId: string): Promise<boolean> {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      skills: true,
      projects: { orderBy: { rankingScore: "desc" } },
      experiences: true,
      educations: true,
      certifications: true,
      awards: true,
      summary: true,
    },
  });

  if (!user) return false;

  const profileData = buildProfileDataFromPrisma(user);
  const profileText = encodeProfileToText(profileData);
  const profileHash = computeProfileHash(profileText);

  const embedResult = await embeddingClient.embedProfile(userId, profileText, profileHash);
  if (!embedResult) return false;

  await prisma.userEmbedding.upsert({
    where: { userId },
    create: {
      userId,
      embedding: embedResult.embedding,
      profileHash,
    },
    update: {
      embedding: embedResult.embedding,
      profileHash,
      embeddedAt: new Date(),
    },
  });

  return true;
}
