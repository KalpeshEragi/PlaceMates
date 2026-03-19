import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

if (!env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not configured");
}

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

function getModel() {
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

export type ComplexityLevel = "Beginner" | "Intermediate" | "Advanced";

export interface ReadmeAnalysis {
  projectSummary: string;
  techStack: string[];
  domain: string;
  complexityLevel: ComplexityLevel;
  keyFeatures: string[];
  resumeScore: number;
  impactScore: number;
  readmeQualityScore: number;
  suggestedSkills: string[];
}

export async function analyzeReadme(readmeContent: string): Promise<ReadmeAnalysis | null> {
  if (!readmeContent.trim()) return null;

  const truncated = readmeContent.slice(0, 15000);
  const model = getModel();

  const prompt = `
You are a precise evaluator of open-source project README files.

Analyze the following README and return ONLY valid JSON matching:

type Analysis = {
  projectSummary: string;
  techStack: string[];
  domain: string;
  complexityLevel: "Beginner" | "Intermediate" | "Advanced";
  keyFeatures: string[];
  resumeScore: number;
  impactScore: number;
  readmeQualityScore: number;
  suggestedSkills: string[];
};

Rules:
- Base everything ONLY on the README text.
- Be conservative when information is missing.
- Deduplicate suggestedSkills and use concise skill names.
- Output STRICT JSON. No markdown, no comments.

README START
${truncated}
README END
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();

  try {
    const parsed = JSON.parse(text);
    return {
      projectSummary: parsed.projectSummary ?? "",
      techStack: parsed.techStack ?? [],
      domain: parsed.domain ?? "Unknown",
      complexityLevel: parsed.complexityLevel ?? "Beginner",
      keyFeatures: parsed.keyFeatures ?? [],
      resumeScore: Number(parsed.resumeScore ?? 0),
      impactScore: Number(parsed.impactScore ?? 0),
      readmeQualityScore: Number(parsed.readmeQualityScore ?? 0),
      suggestedSkills: parsed.suggestedSkills ?? [],
    };
  } catch (err) {
    console.error("Failed to parse Gemini JSON", err);
    return null;
  }
}

export interface JobDescriptionAnalysis {
  role: string;
  requiredSkills: string[];
  domain: string;
  keywords: string[];
  experienceLevel: string;
}

export async function analyzeJobDescriptionWithAI(
  text: string
): Promise<JobDescriptionAnalysis | null> {
  if (!text.trim()) return null;

  const truncated = text.slice(0, 12000);
  const model = getModel();

  const prompt = `
You are a precise job-description parser for a developer career platform.

Analyze the following job description and return ONLY valid JSON matching:

type Analysis = {
  role: string;             // job title / role name
  requiredSkills: string[]; // programming languages, frameworks, tools required
  domain: string;           // industry/technical domain (e.g. "Backend Engineering", "Data Science")
  keywords: string[];       // important keywords/phrases that would appear on a strong resume
  experienceLevel: string;  // one of: "Entry", "Mid", "Senior", "Lead", "Manager"
};

Rules:
- Base everything ONLY on the provided job description.
- Deduplicate all array items.
- Use concise, canonical names (e.g. "React" not "ReactJS library").
- Output STRICT JSON. No markdown, no comments, no explanation.

JOB DESCRIPTION START
${truncated}
JOB DESCRIPTION END
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const raw = result.response.text();

  try {
    const parsed = JSON.parse(raw);
    return {
      role: parsed.role ?? "",
      requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : [],
      domain: parsed.domain ?? "",
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      experienceLevel: parsed.experienceLevel ?? "",
    };
  } catch (err) {
    console.error("[geminiService] Failed to parse JD analysis JSON", err);
    return null;
  }
}

// ── Improve resume text ──────────────────────────────────────────────────────

export type ImproveTextContext = "experience" | "project" | "education" | "award";

export async function improveResumeText(
  text: string,
  context: ImproveTextContext
): Promise<string> {
  if (!text.trim()) return text;

  const truncated = text.slice(0, 5000);
  const model = getModel();

  const contextHints: Record<ImproveTextContext, string> = {
    experience:
      "This is a work experience description. Focus on responsibilities, achievements, and quantifiable impact.",
    project:
      "This is a project description. Focus on the problem solved, technologies used, and outcomes.",
    education:
      "This is additional information for an education entry. Focus on relevant coursework, honors, and activities.",
    award:
      "This is an award or honor description. Focus on selection criteria, significance, and achievement.",
  };

  const prompt = `
You are a professional resume writer.

Rewrite the following resume description to be professional and concise.
Use bullet points if appropriate.
${contextHints[context]}

Return ONLY the improved text. No explanations, no markdown code fences, no surrounding quotes.

ORIGINAL TEXT START
${truncated}
ORIGINAL TEXT END
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
    },
  });

  const improved = result.response.text().trim();
  return improved;
}
