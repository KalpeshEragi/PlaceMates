// ────────────────────────────────────────────────────────────
// Career Intelligence — Gemini Polishing Layer
// ────────────────────────────────────────────────────────────
//
// Takes the raw deterministic CareerIntelligence object and
// uses 1 Gemini call to polish every field before presenting
// to the user.
//
// Polishes:
//   - Skill names → standardized labels
//   - Project descriptions → recruiter-ready summaries
//   - Alignment insight → natural career advice
//   - Career level → with brief justification
//   - aiCareerSummary → polished 3–4 sentence narrative
//
// Falls back to raw output if Gemini is unavailable.
// ────────────────────────────────────────────────────────────

import type { CareerIntelligence, MergedProject } from "./types.js";

// ── Public API ────────────────────────────────────────────

export async function polishIntelligence(
    raw: CareerIntelligence
): Promise<CareerIntelligence> {
    try {
        return await geminiPolish(raw);
    } catch (err) {
        console.warn(
            "[Intelligence Polisher] Gemini polishing failed, using raw output:",
            err
        );
        return raw;
    }
}

// ── Gemini Polishing (1 LLM Call) ─────────────────────────

async function geminiPolish(
    raw: CareerIntelligence
): Promise<CareerIntelligence> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a professional career intelligence system. You have computed raw data about a developer's career profile. Your job is to POLISH and REFINE this data for professional presentation.

Here is the raw career intelligence data:

PRIMARY DOMAIN: ${raw.primaryDomain}
SECONDARY DOMAINS: ${raw.secondaryDomains.join(", ") || "none"}
CAREER LEVEL: ${raw.careerLevel}

CORE SKILLS: ${raw.coreSkills.join(", ") || "none"}
STRONG SKILLS: ${raw.strongSkills.join(", ") || "none"}
WORKING SKILLS: ${raw.workingSkills.join(", ") || "none"}
WEAK SKILLS: ${raw.weakSkills.join(", ") || "none"}

HIGHLIGHT PROJECTS:
${raw.highlightProjects.map((p, i) => `${i + 1}. ${p.name} (${p.source}, tag: ${p.projectTag}) — ${p.description} [${p.techStack.join(", ")}]`).join("\n")}

DOMAIN DISTRIBUTION: ${Object.entries(raw.domainDistribution).map(([d, pct]) => `${d}: ${pct}%`).join(", ") || "not computed"}

LEADERSHIP SIGNALS: ${raw.leadershipSignals.join(", ") || "none"}
PROFESSIONAL IMPACT SCORE: ${raw.professionalImpactScore}/10
TECHNICAL STRENGTH SCORE: ${raw.technicalStrengthScore}/10
ACTIVITY SCORE: ${raw.activityScore}/10

CAREER INTENT: ${raw.careerIntent.join(", ") || "none specified"}
CAREER ALIGNMENT SCORE: ${raw.careerAlignmentScore}
ALIGNMENT INSIGHT: ${raw.alignmentInsight}

Respond ONLY with valid JSON (no markdown fences). Use this exact structure:
{
  "primaryDomain": "polished domain name (e.g. 'Web Development' instead of 'web')",
  "secondaryDomains": ["polished secondary domain names"],
  "careerLevel": "${raw.careerLevel}",
  "coreSkills": ["properly capitalized/standardized skill names, e.g. 'React.js' not 'react'"],
  "strongSkills": ["properly capitalized/standardized skill names"],
  "workingSkills": ["properly capitalized/standardized skill names"],
  "weakSkills": ["properly capitalized/standardized skill names"],
  "highlightProjects": [
    {
      "name": "project name",
      "description": "polished 1-2 sentence recruiter-ready description",
      "techStack": ["standardized tech names"],
      "domain": "polished domain",
      "source": "github|linkedin|both",
      "boostScore": number,
      "projectTag": "Flagship|Complex System|Production-style|Learning Project"
    }
  ],
  "alignmentInsight": "polished, professional, actionable career alignment advice (1-2 sentences)",
  "aiCareerSummary": "3-4 sentence polished career narrative summarizing the developer's professional profile, strengths, and trajectory. Write in third person, be specific, mention key technologies and domains."
}

