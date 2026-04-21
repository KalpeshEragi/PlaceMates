/**
 * criticAgent.ts
 *
 * Phase 6: Critic Agent — evaluates a drafted resume against ATS criteria.
 * Returns an ATS score (0-100) and specific improvement suggestions.
 *
 * Evaluates:
 *  - Keyword coverage (does the resume mirror job description keywords?)
 *  - Quantification (do bullets include numbers/metrics?)
 *  - Action verbs (do bullets start with strong verbs?)
 *  - Section completeness (are all required sections present?)
 *  - Relevance (is the content targeted to this specific job?)
 */

import { callLLMWithMetadata } from "../ai/llmClient";
import type { DraftedResume } from "./drafterAgent";

export interface CriticResult {
  atsScore: number;
  feedback: string;
  details: {
    keywordCoverage: number;
    quantification: number;
    actionVerbs: number;
    sectionCompleteness: number;
    relevance: number;
  };
  approved: boolean;
  success: boolean;
  modelUsed?: string;
  providerUsed?: string;
}

/**
 * Evaluate a drafted resume and return ATS score + improvement feedback.
 *
 * @param resume - The drafted resume to evaluate
 * @param jobDescription - The target job description
 * @param jobTitle - The target job title
 * @param atsThreshold - Score threshold to approve (default 75)
 */
export async function critique(params: {
  resume: DraftedResume;
  jobDescription: string;
  jobTitle: string;
  atsThreshold?: number;
}): Promise<CriticResult> {
  const { resume, jobDescription, jobTitle, atsThreshold = 75 } = params;

  try {
    const prompt = buildCriticPrompt(resume, jobDescription, jobTitle);

    const result = await callLLMWithMetadata(prompt, {
      temperature: 0.2,
      maxTokens: 1500,
      role: "critic",
    });

    const rawResponse = result?.content ?? null;
    const modelUsed = result ? `${result.provider}/${result.model}` : undefined;
    const providerUsed = result?.provider;

    if (!rawResponse) {
      console.error("[Critic] LLM returned null — falling back to heuristic scoring");
      return heuristicScore(resume, jobDescription, atsThreshold);
    }

    const parsed = parseCriticResponse(rawResponse);
    if (!parsed) {
      console.error("[Critic] Failed to parse LLM response — using heuristic");
      return heuristicScore(resume, jobDescription, atsThreshold);
    }

    const approved = parsed.atsScore >= atsThreshold;
    console.log(
      `[Critic] ATS Score: ${parsed.atsScore}/100 | Approved: ${approved} | Threshold: ${atsThreshold} | via ${modelUsed}`
    );

    return {
      ...parsed,
      approved,
      success: true,
      modelUsed,
      providerUsed,
    };
  } catch (err: any) {
    console.error("[Critic] Error:", err.message);
    return heuristicScore(resume, jobDescription, atsThreshold);
  }
}

// ── Prompt Builder ─────────────────────────────────────────

function buildCriticPrompt(
  resume: DraftedResume,
  jobDescription: string,
  jobTitle: string,
): string {
  const resumeText = formatResumeForReview(resume);

  return `You are an expert ATS (Applicant Tracking System) resume evaluator.

## YOUR TASK
Evaluate the following resume against the target job description. Score it on 5 criteria (each 0-20 points, total 0-100).

## TARGET JOB
Title: ${jobTitle}
Description: ${jobDescription}

## RESUME TO EVALUATE
${resumeText}

## SCORING CRITERIA (0-20 each)
1. **keywordCoverage** (0-20): How well does the resume mirror keywords from the job description? Look for: role-specific terms, technologies, methodologies.
2. **quantification** (0-20): Do bullet points include quantifiable metrics? (%, numbers, time saved, users impacted, etc.)
3. **actionVerbs** (0-20): Do bullets start with strong action verbs? (Built, Engineered, Reduced, Optimized vs. Worked on, Helped, Did)
4. **sectionCompleteness** (0-20): Does the resume have all critical sections? (Summary, Skills, Experience/Projects, Education)
5. **relevance** (0-20): Is the content specifically tailored to THIS job, or generic?

## OUTPUT FORMAT
Return ONLY valid JSON:
{
  "atsScore": <total score 0-100>,
  "keywordCoverage": <0-20>,
  "quantification": <0-20>,
  "actionVerbs": <0-20>,
  "sectionCompleteness": <0-20>,
  "relevance": <0-20>,
  "feedback": "<Specific, actionable improvement suggestions. Be concise — max 3 suggestions.>"
}`;
}

