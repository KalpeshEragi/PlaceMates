/**
 * selfImprovingDataset.ts
 *
 * Self-improving dataset service for the RAG resume pipeline.
 *
 * After resume generation, high-quality outputs (score >= 90)
 * are stored in a separate `GeneratedResume` table — IF they
 * pass a diversity check (cosine similarity < 0.9 with existing dataset).
 *
 * These stored resumes are later used by the retriever for
 * blended retrieval (base + generated examples).
 */

import { prisma } from "../../lib/prisma";
import * as embeddingClient from "../semantic/embeddingClient";
import type { DraftedResume } from "./drafterAgent";

const SCORE_THRESHOLD = 90;
const SIMILARITY_THRESHOLD = 0.9;

// ── Main Entry Point ───────────────────────────────────────

/**
 * Evaluate a generated resume for inclusion in the self-improving dataset.
 *
 * Rules:
 *   1. Score must be >= 90
 *   2. Cosine similarity with ALL existing resumes must be < 0.9
 *   3. Stored in GeneratedResume table (separate from base corpus)
 *
 * This function is designed to be called fire-and-forget (non-blocking).
 */
export async function handleGeneratedResume(
  resumeJson: DraftedResume,
  score: number,
  jobId?: string,
  domain?: string,
  expLevel?: string,
): Promise<void> {
  // ── Gate 1: Score check ────────────────────────────────
  if (score < SCORE_THRESHOLD) {
    console.log(
      `[SelfImproving] Resume rejected: low score (${score}/100, threshold=${SCORE_THRESHOLD})`
    );
    return;
  }

  // ── Step 2: Compute embedding ──────────────────────────
  const resumeText = buildResumeText(resumeJson);
  const embedResult = await embeddingClient.embedProfile("self-improving", resumeText);

  if (!embedResult || !embedResult.embedding?.length) {
    console.error("[SelfImproving] Error: Failed to compute embedding for resume");
    return;
  }

  const embedding = embedResult.embedding;

  // ── Gate 2: Diversity check ────────────────────────────
  const similarityResult = await embeddingClient.checkSimilarity(embedding);

  if (similarityResult) {
    if (similarityResult.maxSimilarity > SIMILARITY_THRESHOLD) {
      console.log(
        `[SelfImproving] Resume rejected: high similarity (${similarityResult.maxSimilarity.toFixed(4)} > ${SIMILARITY_THRESHOLD})`
      );
      return;
    }
  } else {
    // If similarity check fails, still store (conservative approach for empty datasets)
    console.warn("[SelfImproving] Similarity check unavailable — storing anyway (safe default)");
  }

  // ── Step 3: Store in GeneratedResume table ─────────────
  await prisma.generatedResume.create({
    data: {
      content: resumeJson as any,
      embedding,
      score,
      sourceJobId: jobId ?? null,
      domain: domain ?? "Unknown",
      expLevel: expLevel ?? "Entry",
    },
  });

  console.log(
    `[SelfImproving] Resume stored successfully (score=${score}, similarity=${similarityResult?.maxSimilarity?.toFixed(4) ?? "N/A"})`
  );
}

// ── Retrieval: Fetch Generated Examples ────────────────────

/**
 * Retrieve top-K generated resumes by cosine similarity.
 *
 * Used by the retriever for blended retrieval (base + generated).
 * Computes cosine similarity in-process using JS (OK for small datasets).
 */
export async function retrieveGeneratedExamples(
  queryEmbedding: number[],
  topK: number = 2,
  domain?: string,
  expLevel?: string,
): Promise<Array<{ id: string; content: any; score: number; similarity: number }>> {
  // Fetch all generated resumes (filter by domain/expLevel if provided)
  const whereClause: any = { score: { gte: SCORE_THRESHOLD } };
  if (domain) whereClause.domain = domain;
  if (expLevel) whereClause.expLevel = expLevel;

  const candidates = await prisma.generatedResume.findMany({
    where: whereClause,
    select: { id: true, content: true, score: true, embedding: true },
  });

  if (candidates.length === 0) {
    return [];
  }

  // Compute cosine similarity for each candidate
  const scored = candidates
    .map((c: any) => ({
      id: c.id,
      content: c.content,
      score: c.score,
      similarity: cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Cosine similarity between two vectors.
 * SentenceTransformer embeddings are already L2-normalized,
 * so cosine similarity = dot product.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Build a flat text representation of a DraftedResume for embedding.
 * Mirrors the format used by resume_store.py's _build_search_text.
 */
function buildResumeText(resume: DraftedResume): string {
  const parts: string[] = [];

  if (resume.professionalSummary) {
    parts.push(resume.professionalSummary);
  }

  if (resume.skills?.length) {
    parts.push("Skills: " + resume.skills.join(", "));
  }

  for (const exp of resume.experience || []) {
    parts.push(`${exp.role} at ${exp.company}: ${exp.bullets.join(". ")}`);
  }

  for (const proj of resume.projects || []) {
    const tech = proj.techStack?.join(", ") || "";
    parts.push(`Project ${proj.name}: ${proj.bullets.join(". ")} (${tech})`);
  }

  for (const edu of resume.education || []) {
    parts.push(`${edu.degree} from ${edu.institution}`);
  }

  return parts.join(" | ");
}
