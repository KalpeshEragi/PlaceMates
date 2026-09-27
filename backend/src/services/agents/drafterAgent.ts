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

import { callLLMWithMetadata } from "../ai/llmClient";
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
  modelUsed?: string;     // e.g. "groq/llama-3.3-70b-versatile"
  providerUsed?: string;  // e.g. "groq"
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

    const result = await callLLMWithMetadata(prompt, {
      temperature: 0.4,
      maxTokens: 3000,
      role: "drafter",
    });

    const rawResponse = result?.content ?? null;
    const modelUsed = result ? `${result.provider}/${result.model}` : undefined;
    const providerUsed = result?.provider;

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

    console.log(`[Drafter] ✅ Resume generated for "${jobTitle}" at "${jobCompany}" via ${modelUsed}`);
    return { resume: parsed, rawResponse, success: true, modelUsed, providerUsed };
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
  let prompt = `You are a STRICT, high-accuracy resume generation system.

## YOUR TASK
Generate a COMPLETE, CLEAN, FACTUALLY CORRECT, and JOB-SPECIFIC resume using ONLY the provided candidate data and job description.

## TARGET JOB
- Title: ${jobTitle}
- Company: ${jobCompany}
- Description: ${jobDescription}

## CANDIDATE PROFILE (THIS IS THE ONLY SOURCE OF TRUTH)
${userProfile}

`;

  // Add RAG examples if available
  if (examples.length > 0) {
    prompt += `\n## REFERENCE EXAMPLES (use ONLY as quality/style benchmarks — do NOT copy content)\n`;
    for (const ex of examples.slice(0, 2)) {
      prompt += `\n### Style Example (${ex.domain}, ${ex.experienceLevel})
- Summary style: ${ex.summary.slice(0, 150)}...
- Bullet style: ${ex.experience[0]?.description?.slice(0, 120) || "N/A"}
`;
    }
  }

  // Add critic feedback for iterative refinement
  if (criticFeedback) {
    prompt += `\n## CRITIC FEEDBACK (address these issues in this draft)
${criticFeedback}
`;
  }

  prompt += `
## 🚨 NON-NEGOTIABLE RULES

### RULE 1: NO FAKE DATA
- Do NOT invent companies, roles, or experience
- Do NOT assume "5+ years experience" or any duration not in the data
- Do NOT add skills, tools, or technologies the candidate does not have
- If the job requires "Docker" but the candidate has no Docker experience → DO NOT add Docker

### RULE 2: NO POISON VALUES
- Never output "null", "undefined", "N/A", "Not Provided", "None", or "TBD"
- If a field is missing from candidate data → omit it entirely or leave it as empty string ""
- Dates: use ONLY exact dates from candidate data. If missing, use ""

### RULE 3: USE REAL PROJECT NAMES
- Use the candidate's ACTUAL project names as given
- If a project name has hyphens or is very long, use a SHORT readable version
  Example: "nlp-based-computational-analysis-of-patent-novelty" → "Patent Novelty Analysis Tool"
- Keep project names SHORT (max 5-6 words)

### RULE 4: UNIQUE BULLETS — NO REPETITION
- Each bullet point MUST be unique and describe a DIFFERENT aspect of the project
- NEVER repeat the same sentence structure across bullets
- BAD: "Engineered X for Y using Z, enabling secure and scalable operations" (repeated 4 times)
- GOOD: Each bullet covers a different feature, challenge, or achievement
- Write 2-3 bullets per project, each about a DIFFERENT thing the candidate did

### RULE 5: JOB ALIGNMENT (WITHOUT FABRICATION)
- Rephrase and highlight relevant skills from candidate data that match the job
- Prioritize projects and experience most relevant to this job
- Mirror job keywords NATURALLY — do not force-fit them
- If the candidate is a student with limited experience, focus on Projects and Skills

### RULE 6: SKILLS SELECTION
- Include ONLY skills the candidate actually has
- Limit to 12-18 most relevant skills for THIS job
- Do NOT list every skill — prioritize job-relevant ones first

### RULE 7: COMPLETENESS
- Include ALL sections the candidate has data for: Summary, Skills, Experience, Projects, Education, Certifications, Awards
- Do NOT skip any section that has real data

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown fences, no explanation):
{
  "professionalSummary": "2-3 sentence summary tailored to this job. Do NOT repeat this text anywhere else in the resume.",
  "skills": ["Skill1", "Skill2"],
  "projects": [
    {
      "name": "Short Readable Project Name",
      "techStack": ["Tech1", "Tech2"],
      "bullets": ["Unique bullet about feature A", "Unique bullet about feature B"]
    }
  ],
  "experience": [
    {
      "role": "Exact Role from candidate data",
      "company": "Exact Company from candidate data",
      "duration": "Exact dates from candidate data or empty string",
      "bullets": ["What they actually did — no fabrication"]
    }
  ],
  "education": [
    {
      "degree": "Exact degree",
      "institution": "Exact institution",
      "year": "Graduation year or date range",
      "details": "GPA or honors if provided, otherwise omit"
    }
  ],
  "certifications": [{"name": "Exact cert name", "issuer": "Exact issuer"}],
  "awards": ["Exact award as provided"]
}

## SELF-CHECK BEFORE OUTPUT
1. Did I add anything NOT in the candidate profile? → REMOVE IT
2. Did I include all candidate data? → ADD if missing
3. Are all bullets UNIQUE (no repetition)? → REWRITE if duplicated
4. Are project names short and readable? → SHORTEN if too long
5. Is "null", "undefined", "N/A" anywhere? → REMOVE IT
6. Is the summary written only ONCE? → Check`;

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
