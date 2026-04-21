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
  keywordScore?: number;
  rank: number;
}

function keywordMatch(userText: string, jobText: string): number {
  const userWords = new Set(userText.toLowerCase().split(/\s+/));
  const jobWords = jobText.toLowerCase().split(/\s+/);
  
  if (jobWords.length === 0) return 0;

  let match = 0;
  for (const word of jobWords) {
    if (userWords.has(word)) match++;
  }

  return match / jobWords.length;
}

/**
 * Main pipeline: match jobs for a given user using semantic embeddings.
 *
 * Returns null if the embedding service is down (caller should fall back to keyword).
 */
export async function matchJobsForUser(
  userId: string,
): Promise<SemanticMatchResult[] | null> {
  const FAISS_POOL_SIZE = 100;   // Retrieve a wide pool from FAISS
  const FINAL_TOP_K = 5;         // Return only the best 5 after filtering

  // 1. Check if embedding service is available
  const healthy = await embeddingClient.isHealthy();
  if (!healthy) {
    console.warn("[SemanticMatch] Embedding service unavailable — skipping semantic matching");
    return null;
  }

  // 2. Load full user profile + job preferences
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
      jobPreferences: true,
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

  // 4. Semantic search over FAISS index — retrieve a WIDE pool
  const searchResult = await embeddingClient.semanticSearch(
    profileVector,
    FAISS_POOL_SIZE,
    env.SEMANTIC_MATCH_THRESHOLD,
  );

  if (!searchResult || searchResult.results.length === 0) {
    console.log("[SemanticMatch] No semantic matches found from FAISS");
    return [];
  }

  console.log(
    `[SemanticMatch] FAISS returned ${searchResult.results.length} candidates for user ${userId}`
  );

  // 5. Build a score map for fast lookup: job_id → FAISS score
  const faissScoreMap = new Map<string, number>();
  for (const r of searchResult.results) {
    faissScoreMap.set(r.job_id, r.score);
  }
  const faissJobIds = Array.from(faissScoreMap.keys());

  // 6. Post-filter in PostgreSQL: recency + user preferences
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const prefs = user.jobPreferences;

  // Build dynamic Prisma where clause
  const whereClause: any = {
    id: { in: faissJobIds },
    createdAt: { gte: twentyFourHoursAgo },
  };

  // Apply user preference filters (only if preferences exist)
  if (prefs) {
    // Location filter: job.location should contain at least one of the user's preferred locations
    // Using case-insensitive partial matching via OR conditions
    if (prefs.locations && prefs.locations.length > 0) {
      whereClause.OR = prefs.locations.map((loc: string) => ({
        location: { contains: loc, mode: "insensitive" as const },
      }));

      // Also allow "Remote" jobs if user wants remote work
      if (prefs.workType?.toLowerCase() === "remote") {
        whereClause.OR.push({
          location: { contains: "remote", mode: "insensitive" as const },
        });
      }
    }

    // Work type filter: check job description for work type keywords
    // (Jobs DB doesn't have a dedicated workType column, so we match in description)
    if (prefs.workType && prefs.workType.toLowerCase() !== "any") {
      // This is a soft filter — we already have location OR, so workType is advisory
      // We'll handle it as part of the location OR above for remote
    }
  }

  const filteredJobs = await prisma.job.findMany({
    where: whereClause,
    select: { id: true, title: true, company: true, location: true, description: true },
  });

  console.log(
    `[SemanticMatch] Post-filter: ${filteredJobs.length}/${faissJobIds.length} jobs survived (24h recency + preference filters)`
  );

  if (filteredJobs.length === 0) {
    console.warn(
      `[SemanticMatch] Zero jobs remaining after post-filtering for user ${userId}. ` +
      `Consider relaxing filters or extending the time window.`
    );
    return [];
  }

  // 7. Merge FAISS scores back onto filtered jobs, re-rank by score descending
  const filteredMatches: SemanticMatchResult[] = filteredJobs
    .map((job) => {
      const kwScore = keywordMatch(profileText, job.description || "");
      return {
        jobId: job.id,
        score: faissScoreMap.get(job.id) ?? 0,
        keywordScore: kwScore,
        rank: 0, // will be re-assigned below
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, FINAL_TOP_K)
    .map((m, idx) => ({ ...m, rank: idx + 1 }));

  console.log(
    `[SemanticMatch] Returning top ${filteredMatches.length} post-filtered matches for user ${userId} ` +
    `(top score: ${filteredMatches[0]?.score.toFixed(4)})`
  );

  return filteredMatches;
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
