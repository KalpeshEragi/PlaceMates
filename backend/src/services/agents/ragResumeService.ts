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
 *
 * Phase 8 additions:
 *   - Ablation flags (USE_RAG, USE_CRITIC, USE_ITERATION) to disable components
 *   - Score tracking (iterationScores[], baseScore, draftScore) for evaluation
 */

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { retrieve, type RetrievedExample } from "./retrieverAgent";
import { draft, type DraftedResume } from "./drafterAgent";
import { critique, type CriticResult } from "./criticAgent";
import { handleGeneratedResume } from "./selfImprovingDataset";

export interface RAGResumeResult {
  resumeData: DraftedResume;
  atsScore: number;
  iterations: number;
  ragSources: string[];
  agentLog: AgentLogEntry[];
  // ── Evaluation tracking (populated when EVAL_ENABLED) ────
  iterationScores?: number[];
  baseScore?: number;
  draftScore?: number;
  ablationMode?: string;
  // ── Model tracking (for research) ─────────────────────────
  modelsUsed?: string[];  // e.g. ["groq/llama-3.3-70b-versatile", "together/mistral-7b"]
}

interface AgentLogEntry {
  agent: "retriever" | "drafter" | "critic";
  iteration: number;
  timestamp: string;
  success: boolean;
  details: any;
}

/**
 * Determine the current ablation mode based on env flags.
 */