function formatResumeForReview(resume: DraftedResume): string {
  const parts: string[] = [];

  parts.push(`SUMMARY: ${resume.professionalSummary}`);
  parts.push(`SKILLS: ${resume.skills.join(", ")}`);

  for (const exp of resume.experience) {
    parts.push(`EXPERIENCE: ${exp.role} at ${exp.company} (${exp.duration})`);
    for (const b of exp.bullets) {
      parts.push(`  • ${b}`);
    }
  }

  for (const proj of resume.projects) {
    parts.push(`PROJECT: ${proj.name} [${proj.techStack.join(", ")}]`);
    for (const b of proj.bullets) {
      parts.push(`  • ${b}`);
    }
  }

  for (const edu of resume.education) {
    parts.push(`EDUCATION: ${edu.degree} from ${edu.institution} (${edu.year})`);
  }

  return parts.join("\n");
}

// ── Response Parser ────────────────────────────────────────

function parseCriticResponse(raw: string): Omit<CriticResult, "approved" | "success"> | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    if (typeof parsed.atsScore !== "number") return null;

    return {
      atsScore: Math.min(100, Math.max(0, Math.round(parsed.atsScore))),
      feedback: parsed.feedback || "",
      details: {
        keywordCoverage: parsed.keywordCoverage ?? 0,
        quantification: parsed.quantification ?? 0,
        actionVerbs: parsed.actionVerbs ?? 0,
        sectionCompleteness: parsed.sectionCompleteness ?? 0,
        relevance: parsed.relevance ?? 0,
      },
    };
  } catch {
    return null;
  }
}

// ── Heuristic Fallback ─────────────────────────────────────

function heuristicScore(
  resume: DraftedResume,
  jobDescription: string,
  atsThreshold: number,
): CriticResult {
  const jobWords = new Set(
    jobDescription
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  );

  // Keyword coverage: check how many job keywords appear in skills
  const skillWords = new Set(resume.skills.map((s) => s.toLowerCase()));
  const matchedKeywords = [...jobWords].filter((w) => skillWords.has(w));
  const keywordCoverage = Math.min(20, Math.round((matchedKeywords.length / Math.max(jobWords.size, 1)) * 40));

  // Quantification: check for numbers in bullets
  const allBullets = [
    ...resume.projects.flatMap((p) => p.bullets),
    ...resume.experience.flatMap((e) => e.bullets),
  ];
  const bulletsWithNumbers = allBullets.filter((b) => /\d+/.test(b));
  const quantification = Math.min(20, Math.round((bulletsWithNumbers.length / Math.max(allBullets.length, 1)) * 20));

  // Action verbs: check first word of each bullet
  const actionVerbs = [
    "built", "engineered", "designed", "developed", "implemented", "optimized",
    "reduced", "increased", "led", "managed", "created", "deployed", "automated",
    "integrated", "architected", "launched", "streamlined", "improved", "achieved",
    "spearheaded", "orchestrated", "delivered", "migrated", "scaled", "refactored",
  ];
  const verbBullets = allBullets.filter((b) => {
    const firstWord = b.trim().split(" ")[0]?.toLowerCase();
    return actionVerbs.includes(firstWord);
  });
  const verbScore = Math.min(20, Math.round((verbBullets.length / Math.max(allBullets.length, 1)) * 20));

  // Section completeness
  let sectionScore = 0;
  if (resume.professionalSummary) sectionScore += 5;
  if (resume.skills.length > 0) sectionScore += 5;
  if (resume.projects.length > 0 || resume.experience.length > 0) sectionScore += 5;
  if (resume.education.length > 0) sectionScore += 5;

  // Relevance (simple keyword overlap)
  const relevance = Math.min(20, keywordCoverage + 5);

  const atsScore = keywordCoverage + quantification + verbScore + sectionScore + relevance;

  return {
    atsScore,
    feedback: atsScore < atsThreshold
      ? "Consider adding more quantifiable metrics, use stronger action verbs, and mirror more keywords from the job description."
      : "Resume meets ATS threshold.",
    details: {
      keywordCoverage,
      quantification,
      actionVerbs: verbScore,
      sectionCompleteness: sectionScore,
      relevance,
    },
    approved: atsScore >= atsThreshold,
    success: true,
  };
}
