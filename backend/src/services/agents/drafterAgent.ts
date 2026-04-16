/**
 * drafterAgent.ts
 *
 * Phase 6: Drafter Agent — generates structured resume data from:
 *   - User profile (skills, projects, experience)
 *   - Target job description
 *   - Retrieved resume examples (RAG context)
 *   - (Optional) Critic feedback from previous iterations
 *
 * Uses the existing callLLM() from services/ai/llmClient.ts.
 */

import { callLLM } from "../ai/llmClient";
import type { RetrievedExample } from "./retrieverAgent";

export interface DraftedResume {
  professionalSummary: string;
  skills: string[];
  projects: Array<{
    name: string;
    techStack: string[];
    bullets: string[];
  }>;
  experience: Array<{
    role: string;
    company: string;
    duration: string;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    details?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
  }>;
  awards: string[];
}

export interface DrafterResult {
  resume: DraftedResume | null;
  rawResponse: string | null;
  success: boolean;
}

/**
 * Generate a tailored resume using the LLM with RAG context.
 *
 * @param userProfile - Flat text encoding of the user's profile
 * @param jobDescription - Target job description
 * @param jobTitle - Target job title
 * @param jobCompany - Target company name
 * @param examples - Retrieved resume examples (RAG context)
 * @param criticFeedback - Optional feedback from the Critic agent (for iterations)
 */
export async function draft(params: {
  userProfile: string;
  jobDescription: string;
  jobTitle: string;
  jobCompany: string;
  examples: RetrievedExample[];
  criticFeedback?: string;
}): Promise<DrafterResult> {
  const { userProfile, jobDescription, jobTitle, jobCompany, examples, criticFeedback } = params;

  try {
    const prompt = buildDrafterPrompt(
      userProfile,
      jobDescription,
      jobTitle,
      jobCompany,
      examples,
      criticFeedback,
    );

    const rawResponse = await callLLM(prompt, {
      temperature: 0.4,
      maxTokens: 3000,
    });

    if (!rawResponse) {
      console.error("[Drafter] LLM returned null");
      return { resume: null, rawResponse: null, success: false };
    }

    // Parse the JSON response
    const parsed = parseResumeResponse(rawResponse);
    if (!parsed) {
      console.error("[Drafter] Failed to parse LLM response");
      return { resume: null, rawResponse, success: false };
    }

    console.log(`[Drafter] Successfully generated resume for "${jobTitle}" at "${jobCompany}"`);
    return { resume: parsed, rawResponse, success: true };
  } catch (err: any) {
    console.error("[Drafter] Error:", err.message);
    return { resume: null, rawResponse: null, success: false };
  }
}

// ── Prompt Builder ─────────────────────────────────────────

function buildDrafterPrompt(
  userProfile: string,
  jobDescription: string,
  jobTitle: string,
  jobCompany: string,
  examples: RetrievedExample[],
  criticFeedback?: string,
): string {
  let prompt = `You are a senior resume writer specializing in ATS-optimized resumes for tech jobs.

## YOUR TASK
Generate a tailored resume for the following job posting. The resume must be optimized for ATS (Applicant Tracking Systems) while remaining natural and compelling.

## TARGET JOB
- Title: ${jobTitle}
- Company: ${jobCompany}
- Description: ${jobDescription}

## CANDIDATE PROFILE
${userProfile}
`;

  // Add RAG examples if available
  if (examples.length > 0) {
    prompt += `\n## REFERENCE RESUME EXAMPLES (use these as quality benchmarks — do NOT copy them)\n`;
    for (const ex of examples.slice(0, 3)) {
      prompt += `\n### Example (${ex.domain}, ${ex.experienceLevel})
- Summary: ${ex.summary}
- Skills: ${ex.skills.join(", ")}
`;
      if (ex.experience.length > 0) {
        const exp = ex.experience[0];
        prompt += `- Experience: ${exp.role} at ${exp.company}: ${exp.description}\n`;
      }
      if (ex.projects.length > 0) {
        const proj = ex.projects[0];
        prompt += `- Project: ${proj.name}: ${proj.description}\n`;
      }
    }
  }

  // Add critic feedback for iterative refinement
  if (criticFeedback) {
    prompt += `\n## CRITIC FEEDBACK (from previous draft — address these issues)
${criticFeedback}
`;
  }

  prompt += `
## OUTPUT FORMAT
Return ONLY valid JSON with this exact structure:
{
  "professionalSummary": "2-3 sentence tailored summary",
  "skills": ["Skill1", "Skill2", ...],
  "projects": [
    {
      "name": "Project Name",
      "techStack": ["Tech1", "Tech2"],
      "bullets": ["Action-oriented bullet point with quantified impact", ...]
    }
  ],
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "duration": "Start - End",
      "bullets": ["Action-oriented bullet point with quantified impact", ...]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "University",
      "year": "Year",
      "details": "GPA/Honors if relevant"
    }
  ],
  "certifications": [{"name": "Cert Name", "issuer": "Issuer"}],
  "awards": ["Award description"]
}

## CRITICAL RULES
1. Start every bullet with a strong action verb (Built, Engineered, Optimized, Reduced, etc.)
2. Include quantifiable metrics where possible (%, numbers, time saved)
3. Mirror keywords from the job description naturally
4. Keep the summary concise and tailored to THIS specific job
5. Only include skills the candidate actually has
6. Limit to top 3-5 most relevant projects
7. Use the candidate's REAL data — do not fabricate experience or skills`;

  return prompt;
}

// ── Response Parser ────────────────────────────────────────

function parseResumeResponse(raw: string): DraftedResume | null {
  try {
    // Clean up: remove markdown fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.professionalSummary || !parsed.skills) {
      return null;
    }

    return {
      professionalSummary: parsed.professionalSummary || "",
      skills: parsed.skills || [],
      projects: (parsed.projects || []).map((p: any) => ({
        name: p.name || "",
        techStack: p.techStack || [],
        bullets: p.bullets || [],
      })),
      experience: (parsed.experience || []).map((e: any) => ({
        role: e.role || "",
        company: e.company || "",
        duration: e.duration || "",
        bullets: e.bullets || [],
      })),
      education: (parsed.education || []).map((e: any) => ({
        degree: e.degree || "",
        institution: e.institution || "",
        year: e.year || "",
        details: e.details,
      })),
      certifications: (parsed.certifications || []).map((c: any) => ({
        name: c.name || "",
        issuer: c.issuer || "",
      })),
      awards: parsed.awards || [],
    };
  } catch (err) {
    console.error("[Drafter] JSON parse error:", err);
    return null;
  }
}
