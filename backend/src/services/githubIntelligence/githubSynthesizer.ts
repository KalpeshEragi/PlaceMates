// ────────────────────────────────────────────────────────────
// GitHub Intelligence — Global GitHub Synthesis (1 LLM Call)
// ────────────────────────────────────────────────────────────
//
// Takes all repo profiles + aggregated stats and produces
// a single holistic GitHub assessment via one LLM call.
// Falls back to a deterministic template if LLM is unavailable.
// ────────────────────────────────────────────────────────────

import type {
    RepoProfile,
    GitHubAnalysis,
    ProjectHighlight,
    DomainClassification,
} from "./types.js";

// ── Main Synthesizer ──────────────────────────────────────

/**
 * Synthesize all repo profiles into a comprehensive GitHub analysis.
 * Uses exactly ONE LLM call (Gemini) for the AI-powered fields.
 *
 * @param repoProfiles - All analyzed repo profiles
 * @returns Partial GitHubAnalysis fields (to be merged by orchestrator)
 */
export async function synthesizeGitHub(repoProfiles: RepoProfile[]): Promise<{
    strongestDomain: string;
    strongestTechnologies: string[];
    projectHighlights: ProjectHighlight[];
    technicalDepthScore: number;
    activityScore: number;
    aiSummary: string;
}> {
    // ── Aggregate statistics ──────────────────────────────
    const stats = computeAggregateStats(repoProfiles);

    // ── Try LLM synthesis ─────────────────────────────────
    try {
        return await llmSynthesis(repoProfiles, stats);
    } catch (err) {
        console.warn("[GitHub Synthesizer] LLM synthesis failed, using local fallback:", err);
        return localSynthesis(repoProfiles, stats);
    }
}

// ── Aggregate Stats ───────────────────────────────────────

interface AggregateStats {
    languageUsage: Record<string, number>;
    domainCounts: Record<string, number>;
    topComplexityProjects: RepoProfile[];
    totalRepos: number;
    avgComplexity: number;
    avgMaturity: number;
    avgEffort: number;
    totalStars: number;
}

function computeAggregateStats(profiles: RepoProfile[]): AggregateStats {
    const languageUsage: Record<string, number> = {};
    const domainCounts: Record<string, number> = {};

    let totalComplexity = 0;
    let totalMaturity = 0;
    let totalEffort = 0;
    let totalStars = 0;

    for (const p of profiles) {
        // Language usage
        for (const tech of p.techStack) {
            languageUsage[tech] = (languageUsage[tech] || 0) + 1;
        }

        // Domain counts
        domainCounts[p.domain] = (domainCounts[p.domain] || 0) + 1;

        // Score accumulation
        totalComplexity += p.complexityScore;
        totalMaturity += p.maturityScore;
        totalEffort += p.effortScore;
        totalStars += p.stars;
    }

    const count = profiles.length || 1;

    // Top complexity projects (top 5)
    const topComplexityProjects = [...profiles]
        .sort((a, b) => b.complexityScore - a.complexityScore)
        .slice(0, 5);

    return {
        languageUsage,
        domainCounts,
        topComplexityProjects,
        totalRepos: profiles.length,
        avgComplexity: Math.round((totalComplexity / count) * 10) / 10,
        avgMaturity: Math.round((totalMaturity / count) * 10) / 10,
        avgEffort: Math.round((totalEffort / count) * 10) / 10,
        totalStars,
    };
}

// ── LLM Synthesis (1 Gemini Call) ─────────────────────────

