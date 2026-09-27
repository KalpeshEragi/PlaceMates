/**
 * ResumeExtractionService.ts
 *
 * End-to-end resume ingestion pipeline:
 *   1. Extract raw text from PDF via pdf-parse
 *   2. Send text to LLM with a strict JSON schema prompt
 *   3. Parse the LLM JSON response
 *   4. Insert/upsert structured data into Prisma tables
 *   5. Trigger user embedding regeneration
 *
 * Follows the same data-flow pattern as linkedinAnalysisService.ts:
 *   file → parse → persist → enrich embeddings
 */

import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { prisma } from "../lib/prisma";
import { callLLM } from "./ai/llmClient";
import { normalizeSkillName } from "./utils/textUtils";
import { inferSkillDomain } from "./analysis/domainDetector";
import { refreshUserEmbedding } from "./semantic/semanticMatchingService";

// ─────────────────────────────────────────────
// Types — mirrors the JSON schema sent to the LLM
// ─────────────────────────────────────────────

interface ResumeSkill {
  name: string;
  domain?: string;
}

interface ResumeExperience {
  role: string;
  company: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

interface ResumeEducation {
  institution: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
}

interface ResumeProject {
  name: string;
  projectType?: string;
  techStack?: string[];
  description?: string;
}

interface ResumeCertification {
  name: string;
  issuer?: string;
  issuedAt?: string;
}

interface ParsedResume {
  skills: ResumeSkill[];
  experiences: ResumeExperience[];
  educations: ResumeEducation[];
  projects: ResumeProject[];
  certifications: ResumeCertification[];
}

// ─────────────────────────────────────────────
// PDF text extraction
// ─────────────────────────────────────────────

async function extractTextFromPDF(filePath: string): Promise<string> {
  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Resume file not found: ${absolutePath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  const data = await pdfParse(buffer);

  const text = data.text?.trim();
  if (!text || text.length < 50) {
    throw new Error("Extracted text is too short — the PDF may be image-based or empty.");
  }

  console.log(`[ResumeExtraction] Extracted ${text.length} characters from PDF.`);
  return text;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * The LLM occasionally returns `description` as an array of bullet objects
 * (e.g. [{bullet: "..."}]) instead of a plain string. This helper coerces
 * any non-string value into a single joined string so Prisma never receives
 * an invalid type.
 */
function normalizeDescription(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value || null;

  if (Array.isArray(value)) {
    return (
      value
        .map((item) =>
          typeof item === "string"
            ? item
            : typeof item === "object" && item !== null
              ? (item as Record<string, unknown>).bullet ??
                (item as Record<string, unknown>).text ??
                JSON.stringify(item)
              : String(item)
        )
        .join("\n• ") || null
    );
  }

  if (typeof value === "object") return JSON.stringify(value);
  return String(value) || null;
}

// ─────────────────────────────────────────────
// LLM prompt construction
// ─────────────────────────────────────────────

function buildExtractionPrompt(resumeText: string): string {
  return `You are a resume parsing assistant. Extract structured data from the resume text below.

Return ONLY a valid JSON object with this exact schema — no markdown, no explanation, no code fences:

{
  "skills": [
    { "name": "React", "domain": "Frontend" }
  ],
  "experiences": [
     { "role": "Software Engineer", "company": "Google", "startDate": "Jan 2020", "endDate": "Present", "description": "Built and maintained large-scale distributed systems. Led migration of legacy services to microservices architecture." }
  ],
  "educations": [
    { "institution": "MIT", "degree": "B.S.", "field": "Computer Science", "startDate": "Sep 2016", "endDate": "May 2020", "gpa": "3.8" }
  ],
  "projects": [
    { "name": "Portfolio", "projectType": "solo", "techStack": ["Next.js", "Tailwind"], "description": "My portfolio website" }
  ],
  "certifications": [
    { "name": "AWS Certified Solutions Architect", "issuer": "AWS", "issuedAt": "2021" }
  ]
}

Rules:
- "domain" for skills must be one of: Frontend, Backend, ML / AI, DevOps, Mobile, Other
- "projectType" must be "solo" or "collaborative"
- Dates should be in "Mon YYYY" format (e.g., "Jan 2020") when possible
- If a field is not found in the resume, omit it or use null
- If no items exist for a category, return an empty array []
- Extract ALL skills, experiences, educations, projects, and certifications you can find
- IMPORTANT: "description" fields must ALWAYS be a single plain string, NEVER an array or object. Combine multiple bullet points into one string separated by ". " or "; ".
- For experience descriptions, write concise, resume-ready sentences summarizing the role

RESUME TEXT:
${resumeText}`;
}

// ─────────────────────────────────────────────
// LLM response parsing
// ─────────────────────────────────────────────

function parseLLMResponse(raw: string): ParsedResume {
  // Strip markdown code fences if the LLM wrapped the JSON
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned invalid JSON. Raw response (first 500 chars): ${raw.slice(0, 500)}`);
  }

  return {
    skills:         Array.isArray(parsed.skills)         ? parsed.skills         : [],
    experiences:    Array.isArray(parsed.experiences)    ? parsed.experiences    : [],
    educations:     Array.isArray(parsed.educations)     ? parsed.educations     : [],
    projects:       Array.isArray(parsed.projects)       ? parsed.projects       : [],
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
  };
}

// ─────────────────────────────────────────────
// Database persistence helpers
// ─────────────────────────────────────────────

async function persistSkills(userId: string, skills: ResumeSkill[]): Promise<void> {
  if (!skills.length) return;

  for (const skill of skills) {
    const name = normalizeSkillName(skill.name);
    if (!name) continue;

    const domain = skill.domain || inferSkillDomain(name);

    await prisma.skill.upsert({
      where:  { userId_name: { userId, name } },
      create: { userId, name, domain, source: "resume" },
      update: { domain, source: "resume" },
    });
  }

  console.log(`[ResumeExtraction] Persisted ${skills.length} skills.`);
}

async function persistExperiences(userId: string, experiences: ResumeExperience[]): Promise<void> {
  if (!experiences.length) return;

  // Resume import replaces all existing experiences (same as LinkedIn flow)
  await prisma.experience.deleteMany({ where: { userId } });

  await prisma.experience.createMany({
    data: experiences.map((exp) => ({
      userId,
      role:        exp.role        || "Unknown Role",
      company:     exp.company     || "Unknown Company",
      startDate:   exp.startDate   || null,
      endDate:     exp.endDate     || null,
      description: normalizeDescription(exp.description),
    })),
  });

  console.log(`[ResumeExtraction] Persisted ${experiences.length} experiences.`);
}

async function persistEducations(userId: string, educations: ResumeEducation[]): Promise<void> {
  if (!educations.length) return;

  await prisma.education.deleteMany({ where: { userId } });

  await prisma.education.createMany({
    data: educations.map((edu) => ({
      userId,
      institution: edu.institution || "Unknown Institution",
      degree:      edu.degree      || null,
      field:       edu.field       || null,
      startDate:   edu.startDate   || null,
      endDate:     edu.endDate     || null,
      gpa:         edu.gpa         || null,
    })),
  });

  console.log(`[ResumeExtraction] Persisted ${educations.length} educations.`);
}

async function persistProjects(userId: string, projects: ResumeProject[]): Promise<void> {
  if (!projects.length) return;

  for (const proj of projects) {
    const name = proj.name || "Untitled Project";
    // Use a synthetic repoUrl for resume-sourced projects (no real repo URL)
    const repoUrl = `resume://${userId}/${name.toLowerCase().replace(/\s+/g, "-")}`;

    await prisma.project.upsert({
      where: { userId_repoUrl: { userId, repoUrl } },
      create: {
        userId,
        name,
        repoUrl,
        domain:      null,
        projectType: proj.projectType || "solo",
        techStack:   proj.techStack   || [],
        baseBullets: normalizeDescription(proj.description) ? [normalizeDescription(proj.description)!] : [],
        finalBullets: [],
        description: normalizeDescription(proj.description),
      },
      update: {
        name,
        projectType: proj.projectType || "solo",
        techStack:   proj.techStack   || [],
        baseBullets: normalizeDescription(proj.description) ? [normalizeDescription(proj.description)!] : [],
        description: normalizeDescription(proj.description),
      },
    });
  }

  console.log(`[ResumeExtraction] Persisted ${projects.length} projects.`);
}

async function persistCertifications(userId: string, certifications: ResumeCertification[]): Promise<void> {
  if (!certifications.length) return;

  await prisma.certification.deleteMany({ where: { userId } });

  await prisma.certification.createMany({
    data: certifications.map((cert) => ({
      userId,
      name:     cert.name     || "Certification",
      issuer:   cert.issuer   || null,
      issuedAt: cert.issuedAt || null,
    })),
  });

  console.log(`[ResumeExtraction] Persisted ${certifications.length} certifications.`);
}

// ─────────────────────────────────────────────
// Main pipeline
// ─────────────────────────────────────────────

/**
 * Process a user's uploaded resume PDF.
 *
 * Pipeline:
 *   1. Extract text from PDF
 *   2. Send to LLM for structured extraction
 *   3. Persist all extracted data to database
 *   4. Trigger embedding regeneration
 *
 * @param userId - The authenticated user's ID
 * @throws Error if PDF extraction or LLM call fails
 */
export async function processResume(userId: string): Promise<void> {
  const user = await prisma.userAuth.findUnique({
    where:  { id: userId },
    select: { resumeFilePath: true },
  });

  if (!user?.resumeFilePath) {
    throw new Error("Resume file path not found for this user.");
  }

  console.log(`[ResumeExtraction] Starting pipeline for user ${userId}...`);

  try {
    // ── Step 1: Extract raw text ──────────────────────────
    const rawText = await extractTextFromPDF(user.resumeFilePath);

    // ── Step 2: Send to LLM for extraction ────────────────
    const prompt = buildExtractionPrompt(rawText);
    const llmResponse = await callLLM(prompt, {
      temperature: 0.1,
      maxTokens: 4096,
      role: "default",
    });

    if (!llmResponse) {
      throw new Error("LLM returned no response — all providers may be unavailable.");
    }

    // ── Step 3: Parse LLM JSON ────────────────────────────
    const resumeData = parseLLMResponse(llmResponse);

    console.log(
      `[ResumeExtraction] Parsed: ` +
      `${resumeData.skills.length} skills, ` +
      `${resumeData.experiences.length} experiences, ` +
      `${resumeData.educations.length} educations, ` +
      `${resumeData.projects.length} projects, ` +
      `${resumeData.certifications.length} certifications`
    );

    // ── Step 4: Persist to database ───────────────────────
    await persistSkills(userId, resumeData.skills);
    await persistExperiences(userId, resumeData.experiences);

    await Promise.all([
      persistEducations(userId, resumeData.educations),
      persistProjects(userId, resumeData.projects),
      persistCertifications(userId, resumeData.certifications),
    ]);

    // Mark resume as fully processed and advance onboarding stage
    await prisma.userAuth.update({
      where: { id: userId },
      data:  { 
        resumeUploaded: true,
        onboardingStage: "ready",
        analysisStatus: "success",
        onboardingQuizCompletedAt: new Date() // bypass project selection/quiz
      },
    });

    // ── Step 5: Trigger embedding regeneration ────────────
    try {
      const embeddingOk = await refreshUserEmbedding(userId);
      if (embeddingOk) {
        console.log(`[ResumeExtraction] ✅ User embedding regenerated for ${userId}.`);
      } else {
        console.warn(`[ResumeExtraction] ⚠️ Embedding regeneration returned false (service may be down).`);
      }
    } catch (err) {
      // Non-fatal — data is saved, embeddings can be regenerated later
      console.error(`[ResumeExtraction] Embedding regeneration failed:`, err);
    }

    console.log(`[ResumeExtraction] ✅ Pipeline complete for user ${userId}.`);
  } catch (err) {
    console.error(`[ResumeExtraction] Pipeline failed for user ${userId}:`, err);
    await prisma.userAuth.update({
      where: { id: userId },
      data: {
        analysisStatus: "failed",
        analysisError: err instanceof Error ? err.message : "Unknown extraction error",
      },
    });
  }
}
