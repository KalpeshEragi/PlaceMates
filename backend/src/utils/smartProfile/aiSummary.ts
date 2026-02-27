// ────────────────────────────────────────────────────────────
// Smart Profile — AI Professional Summary Generator
// ────────────────────────────────────────────────────────────
//
// Uses Google Gemini to generate a concise professional
// summary. Falls back to a template-based summary if the
// API is unavailable or unconfigured.
// ────────────────────────────────────────────────────────────

import type { RankedProject } from "./types.js";

/**
 * Generate a 3–4 line professional summary using an LLM.
 *
 * @param primaryDomain    - e.g. "Web Development"
 * @param topSkills        - User's top skills
 * @param topProjects      - Best ranked projects
 * @param experienceLevel  - "Student" | "Beginner" | "Intermediate" | "Experienced"
 * @param headline         - LinkedIn headline (optional extra context)
 * @returns Professional summary text
 */
export async function generateAISummary(
    primaryDomain: string,
    topSkills: string[],
    topProjects: RankedProject[],
    experienceLevel: string,
    headline?: string
): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    // If no API key, use template fallback
    if (!apiKey) {
        console.warn(
            "[Smart Profile] GEMINI_API_KEY not configured — using template-based summary"
        );
        return buildTemplateSummary(
            primaryDomain, topSkills, topProjects, experienceLevel, headline
        );
    }

    try {
        const summary = await callGemini(
            apiKey, primaryDomain, topSkills, topProjects, experienceLevel, headline
        );
        return summary;
    } catch (err) {
        console.error("[Smart Profile] Gemini API error, falling back to template:", err);
        return buildTemplateSummary(
            primaryDomain, topSkills, topProjects, experienceLevel, headline
        );
    }
}

// ── Gemini API Call ────────────────────────────────────────

async function callGemini(
    apiKey: string,
    primaryDomain: string,
    topSkills: string[],
    topProjects: RankedProject[],
    experienceLevel: string,
    headline?: string
): Promise<string> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const projectList = topProjects
        .map((p) => `• ${p.name}: ${p.description || "No description"} (${p.languages.join(", ")}, ★${p.stars})`)
        .join("\n");

    const prompt = `You are writing a professional summary for a developer's profile. 
Write a concise 3-4 line professional summary based on the following information:

Primary Domain: ${primaryDomain}
Experience Level: ${experienceLevel}
${headline ? `Current Headline: ${headline}` : ""}
Top Skills: ${topSkills.join(", ")}
Notable Projects:
${projectList || "None listed"}

Requirements:
- Write in third person
- Keep it professional and impactful
- Mention their domain expertise and key technical strengths
- Reference their experience level naturally
- Do NOT use bullet points — write flowing sentences
- Do NOT include any markdown formatting
- Keep it exactly 3-4 sentences
- Do NOT start with "This developer" or similar generic openings`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Sanitize: remove any markdown artifacts the model might add
    return text.replace(/[*#_`]/g, "").trim();
}

// ── Template Fallback ─────────────────────────────────────

function buildTemplateSummary(
    primaryDomain: string,
    topSkills: string[],
    topProjects: RankedProject[],
    experienceLevel: string,
    headline?: string
): string {
    const levelDescriptor: Record<string, string> = {
        Student: "An aspiring developer",
        Beginner: "A budding professional",
        Intermediate: "A skilled professional",
        Experienced: "A seasoned professional",
    };

    const opener = levelDescriptor[experienceLevel] || "A developer";
    const skillsText = topSkills.slice(0, 3).join(", ");
    const projectText = topProjects.length > 0
        ? ` Notable projects include ${topProjects.slice(0, 2).map((p) => p.name).join(" and ")}.`
        : "";
    const headlineText = headline ? ` Currently positioned as "${headline}".` : "";

    return (
        `${opener} specializing in ${primaryDomain} with proficiency in ${skillsText}. ` +
        `Demonstrates a strong foundation across multiple technical areas with hands-on project experience.` +
        `${projectText}${headlineText}`
    );
}
