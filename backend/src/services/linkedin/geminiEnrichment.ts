// src/services/linkedin/geminiEnrichment.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY!);

interface GeminiResult {
  primaryDomain: string;
  secondaryDomain: string;
  technicalOrientation: string;
  leadershipScore: number;
  impactScore: number;
  ownershipScore: number;
  careerSummary: string;
  strengthsSummary: string;
  improvementSuggestions: string;
}

export async function runGeminiEnrichment(data: any): Promise<GeminiResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const structuredPositions = formatPositions(data.positions || []);
  const structuredProjects = formatProjects(data.projects || []);

  const prompt = buildPrompt({
    headline: data.profile?.Headline || data.profile?.headline || "",
    summary: data.profile?.Summary || data.profile?.summary || "",
    positions: structuredPositions,
    projects: structuredProjects,
  });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();

    const parsed = JSON.parse(text);

    return normalizeGeminiOutput(parsed);

  } catch (error: any) {
    console.error("──── Gemini enrichment FAILED ────");
    console.error("  Model :", "gemini-2.5-flash");
    console.error("  Error :", error?.message || error);
    if (error?.status)  console.error("  Status:", error.status);
    if (error?.response) console.error("  Response body:", JSON.stringify(error.response).slice(0, 500));
    console.error("  Headline sent :", data.profile?.Headline || data.profile?.headline || "(empty)");
    console.error("  Positions count:", (data.positions || []).length);
    console.error("  Projects count :", (data.projects || []).length);
    console.error("──────────────────────────────────");

    return fallbackGeminiResult();
  }
}

function buildPrompt(input: any): string {
  return `
You are a strict Career Intelligence Engine.

Return STRICT JSON only. No markdown. No explanation.

Output format:
{
  "primaryDomain": string,
  "secondaryDomain": string,
  "technicalOrientation": string,
  "leadershipScore": number,
  "impactScore": number,
  "ownershipScore": number,
  "careerSummary": string,
  "strengthsSummary": string,
  "improvementSuggestions": string
}

Rules:
- Scores must be integers between 0 and 100.
- Be conservative.
- Do NOT hallucinate missing info.
- Base everything only on provided data.

HEADLINE:
${input.headline}

SUMMARY:
${input.summary}

POSITIONS:
${input.positions}

PROJECTS:
${input.projects}
`;
}

function formatPositions(positions: any[]): string {
  return positions
    .slice(0, 10) // limit roles
    .map((p) => {
      return `
Title: ${p["Title"] || ""}
Company: ${p["Company Name"] || ""}
Duration: ${p["Started On"] || ""} - ${p["Finished On"] || ""}
Description: ${(p["Description"] || "").slice(0, 600)}
`;
    })
    .join("\n");
}

function formatProjects(projects: any[]): string {
  return projects
    .slice(0, 5)
    .map((p) => {
      return `
Project: ${p["Title"] || p["Project Name"] || ""}
Description: ${(p["Description"] || "").slice(0, 500)}
`;
    })
    .join("\n");
}

function normalizeGeminiOutput(parsed: any): GeminiResult {
  return {
    primaryDomain: parsed.primaryDomain || "Unknown",
    secondaryDomain: parsed.secondaryDomain || "Unknown",
    technicalOrientation: parsed.technicalOrientation || "Generalist",
    leadershipScore: clampScore(parsed.leadershipScore),
    impactScore: clampScore(parsed.impactScore),
    ownershipScore: clampScore(parsed.ownershipScore),
    careerSummary: parsed.careerSummary || "",
    strengthsSummary: parsed.strengthsSummary || "",
    improvementSuggestions: parsed.improvementSuggestions || "",
  };
}

function clampScore(value: any): number {
  const num = Number(value);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function fallbackGeminiResult(): GeminiResult {
  return {
    primaryDomain: "Unknown",
    secondaryDomain: "Unknown",
    technicalOrientation: "Generalist",
    leadershipScore: 0,
    impactScore: 0,
    ownershipScore: 0,
    careerSummary: "",
    strengthsSummary: "",
    improvementSuggestions: "",
  };
}