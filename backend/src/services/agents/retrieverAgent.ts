/**
 * retrieverAgent.ts
 *
 * Phase 6: Retriever Agent — fetches relevant resume examples for the Drafter.
 *
 * Blended retrieval strategy:
 *   - 3 examples from base_resumes (ChromaDB via embeddingClient)
 *   - 2 examples from generated_resumes (PostgreSQL GeneratedResume table)
 *   - Falls back to 5 from base if generated_resumes is empty
 */

import * as embeddingClient from "../semantic/embeddingClient";
import { retrieveGeneratedExamples } from "./selfImprovingDataset";

export interface RetrievedExample {
  id: string;
  domain: string;
  experienceLevel: string;
  summary: string;
  skills: string[];
  experience: any[];
  projects: any[];
  education: any[];
  certifications: any[];
  achievements: string[];
  score: number;
  source?: "base" | "generated";
}

export interface RetrieverResult {
  examples: RetrievedExample[];
  sources: string[];
  success: boolean;
}

/**
 * Retrieve top-K resume examples using blended strategy:
 *   - 3 from base corpus (ChromaDB)
 *   - 2 from generated resumes (PostgreSQL)
 *   - Falls back to topK from base if no generated resumes exist
 *
 * Returns empty array on failure (Drafter falls back to zero-shot).
 */
export async function retrieve(params: {
  domain: string;
  experienceLevel: string;
  jobDescription: string;
  topK?: number;
}): Promise<RetrieverResult> {
  const { domain, experienceLevel, jobDescription, topK = 5 } = params;

  try {
    const baseTopK = 3;
    const generatedTopK = 2;

    // ── 1. Fetch from base resumes (ChromaDB) ────────────
    let baseExamples: RetrievedExample[] = [];
    try {
      const result = await embeddingClient.retrieveResumeExamples(
        domain,
        experienceLevel,
        jobDescription,
        baseTopK,
      );

      if (result?.examples?.length) {
        baseExamples = result.examples.map((ex) => ({
          id: ex.id,
          domain: ex.domain,
          experienceLevel: ex.experience_level,
          summary: ex.summary,
          skills: ex.skills,
          experience: ex.experience,
          projects: ex.projects,
          education: ex.education,
          certifications: ex.certifications || [],
          achievements: ex.achievements || [],
          score: ex.score,
          source: "base" as const,
        }));
      }
    } catch (err: any) {
      console.warn("[Retriever] Base resumes fetch failed:", err.message);
    }

    // ── 2. Fetch from generated resumes (PostgreSQL) ─────
    let genExamples: RetrievedExample[] = [];
    try {
      // Get embedding for the job description to do similarity search
      const embedResult = await embeddingClient.embedProfile("retriever-query", jobDescription);

      if (embedResult?.embedding?.length) {
        const generated = await retrieveGeneratedExamples(
          embedResult.embedding,
          generatedTopK,
          domain,
          experienceLevel,
        );

        genExamples = generated.map((g) => {
          const content = g.content as any;
          return {
            id: g.id,
            domain: content.domain || domain,
            experienceLevel: content.experienceLevel || experienceLevel,
            summary: content.professionalSummary || "",
            skills: content.skills || [],
            experience: content.experience || [],
            projects: content.projects || [],
            education: content.education || [],
            certifications: content.certifications || [],
            achievements: content.achievements || [],
            score: g.similarity,
            source: "generated" as const,
          };
        });
      }
    } catch (err: any) {
      console.warn("[Retriever] Generated resumes fetch failed:", err.message);
    }

    // ── 3. Merge & fallback ──────────────────────────────
    let examples: RetrievedExample[];

    if (genExamples.length === 0) {
      // No generated resumes → fetch full topK from base
      if (baseExamples.length < topK) {
        try {
          const fallbackResult = await embeddingClient.retrieveResumeExamples(
            domain,
            experienceLevel,
            jobDescription,
            topK,
          );
          if (fallbackResult?.examples?.length) {
            baseExamples = fallbackResult.examples.map((ex) => ({
              id: ex.id,
              domain: ex.domain,
              experienceLevel: ex.experience_level,
              summary: ex.summary,
              skills: ex.skills,
              experience: ex.experience,
              projects: ex.projects,
              education: ex.education,
              certifications: ex.certifications || [],
              achievements: ex.achievements || [],
              score: ex.score,
              source: "base" as const,
            }));
          }
        } catch {
          // Use whatever we have
        }
      }
      examples = baseExamples;
    } else {
      examples = [...baseExamples, ...genExamples];
    }

    if (!examples.length) {
      console.log("[Retriever] No resume examples found — Drafter will use zero-shot");
      return { examples: [], sources: [], success: true };
    }

    const sources = examples.map((ex) => `${ex.source || "base"}:${ex.id}`);

    console.log(
      `[Retriever] Retrieved ${examples.length} examples ` +
      `(base=${baseExamples.length}, generated=${genExamples.length}) ` +
      `for domain="${domain}" level="${experienceLevel}"`
    );

    return { examples, sources, success: true };
  } catch (err: any) {
    console.error("[Retriever] Error:", err.message);
    return { examples: [], sources: [], success: false };
  }
}
