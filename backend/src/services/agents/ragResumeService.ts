/**
 * ragResumeService.ts
 *
 * Phase 6: RAG Resume Orchestrator
 *
 * Orchestrates the full pipeline:
 *   Retriever → Drafter → Critic (iterative loop, max N iterations)
 *
 * Falls back gracefully at every stage:
 *   - Retriever fails → Drafter uses zero-shot (no examples)
 *   - Drafter fails → returns null (caller generates basic resume)
 *   - Critic fails → accepts draft as-is (heuristic score)
 */

import { env } from "../../config/env";
import { retrieve, type RetrievedExample } from "./retrieverAgent";
import { draft, type DraftedResume } from "./drafterAgent";
import { critique, type CriticResult } from "./criticAgent";

export interface RAGResumeResult {
  resumeData: DraftedResume;
  atsScore: number;
  iterations: number;
  ragSources: string[];
  agentLog: AgentLogEntry[];
}

interface AgentLogEntry {
  agent: "retriever" | "drafter" | "critic";
  iteration: number;
  timestamp: string;
  success: boolean;
  details: any;
}

/**
 * Generate a tailored resume using the full RAG pipeline.
 *
 * @returns RAGResumeResult or null if the pipeline completely fails
 */
export async function generate(params: {
  userProfile: string;
  jobDescription: string;
  jobTitle: string;
  jobCompany: string;
  domain?: string;
  experienceLevel?: string;
}): Promise<RAGResumeResult | null> {
  const {
    userProfile,
    jobDescription,
    jobTitle,
    jobCompany,
    domain = "Full Stack Developer",
    experienceLevel = "Entry",
  } = params;

  const maxIterations = env.RAG_MAX_ITERATIONS;
  const atsThreshold = env.RAG_ATS_THRESHOLD;
  const agentLog: AgentLogEntry[] = [];
  let ragSources: string[] = [];

  // ── Step 1: Retriever ────────────────────────────────────
  let examples: RetrievedExample[] = [];
  try {
    const retrieverResult = await retrieve({
      domain,
      experienceLevel,
      jobDescription,
    });

    agentLog.push({
      agent: "retriever",
      iteration: 0,
      timestamp: new Date().toISOString(),
      success: retrieverResult.success,
      details: {
        examplesFound: retrieverResult.examples.length,
        sources: retrieverResult.sources,
      },
    });

    examples = retrieverResult.examples;
    ragSources = retrieverResult.sources;
  } catch (err: any) {
    console.warn("[RAG] Retriever failed — continuing with zero-shot:", err.message);
    agentLog.push({
      agent: "retriever",
      iteration: 0,
      timestamp: new Date().toISOString(),
      success: false,
      details: { error: err.message },
    });
  }

  // ── Step 2: Drafter → Critic Loop ────────────────────────
  let bestResume: DraftedResume | null = null;
  let bestAtsScore = 0;
  let criticFeedback: string | undefined;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`[RAG] Iteration ${iteration}/${maxIterations}...`);

    // 2a. Draft
    const drafterResult = await draft({
      userProfile,
      jobDescription,
      jobTitle,
      jobCompany,
      examples,
      criticFeedback,
    });

    agentLog.push({
      agent: "drafter",
      iteration,
      timestamp: new Date().toISOString(),
      success: drafterResult.success,
      details: {
        hasResume: !!drafterResult.resume,
        usedExamples: examples.length,
        hadCriticFeedback: !!criticFeedback,
      },
    });

    if (!drafterResult.success || !drafterResult.resume) {
      console.error(`[RAG] Drafter failed at iteration ${iteration}`);
      // If we have a previous best, use it
      if (bestResume) break;
      // Otherwise try again without examples
      examples = [];
      continue;
    }

    // 2b. Critic
    const criticResult = await critique({
      resume: drafterResult.resume,
      jobDescription,
      jobTitle,
      atsThreshold,
    });

    agentLog.push({
      agent: "critic",
      iteration,
      timestamp: new Date().toISOString(),
      success: criticResult.success,
      details: {
        atsScore: criticResult.atsScore,
        approved: criticResult.approved,
        scores: criticResult.details,
      },
    });

    // Track the best resume across iterations
    if (criticResult.atsScore > bestAtsScore) {
      bestResume = drafterResult.resume;
      bestAtsScore = criticResult.atsScore;
    }

    // If approved, we're done
    if (criticResult.approved) {
      console.log(
        `[RAG] ✅ Resume approved at iteration ${iteration} with ATS score ${criticResult.atsScore}`
      );
      return {
        resumeData: drafterResult.resume,
        atsScore: criticResult.atsScore,
        iterations: iteration,
        ragSources,
        agentLog,
      };
    }

    // Not yet approved — feed critic suggestions to next iteration
    criticFeedback = criticResult.feedback;
    console.log(
      `[RAG] Iteration ${iteration}: ATS=${criticResult.atsScore} (need ${atsThreshold}). Refining...`
    );
  }

  // ── Exhausted iterations — return best attempt ───────────
  if (bestResume) {
    console.log(
      `[RAG] ⚠️ Max iterations reached. Returning best draft (ATS=${bestAtsScore})`
    );
    return {
      resumeData: bestResume,
      atsScore: bestAtsScore,
      iterations: maxIterations,
      ragSources,
      agentLog,
    };
  }

  // Complete failure
  console.error("[RAG] ❌ Pipeline completely failed — no usable draft produced");
  return null;
}