async function llmSynthesis(
    profiles: RepoProfile[],
    stats: AggregateStats
): Promise<{
    strongestDomain: string;
    strongestTechnologies: string[];
    projectHighlights: ProjectHighlight[];
    technicalDepthScore: number;
    activityScore: number;
    aiSummary: string;
}> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build compact profile summaries (keep tokens low)
    const profileSummaries = profiles.slice(0, 20).map((p) => ({
        name: p.name,
        domain: p.domain,
        techStack: p.techStack.slice(0, 5),
        complexity: p.complexityScore,
        maturity: p.maturityScore,
        effort: p.effortScore,
        originality: p.originalityHint,
        stars: p.stars,
        features: p.features.slice(0, 5),
        summary: p.readmeSummaryShort?.projectPurpose || p.description || "",
    }));

    // Top languages
    const topLanguages = Object.entries(stats.languageUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([lang, count]) => `${lang} (${count} repos)`);

    // Domain distribution
    const domainDist = Object.entries(stats.domainCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([domain, count]) => `${domain}: ${count}`);

    const prompt = `You are a technical recruiter AI analyzing a developer's GitHub portfolio.

Here is the developer's GitHub data:

TOTAL REPOS: ${stats.totalRepos}
TOTAL STARS: ${stats.totalStars}
AVG COMPLEXITY: ${stats.avgComplexity}/10
AVG MATURITY: ${stats.avgMaturity}/10
AVG EFFORT: ${stats.avgEffort}/10

LANGUAGE USAGE: ${topLanguages.join(", ")}

DOMAIN DISTRIBUTION: ${domainDist.join(", ")}

TOP COMPLEXITY PROJECTS:
${stats.topComplexityProjects.map((p) => `- ${p.name} (${p.domain}, complexity: ${p.complexityScore}, originality: ${p.originalityHint})`).join("\n")}

ALL REPO PROFILES:
${JSON.stringify(profileSummaries, null, 0)}

Respond ONLY with valid JSON (no markdown, no code fences). Use this exact structure:
{
  "strongestDomain": "string - the developer's strongest technical domain",
  "strongestTechnologies": ["array of their top 5 strongest technologies"],
  "projectHighlights": [
    {
      "name": "repo name",
      "reason": "why this project stands out (1 sentence)",
      "domain": "web|ai|backend|mobile|tooling|data|unknown",
      "techStack": ["top 3 techs"]
    }
  ],
  "technicalDepthScore": "number 0-10 - realistic assessment of technical sophistication",
  "activityScore": "number 0-10 - how active they are",
  "aiSummary": "2-3 sentence professional summary of their GitHub presence. Be specific, mention their strongest areas and notable projects by name."
}

IMPORTANT: Be honest and realistic. Do not inflate scores. If repos are mostly tutorials or clones, say so.
Return 3-5 project highlights max.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Strip markdown code fences if model returns them despite instruction
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    const parsed = JSON.parse(text);

    return {
        strongestDomain: String(parsed.strongestDomain || "unknown"),
        strongestTechnologies: Array.isArray(parsed.strongestTechnologies)
            ? parsed.strongestTechnologies.map(String)
            : [],
        projectHighlights: Array.isArray(parsed.projectHighlights)
            ? parsed.projectHighlights.map((h: Record<string, unknown>) => ({
                name: String(h.name || ""),
                reason: String(h.reason || ""),
                domain: (String(h.domain || "unknown") as DomainClassification),
                techStack: Array.isArray(h.techStack) ? h.techStack.map(String) : [],
            }))
            : [],
        technicalDepthScore: Math.min(10, Math.max(0, Number(parsed.technicalDepthScore) || 0)),
        activityScore: Math.min(10, Math.max(0, Number(parsed.activityScore) || 0)),
        aiSummary: String(parsed.aiSummary || ""),
    };
}

// ── Local Fallback Synthesis ──────────────────────────────

function localSynthesis(
    profiles: RepoProfile[],
    stats: AggregateStats
): {
    strongestDomain: string;
    strongestTechnologies: string[];
    projectHighlights: ProjectHighlight[];
    technicalDepthScore: number;
    activityScore: number;
    aiSummary: string;
} {
    // Strongest domain = most common domain
    const sortedDomains = Object.entries(stats.domainCounts)
        .filter(([d]) => d !== "unknown")
        .sort((a, b) => b[1] - a[1]);
    const strongestDomain = sortedDomains[0]?.[0] || "unknown";

    // Strongest technologies = most frequent languages
    const strongestTechnologies = Object.entries(stats.languageUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang);

    // Project highlights = top complexity original projects
    const projectHighlights: ProjectHighlight[] = stats.topComplexityProjects
        .filter((p) => p.originalityHint !== "tutorial" && p.originalityHint !== "clone")
        .slice(0, 4)
        .map((p) => ({
            name: p.name,
            reason: `Complexity: ${p.complexityScore}/10, ${p.features.slice(0, 3).join(", ") || "general project"}`,
            domain: p.domain,
            techStack: p.techStack.slice(0, 3),
        }));

    // Technical depth = weighted avg of top repos
    const topRepoScores = profiles
        .filter((p) => p.originalityHint === "original" || p.originalityHint === "unclear")
        .sort((a, b) => b.complexityScore - a.complexityScore)
        .slice(0, 5)
        .map((p) => p.complexityScore);
    const technicalDepthScore =
        topRepoScores.length > 0
            ? Math.round(
                (topRepoScores.reduce((sum, s) => sum + s, 0) /
                    topRepoScores.length) *
                10
            ) / 10
            : 0;

    // Activity score heuristic
    const now = Date.now();
    const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000;
    const recentlyActive = profiles.filter(
        (p) => new Date(p.lastUpdated).getTime() > sixMonthsAgo
    ).length;
    const activityRatio = profiles.length > 0 ? recentlyActive / profiles.length : 0;
    const activityScore = Math.round(Math.min(activityRatio * 10 + (stats.totalStars > 10 ? 1 : 0), 10) * 10) / 10;

    // Template summary
    const aiSummary = buildTemplateSummary(strongestDomain, strongestTechnologies, profiles, stats);

    return {
        strongestDomain,
        strongestTechnologies,
        projectHighlights,
        technicalDepthScore,
        activityScore,
        aiSummary,
    };
}

function buildTemplateSummary(
    domain: string,
    technologies: string[],
    profiles: RepoProfile[],
    stats: AggregateStats
): string {
    const originalCount = profiles.filter((p) => p.originalityHint === "original").length;
    const techText = technologies.slice(0, 3).join(", ");
    const topProject = stats.topComplexityProjects[0];

    let summary = `Developer with ${stats.totalRepos} repositories primarily focused on ${domain} development.`;
    summary += ` Strongest technologies include ${techText}.`;

    if (originalCount > 0) {
        summary += ` ${originalCount} original project${originalCount > 1 ? "s" : ""} demonstrate${originalCount === 1 ? "s" : ""} hands-on experience.`;
    }

    if (topProject) {
        summary += ` Notable work: ${topProject.name} (complexity ${topProject.complexityScore}/10).`;
    }

    return summary;
}
