/**
 * ai/projectEnrichmentService.ts
 *
 * Single LLM call to enrich ALL selected projects at once.
 * Returns null on any failure — caller uses offline fallback.
 *
 * Token budget: ~3,000 tokens per user (6 projects).
 * 100 users/day = 300K tokens/day. Groq free tier = 500K/day. ✅
 */

import { callLLM } from "./llmClient";

// ─── Types ─────────────────────────────────────────────────

export interface ProjectContext {
  name: string;
  userIntent: string;
  repoDescription: string | null;
  readmeExcerpt: string | null;
  techStack: string[];
  domain: string | null;
  stars: number;
  forks: number;
  collaborators: number;
  modules: string[];
  features: string[];
  architectureStyle: string;
  baseBullets: string[];
}

export interface EnrichedProject {
  name: string;
  description: string;
  bulletPoints: string[];
  skills: string[];
  complexity: "beginner" | "intermediate" | "advanced";
  uniqueAngle: string;
}

// ─── Prompt Builder ────────────────────────────────────────

function buildBatchPrompt(projects: ProjectContext[]): string {
  const projectEntries = projects.map((p, i) => {
    const lines = [
      `PROJECT ${i + 1}: ${p.name}`,
      `USER DESCRIPTION: ${p.userIntent}`,
      `GITHUB DESCRIPTION: ${p.repoDescription || "N/A"}`,
    ];

    if (p.readmeExcerpt) {
      // Truncate to save tokens — take meaningful first few lines
      const excerpt = p.readmeExcerpt
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .slice(0, 8)
        .join("\n");
      lines.push(`README EXCERPT:\n${excerpt}`);
    }

    lines.push(`TECH STACK: ${p.techStack.slice(0, 6).join(", ") || "N/A"}`);
    lines.push(`DOMAIN: ${p.domain || "N/A"}`);
    lines.push(`ARCHITECTURE: ${p.architectureStyle || "N/A"}`);

    if (p.features.length > 0) {
      lines.push(`FEATURES: ${p.features.slice(0, 5).join(", ")}`);
    }
    if (p.modules.length > 0) {
      lines.push(`MODULES: ${p.modules.slice(0, 5).join(", ")}`);
    }

    lines.push(`STARS: ${p.stars} | FORKS: ${p.forks} | COLLABORATORS: ${p.collaborators}`);

    if (p.baseBullets.length > 0) {
      lines.push(`EXISTING BULLETS:\n${p.baseBullets.slice(0, 3).map((b) => `- ${b}`).join("\n")}`);
    }

    return lines.join("\n");
  });

  return `Analyze these ${projects.length} GitHub projects and generate structured insights for each.

${projectEntries.join("\n\n---\n\n")}

Respond with a JSON object matching this exact schema:
{
  "projects": [
    {
      "name": "exact project name from input",
      "description": "2-3 sentences describing the project, highlighting what makes it unique or impressive",
      "bulletPoints": ["exactly 4 resume-ready bullet points, each starting with a strong action verb, each mentioning specific technologies"],
      "skills": ["top 5 specific skills this project demonstrates, e.g. 'React state management' not just 'React'"],
      "complexity": "beginner or intermediate or advanced",
      "uniqueAngle": "1-2 sentences about what makes this project stand out, any novel approach or research angle"
    }
  ]
}

Rules:
- Each bullet MUST start with a different strong action verb (Engineered, Built, Designed, Implemented, Architected, Developed, Optimized, Integrated, etc.)
- Each bullet MUST reference at least one specific technology from the tech stack
- Description should highlight what's UNIQUE about the project, not just restate what it does
- Skills should be specific and demonstrable (e.g. "RESTful API design" not "API")
- uniqueAngle should identify any research angle, novel technical approach, or interesting engineering challenge
- Return projects in the SAME order as the input
- Do NOT wrap the response in markdown code fences`;
}

// ─── Parser ────────────────────────────────────────────────

function parseResponse(raw: string, projectNames: string[]): EnrichedProject[] | null {
  try {
    // Try to extract JSON from the response (handle possible markdown fences)
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.projects || !Array.isArray(parsed.projects)) {
      console.warn("[AI Enrichment] Response missing 'projects' array");
      return null;
    }

    const results: EnrichedProject[] = [];

    for (const p of parsed.projects) {
      if (!p.name || typeof p.name !== "string") continue;

      results.push({
        name: p.name,
        description:
          typeof p.description === "string" ? p.description : "",
        bulletPoints: Array.isArray(p.bulletPoints)
          ? p.bulletPoints.filter((b: unknown) => typeof b === "string").slice(0, 4)
          : [],
        skills: Array.isArray(p.skills)
          ? p.skills.filter((s: unknown) => typeof s === "string").slice(0, 5)
          : [],
        complexity:
          ["beginner", "intermediate", "advanced"].includes(p.complexity)
            ? p.complexity
            : "intermediate",
        uniqueAngle:
          typeof p.uniqueAngle === "string" ? p.uniqueAngle : "",
      });
    }

    if (results.length === 0) {
      console.warn("[AI Enrichment] No valid projects in response");
      return null;
    }

    return results;
  } catch (err) {
    console.error("[AI Enrichment] Failed to parse LLM response:", err);
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────

/**
 * Enrich all projects with a SINGLE LLM call.
 * Returns null on any failure — caller must use offline fallback.
 */
export async function enrichAllProjects(
  projects: ProjectContext[],
): Promise<EnrichedProject[] | null> {
  if (projects.length === 0) return null;

  const prompt = buildBatchPrompt(projects);
  const projectNames = projects.map((p) => p.name);

  console.log(`[AI Enrichment] Sending ${projects.length} projects to LLM (single call)...`);

  const raw = await callLLM(prompt, {
    temperature: 0.3,
    maxTokens: 2048,
  });

  if (!raw) {
    console.warn("[AI Enrichment] LLM returned null — using offline fallback");
    return null;
  }

  const enriched = parseResponse(raw, projectNames);

  if (enriched) {
    console.log(`[AI Enrichment] Successfully enriched ${enriched.length}/${projects.length} projects`);
  }

  return enriched;
}