RULES:
- Do NOT change scores, boostScores, or projectTags — only polish text/labels
- Do NOT change domainDistribution
- Keep careerLevel EXACTLY as provided
- Standardize skill names (React.js, Node.js, TypeScript, Python, etc.)
- Remove duplicates across skill tiers
- Make project descriptions concise but impressive
- The aiCareerSummary should be professional and specific to THIS developer`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    const polished = JSON.parse(text);

    // Merge polished data back while preserving unpolished numeric fields
    return {
        primaryDomain: String(polished.primaryDomain || raw.primaryDomain),
        secondaryDomains: Array.isArray(polished.secondaryDomains)
            ? polished.secondaryDomains.map(String)
            : raw.secondaryDomains,
        careerLevel: raw.careerLevel, // Never override

        coreSkills: Array.isArray(polished.coreSkills)
            ? polished.coreSkills.map(String)
            : raw.coreSkills,
        strongSkills: Array.isArray(polished.strongSkills)
            ? polished.strongSkills.map(String)
            : raw.strongSkills,
        workingSkills: Array.isArray(polished.workingSkills)
            ? polished.workingSkills.map(String)
            : raw.workingSkills,
        weakSkills: Array.isArray(polished.weakSkills)
            ? polished.weakSkills.map(String)
            : raw.weakSkills,

        highlightProjects: Array.isArray(polished.highlightProjects)
            ? polished.highlightProjects.map(
                (p: Record<string, unknown>, i: number) => ({
                    name: String(p.name || raw.highlightProjects[i]?.name || ""),
                    description: String(
                        p.description ||
                        raw.highlightProjects[i]?.description ||
                        ""
                    ),
                    techStack: Array.isArray(p.techStack)
                        ? p.techStack.map(String)
                        : raw.highlightProjects[i]?.techStack || [],
                    domain: String(
                        p.domain || raw.highlightProjects[i]?.domain || "unknown"
                    ),
                    source: String(
                        p.source || raw.highlightProjects[i]?.source || "github"
                    ) as MergedProject["source"],
                    boostScore:
                        raw.highlightProjects[i]?.boostScore ??
                        (Number(p.boostScore) || 0),
                    projectTag:
                        raw.highlightProjects[i]?.projectTag ?? "Learning Project",
                })
            )
            : raw.highlightProjects,

        // Preserve all numeric scores exactly
        leadershipSignals: raw.leadershipSignals,
        professionalImpactScore: raw.professionalImpactScore,
        technicalStrengthScore: raw.technicalStrengthScore,
        activityScore: raw.activityScore,

        careerIntent: raw.careerIntent,
        careerAlignmentScore: raw.careerAlignmentScore,
        alignmentInsight: String(
            polished.alignmentInsight || raw.alignmentInsight
        ),

        aiCareerSummary: String(
            polished.aiCareerSummary || raw.aiCareerSummary
        ),

        domainDistribution: raw.domainDistribution, // Never override

        // UI Enrichment fields — pass through unchanged
        profileSummary: raw.profileSummary,
        skillsInsight: raw.skillsInsight,
        domainInsight: raw.domainInsight,
        projectsIntro: raw.projectsIntro,
        strengthInsight: raw.strengthInsight,
        careerIntentExplanation: raw.careerIntentExplanation,
        alignmentExplanation: raw.alignmentExplanation,
        techStackDistribution: raw.techStackDistribution,
        projectComplexityMap: raw.projectComplexityMap,
        skillsDetailed: raw.skillsDetailed,
        experienceTimeline: raw.experienceTimeline,
        careerProgression: raw.careerProgression,

        generatedAt: raw.generatedAt,
    };
}
