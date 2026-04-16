/**
 * retrieverAgent.ts
 *
 * Phase 6: Retriever Agent — fetches relevant resume examples from ChromaDB
 * for the Drafter to use as context/few-shot examples.
 */

import * as embeddingClient from "../semantic/embeddingClient";

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
}

export interface RetrieverResult {
  examples: RetrievedExample[];
  sources: string[];
  success: boolean;
}

/**
 * Retrieve top-K resume examples from ChromaDB matching the user's domain,
 * experience level, and the target job description.
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
    const result = await embeddingClient.retrieveResumeExamples(
      domain,
      experienceLevel,
      jobDescription,
      topK,
    );

    if (!result || !result.examples.length) {
      console.log("[Retriever] No resume examples found — Drafter will use zero-shot");
      return { examples: [], sources: [], success: true };
    }

    const examples: RetrievedExample[] = result.examples.map((ex) => ({
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
    }));

    const sources = examples.map((ex) => ex.id);

    console.log(
      `[Retriever] Retrieved ${examples.length} examples for domain="${domain}" level="${experienceLevel}" (top score: ${examples[0]?.score})`
    );

    return { examples, sources, success: true };
  } catch (err: any) {
    console.error("[Retriever] Error:", err.message);
    return { examples: [], sources: [], success: false };
  }
}