function getAblationMode(): string {
  if (!env.USE_RAG) return "no_rag";
  if (!env.USE_CRITIC) return "no_critic";
  if (!env.USE_ITERATION) return "no_iteration";
  return "full";
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
  jobId?: string;
  userId?: string;
}): Promise<RAGResumeResult | null> {
  const {
    userProfile,
    jobDescription,
    jobTitle,
    jobCompany,
    domain = "Full Stack Developer",
    experienceLevel = "Entry",
    jobId,
    userId,
  } = params;

  // ── Ablation-aware configuration ─────────────────────────
  const ablationMode = getAblationMode();
  const effectiveMaxIterations = env.USE_ITERATION ? env.RAG_MAX_ITERATIONS : 1;
  const atsThreshold = env.RAG_ATS_THRESHOLD;
  const agentLog: AgentLogEntry[] = [];
  let ragSources: string[] = [];
  const iterationScores: number[] = [];
  const modelsUsed = new Set<string>();

  if (ablationMode !== "full") {
    console.log(`[RAG] ⚗️ Ablation mode: ${ablationMode}`);
  }

  // ── Step 1: Retriever ────────────────────────────────────
  let examples: RetrievedExample[] = [];

  if (env.USE_RAG) {
    // Normal retriever path
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
  } else {
    // Ablation: skip retriever entirely
    console.log("[RAG] ⚗️ Retriever SKIPPED (USE_RAG=false)");
    agentLog.push({
      agent: "retriever",
      iteration: 0,
      timestamp: new Date().toISOString(),
      success: true,
      details: { skipped: true, reason: "ablation:USE_RAG=false" },
    });
  }

  // ── Step 2: Drafter → Critic Loop ────────────────────────
  let bestResume: DraftedResume | null = null;
  let bestAtsScore = 0;
  let criticFeedback: string | undefined;
  let baseScore: number | undefined;
  let draftScore: number | undefined;

  for (let iteration = 1; iteration <= effectiveMaxIterations; iteration++) {
    console.log(`[RAG] Iteration ${iteration}/${effectiveMaxIterations}...`);

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
        modelUsed: drafterResult.modelUsed,
      },
    });

    if (drafterResult.modelUsed) modelsUsed.add(drafterResult.modelUsed);

    if (!drafterResult.success || !drafterResult.resume) {
      console.error(`[RAG] Drafter failed at iteration ${iteration}`);
      // If we have a previous best, use it
      if (bestResume) break;
      // Otherwise try again without examples
      examples = [];
      continue;
    }

    // ── Ablation: skip critic if disabled ───────────────────
    if (!env.USE_CRITIC) {
      console.log("[RAG] ⚗️ Critic SKIPPED (USE_CRITIC=false) — accepting draft as-is");

      // Assign a heuristic score of 65 when critic is disabled
      const heuristicScore = 65;
      iterationScores.push(heuristicScore);

      if (iteration === 1) {
        baseScore = heuristicScore;
      }
      if (iteration === 2) {
        draftScore = heuristicScore;
      }

      agentLog.push({
        agent: "critic",
        iteration,
        timestamp: new Date().toISOString(),
        success: true,
        details: {
          atsScore: heuristicScore,
          approved: true,
          skipped: true,
          reason: "ablation:USE_CRITIC=false",
        },
      });

      if (userId && jobId) {
        await prisma.resumeEvaluation.create({
          data: {
            userId,
            jobId,
            baseScore: iterationScores[0] || 0,
            draftScore: iterationScores[1] || iterationScores[0] || 0,
            finalScore: iterationScores[iterationScores.length - 1] || 0,
            iterationScores,
            iterationsUsed: iterationScores.length > 0 ? iterationScores.length : 1,
            ablationMode,
          }
        }).catch(err => console.error("[RAG] Failed to save evaluation:", err.message));
      }

      return {
        resumeData: drafterResult.resume,
        atsScore: heuristicScore,
        iterations: iteration,
        ragSources,
        agentLog,
        iterationScores,
        baseScore,
        draftScore,
        ablationMode,
        modelsUsed: [...modelsUsed],
      };
    }

    // 2b. Critic (normal path)
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
        modelUsed: criticResult.modelUsed,
      },
    });

    if (criticResult.modelUsed) modelsUsed.add(criticResult.modelUsed);

    // ── Score tracking for evaluation ───────────────────────
    iterationScores.push(criticResult.atsScore);

    if (iteration === 1) {
      // baseScore = score before any RAG improvement (first draft attempt)
      baseScore = criticResult.atsScore;
    }
    if (iteration === 2) {
      // draftScore = score after first iteration of critic feedback
      draftScore = criticResult.atsScore;
    }

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

      // Fire-and-forget: evaluate for self-improving dataset
      handleGeneratedResume(drafterResult.resume, criticResult.atsScore, jobId, domain, experienceLevel)
        .catch(err => console.warn("[RAG] Self-improving dataset error (non-critical):", err.message));

      if (userId && jobId) {
        await prisma.resumeEvaluation.create({
          data: {
            userId,
            jobId,
            baseScore: iterationScores[0] || 0,
            draftScore: iterationScores[1] || iterationScores[0] || 0,
            finalScore: iterationScores[iterationScores.length - 1] || 0,
            iterationScores,
            iterationsUsed: iterationScores.length > 0 ? iterationScores.length : 1,
            ablationMode,
          }
        }).catch(err => console.error("[RAG] Failed to save evaluation:", err.message));
      }

      return {
        resumeData: drafterResult.resume,
        atsScore: criticResult.atsScore,
        iterations: iteration,
        ragSources,
        agentLog,
        iterationScores,
        baseScore,
        draftScore,
        ablationMode,
        modelsUsed: [...modelsUsed],
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

    // Fire-and-forget: evaluate best attempt for self-improving dataset
    handleGeneratedResume(bestResume, bestAtsScore, jobId, domain, experienceLevel)
      .catch(err => console.warn("[RAG] Self-improving dataset error (non-critical):", err.message));

    if (userId && jobId) {
      await prisma.resumeEvaluation.create({
        data: {
          userId,
          jobId,
          baseScore: iterationScores[0] || 0,
          draftScore: iterationScores[1] || iterationScores[0] || 0,
          finalScore: iterationScores[iterationScores.length - 1] || 0,
          iterationScores,
          iterationsUsed: iterationScores.length > 0 ? iterationScores.length : 1,
          ablationMode,
        }
      }).catch(err => console.error("[RAG] Failed to save evaluation:", err.message));
    }

    return {
      resumeData: bestResume,
      atsScore: bestAtsScore,
      iterations: effectiveMaxIterations,
      ragSources,
      agentLog,
      iterationScores,
      baseScore,
      draftScore,
      ablationMode,
      modelsUsed: [...modelsUsed],
    };
  }

  // Complete failure
  console.error("[RAG] ❌ Pipeline completely failed — no usable draft produced");
  return null;
}
