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

