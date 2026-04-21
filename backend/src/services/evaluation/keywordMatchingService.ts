/**
 * keywordMatchingService.ts
 *
 * Research Evaluation: Keyword-based matching baseline.
 *
 * Implements a simple TF-weighted keyword overlap matcher that serves
 * as the baseline comparison against the semantic matching pipeline.
 * Used for Precision@K comparison in the IEEE paper results.
 */

import { prisma } from "../../lib/prisma";
import {
  encodeProfileToText,
  buildProfileDataFromPrisma,
} from "../semantic/profileTextEncoder";

// ── Types ──────────────────────────────────────────────────

export interface KeywordMatchResult {
  jobId: string;
  score: number;  // 0–1 normalized overlap score
  rank: number;
  matchedKeywords: string[];
}

export interface MatchingEvaluation {
  method: "semantic" | "keyword";
  topK: number;
  totalJobs: number;
  relevantCount: number;
  precisionAtK: number;
  results: KeywordMatchResult[];
}

// ── Stop Words ─────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "shall", "can", "need",
  "dare", "ought", "used", "this", "that", "these", "those", "i", "me",
  "my", "myself", "we", "our", "ours", "you", "your", "yours", "he",
  "him", "his", "she", "her", "hers", "it", "its", "they", "them",
  "their", "what", "which", "who", "whom", "when", "where", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
  "very", "just", "about", "above", "after", "again", "also", "any",
  "because", "before", "between", "during", "into", "through", "up",
  "work", "working", "experience", "role", "job", "team", "using",
  "ability", "strong", "skills", "required", "preferred", "including",
]);

// ── Core Functions ─────────────────────────────────────────

/**
 * Tokenize text into meaningful keywords.
 * Removes stop words, short tokens, and normalizes to lowercase.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Compute TF-weighted keyword overlap score between profile and job description.
 * Returns a score between 0 and 1.
 */
function computeKeywordScore(
  profileTokens: string[],
  jobTokens: string[],
): { score: number; matchedKeywords: string[] } {
  const profileSet = new Set(profileTokens);
  const jobSet = new Set(jobTokens);

  // Build term frequency map for job tokens
  const jobTF = new Map<string, number>();
  for (const token of jobTokens) {
    jobTF.set(token, (jobTF.get(token) || 0) + 1);
  }

  // Find matching keywords
  const matchedKeywords: string[] = [];
  let weightedMatches = 0;
  let totalWeight = 0;

  for (const [token, freq] of jobTF.entries()) {
    totalWeight += freq;
    if (profileSet.has(token)) {
      matchedKeywords.push(token);
      weightedMatches += freq;
    }
  }

  // Jaccard component (unweighted set overlap)
  const union = new Set([...profileSet, ...jobSet]);
  const intersection = [...profileSet].filter((t) => jobSet.has(t));
  const jaccard = union.size > 0 ? intersection.length / union.size : 0;

  // TF-weighted component
  const tfScore = totalWeight > 0 ? weightedMatches / totalWeight : 0;

  // Blend: 40% Jaccard + 60% TF-weighted
  const score = 0.4 * jaccard + 0.6 * tfScore;

  return { score, matchedKeywords };
}

/**
 * Match jobs for a user using keyword overlap (baseline method).
 * Returns Top-K jobs ranked by keyword overlap score.
 */
export async function matchJobsKeyword(
  userId: string,
  topK: number = 5,
): Promise<KeywordMatchResult[]> {
  // 1. Load user profile
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

  if (!user) {
    console.error(`[KeywordMatch] User ${userId} not found`);
    return [];
  }

  // 2. Encode profile to text and tokenize
  const profileData = buildProfileDataFromPrisma(user);
  const profileText = encodeProfileToText(profileData);
  const profileTokens = tokenize(profileText);

  if (profileTokens.length === 0) {
    console.warn(`[KeywordMatch] Empty profile tokens for user ${userId}`);
    return [];
  }

  // 3. Fetch recent jobs (last 7 days for wider pool)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const jobs = await prisma.job.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { id: true, title: true, company: true, description: true },
  });

  if (jobs.length === 0) {
    console.warn("[KeywordMatch] No recent jobs found");
    return [];
  }

  // 4. Score each job
  const scored = jobs.map((job) => {
    const jobText = `${job.title} ${job.company} ${job.description}`;
    const jobTokens = tokenize(jobText);
    const { score, matchedKeywords } = computeKeywordScore(profileTokens, jobTokens);
    return { jobId: job.id, score, matchedKeywords, rank: 0 };
  });

  // 5. Sort by score descending and take Top-K
  scored.sort((a, b) => b.score - a.score);
  const topResults = scored.slice(0, topK).map((r, idx) => ({
    ...r,
    rank: idx + 1,
  }));

  console.log(
    `[KeywordMatch] Top-${topK} keyword matches for user ${userId} ` +
    `(best score: ${topResults[0]?.score.toFixed(4) ?? "N/A"})`
  );

  return topResults;
}

/**
 * Evaluate matching quality for a user — computes Precision@K.
 *
 * A match is considered "relevant" if its score >= relevanceThreshold.
 * This provides a consistent comparison metric between semantic and keyword methods.
 */
export function evaluateMatching(
  results: Array<{ score: number }>,
  topK: number,
  relevanceThreshold: number = 0.3,
): { relevantCount: number; precisionAtK: number } {
  const topResults = results.slice(0, topK);
  const relevantCount = topResults.filter((r) => r.score >= relevanceThreshold).length;
  const precisionAtK = topResults.length > 0 ? relevantCount / topResults.length : 0;

  return { relevantCount, precisionAtK };
}
