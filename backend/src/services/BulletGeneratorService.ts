/**
 * bulletGeneratorService.ts
 *
 * Responsibilities:
 *   1. generateProjectBullets   — produce 4 base resume bullets via AI (no metrics yet)
 *   2. injectMetricsIntoBullets — take quiz answers and inject metrics into base bullets
 *   3. generateUserSummary      — produce a 2–3 sentence career summary from aggregated data
 *
 * All AI calls go through the Anthropic API (claude-sonnet-4-20250514).
 * Responses must be valid JSON — no markdown fences, no preamble.
 */

import { prisma } from "../lib/prisma";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type BulletGenerationInput = {
  projectName: string;
  projectType: "solo" | "collaborative";
  techStack: string[];
  modules: string[];
  domain: string | null;
  readmeSummary: string | null;
  commitMessages: string[];
  contributionFiles: string[];
};

/** Answers collected from the per-project quiz on the frontend. */
export type QuizAnswers = {
  improvements: string;      // e.g. "reduced page load time by 40%"
  reductions: string;        // e.g. "cut API latency from 800 ms to 200 ms"
  usageScale: string;        // e.g. "used by 500+ students"
  additionalContext?: string;
};

export type UserSummaryInput = {
  topProjects: {
    name: string;
    domain: string | null;
    techStack: string[];
    bullets: string[];
  }[];
  topSkills: string[];
  topDomains: string[];
};

// ─────────────────────────────────────────────
// Shared AI call helper
// ─────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

async function callAI(systemPrompt: string, userContent: string): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as {
    content: { type: string; text?: string }[];
  };

  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  return text.trim();
}

function safeParseJSON<T>(raw: string, fallback: T): T {
  try {
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────
// 1. Base bullet generation
// ─────────────────────────────────────────────

const BULLET_SYSTEM_PROMPT = `
You are a professional resume writer specialising in software engineering roles.
Given information about a software project, produce exactly 4 concise resume bullet points.

Bullet structure (one per type, in this order):
  1. Build/Develop  — what was built, with tech stack
  2. Feature        — a notable feature or capability implemented
  3. Optimization   — a technical decision that improved quality, performance, or maintainability
  4. Impact         — the project's purpose or outcome (NO fabricated metrics — use placeholders like [X]% or [N] users if unknown)

Rules:
  - Start each bullet with a strong action verb (Built, Developed, Implemented, Optimised, Designed, …)
  - Keep each bullet under 25 words
  - Never invent specific numbers — use placeholders instead
  - For collaborative projects, focus only on the user's contribution area (inferred from files/commits)
  - Return ONLY a JSON array of 4 strings, no markdown, no extra keys

Example output:
["Built a REST API using Node.js and PostgreSQL to serve [X] concurrent users.",
 "Implemented JWT-based authentication reducing unauthorised access by [X]%.",
 "Optimised database queries cutting average response time from [X]ms to [Y]ms.",
 "Deployed on AWS enabling [N] users to track personal finance goals in real-time."]
`.trim();

export async function generateProjectBullets(input: BulletGenerationInput): Promise<string[]> {
  const context = JSON.stringify({
    projectName: input.projectName,
    projectType: input.projectType,
    techStack: input.techStack.slice(0, 8),
    modules: input.modules.slice(0, 6),
    domain: input.domain,
    readmeSummary: input.readmeSummary?.slice(0, 500) ?? null,
    recentCommitMessages: input.commitMessages.slice(0, 10),
    filesChanged: input.contributionFiles.slice(0, 20),
  });

  const raw = await callAI(BULLET_SYSTEM_PROMPT, context);
  const bullets = safeParseJSON<string[]>(raw, []);

  // Ensure exactly 4 bullets — pad with a generic fallback if AI returns fewer
  while (bullets.length < 4) {
    bullets.push(`Contributed to ${input.projectName} using ${input.techStack[0] ?? "modern technologies"}.`);
  }

  return bullets.slice(0, 4);
}

// ─────────────────────────────────────────────
// 2. Metric injection (quiz step)
// ─────────────────────────────────────────────

const INJECT_SYSTEM_PROMPT = `
You are a resume editor. You will be given:
  - 4 resume bullet points that contain metric placeholders like [X]%, [N] users, [X]ms
  - Real metric answers provided by the developer

Your task:
  - Replace placeholders with the real metrics where they naturally fit
  - Reword bullets only as needed to incorporate the metrics smoothly
  - Do NOT add metrics that weren't provided — leave remaining placeholders as-is
  - Keep each bullet under 30 words
  - Return ONLY a JSON array of 4 strings, no markdown, no extra keys
`.trim();

export async function injectMetricsIntoBullets(
  projectId: string,
  userId: string,
  answers: QuizAnswers,
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, baseBullets: true, finalBullets: true },
  });

  if (!project || project.userId !== userId) {
    throw new Error("Project not found or access denied.");
  }

  const baseBullets = project.baseBullets as string[];

  const userContent = JSON.stringify({
    baseBullets,
    quizAnswers: {
      improvements: answers.improvements,
      reductions: answers.reductions,
      usageScale: answers.usageScale,
      additionalContext: answers.additionalContext ?? "",
    },
  });

  const raw = await callAI(INJECT_SYSTEM_PROMPT, userContent);
  const finalBullets = safeParseJSON<string[]>(raw, baseBullets);

  const result = finalBullets.slice(0, 4);

  // Persist finalBullets immediately
  await prisma.project.update({
    where: { id: projectId },
    data: { finalBullets: result, updatedAt: new Date() },
  });

  return result;
}

// ─────────────────────────────────────────────
// 3. User summary generation
// ─────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `
You are a professional career coach writing a developer profile summary.
Given a developer's top projects, skills, and dominant tech domains, write a 2–3 sentence summary
that could appear at the top of a resume or portfolio.

Rules:
  - Focus on what the developer builds, not generic adjectives ("passionate", "dedicated")
  - Mention 2–3 specific technologies or domains
  - Do NOT use first-person ("I", "my") — write in third-person present tense
  - Return ONLY a plain string (no JSON, no markdown)
`.trim();

export async function generateUserSummary(input: UserSummaryInput): Promise<string> {
  const context = JSON.stringify({
    topDomains: input.topDomains,
    topSkills: input.topSkills.slice(0, 10),
    projects: input.topProjects.slice(0, 5).map((p) => ({
      name: p.name,
      domain: p.domain,
      techStack: p.techStack.slice(0, 5),
      sampleBullet: p.bullets[0] ?? "",
    })),
  });

  const summary = await callAI(SUMMARY_SYSTEM_PROMPT, context);
  return summary || "Full-stack developer with experience building production-grade web applications.";
}