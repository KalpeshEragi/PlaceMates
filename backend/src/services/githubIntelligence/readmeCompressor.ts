// ────────────────────────────────────────────────────────────
// GitHub Intelligence — README Smart Compression
// ────────────────────────────────────────────────────────────
//
// Compresses README text into structured 3-bullet summary:
//   • project purpose
//   • main technologies
//   • complexity indication
//
// Strategy:
//   1. If README is short/clear → build summary locally
//   2. If README is large and unclear → single cheap LLM call
//
// Results are cached by contentHash — never recomputes unless
// the README content changes.
// ────────────────────────────────────────────────────────────

import type { ReadmeCompression, ReadmeAnalysis, RepoProfile } from "./types.js";
import { parseReadme } from "./readmeParser.js";

/** Character threshold below which we always use local compression */
const LOCAL_THRESHOLD_CHARS = 500;

/** Minimum signals needed for confident local compression */
const MIN_CONFIDENCE_SIGNALS = 3;

// ── Main Compressor ───────────────────────────────────────

/**
 * Compress README text into a structured 3-bullet summary.
 *
 * @param readmeText  - Raw README content
 * @param repoProfile - Already-computed RepoProfile (for context)
 * @returns ReadmeCompression with three summary bullets
 */
export async function compressReadme(
    readmeText: string,
    repoProfile: RepoProfile
): Promise<ReadmeCompression> {
    if (!readmeText || readmeText.trim().length === 0) {
        return buildFallbackCompression(repoProfile);
    }

    const analysis = parseReadme(readmeText);

    // Determine if local compression is sufficient
    const canCompressLocally =
        readmeText.length < LOCAL_THRESHOLD_CHARS ||
        countSignals(analysis) >= MIN_CONFIDENCE_SIGNALS;

    if (canCompressLocally) {
        return buildLocalCompression(analysis, repoProfile);
    }

    // Large, unclear README → optional LLM call
    try {
        return await buildLLMCompression(readmeText, repoProfile);
    } catch (err) {
        console.warn(
            `[README Compressor] LLM compression failed for ${repoProfile.name}, falling back to local:`,
            err
        );
        return buildLocalCompression(analysis, repoProfile);
    }
}

/**
 * Batch compress READMEs for all repo profiles.
 * Skips repos whose readmeSummaryShort is already populated
 * and whose README hash hasn't changed.
 */
export async function compressAllReadmes(
    repos: Array<{ repo: RepoProfile; readmeText: string }>,
    existingProfiles?: RepoProfile[]
): Promise<RepoProfile[]> {
    const existingMap = new Map<string, RepoProfile>();
    if (existingProfiles) {
        for (const p of existingProfiles) {
            existingMap.set(p.name, p);
        }
    }

    const results: RepoProfile[] = [];

    for (const { repo, readmeText } of repos) {
        // Check cache: skip if hash unchanged and summary exists
        const existing = existingMap.get(repo.name);
        if (
            existing?.readmeSummaryShort &&
            existing.readmeContentHash &&
            existing.readmeContentHash === repo.readmeContentHash
        ) {
            results.push({ ...repo, readmeSummaryShort: existing.readmeSummaryShort });
            continue;
        }

        const compression = await compressReadme(readmeText, repo);
        results.push({ ...repo, readmeSummaryShort: compression });
    }

    return results;
}

// ── Local Compression ─────────────────────────────────────

function buildLocalCompression(
    analysis: ReadmeAnalysis,
    profile: RepoProfile
): ReadmeCompression {
    // Project purpose
    const purposeParts: string[] = [];
    if (analysis.projectTypes.length > 0) {
        purposeParts.push(`${analysis.projectTypes[0]} project`);
    }
    if (profile.description) {
        purposeParts.push(profile.description);
    }
    const projectPurpose =
        purposeParts.length > 0
            ? purposeParts.join(" — ")
            : `${profile.name} — ${profile.domain} project`;

    // Main technologies
    const techList =
        profile.techStack.length > 0
            ? profile.techStack.slice(0, 5).join(", ")
            : "Not specified";
    const mainTechnologies = `Built with ${techList}`;

    // Complexity indication
    const complexityIndication = buildComplexityBullet(profile, analysis);

    return {
        projectPurpose,
        mainTechnologies,
        complexityIndication,
    };
}

function buildComplexityBullet(profile: RepoProfile, analysis: ReadmeAnalysis): string {
    const parts: string[] = [];

    if (profile.complexityScore >= 7) {
        parts.push("High complexity");
    } else if (profile.complexityScore >= 4) {
        parts.push("Moderate complexity");
    } else {
        parts.push("Simple scope");
    }

    if (analysis.complexitySignals.length > 0) {
        parts.push(
            `involving ${analysis.complexitySignals.slice(0, 3).join(", ")}`
        );
    }

    if (profile.features.length > 0) {
        parts.push(
            `with ${profile.features.slice(0, 3).join(", ")}`
        );
    }

    return parts.join(" ");
}

// ── Fallback (no README) ──────────────────────────────────

function buildFallbackCompression(profile: RepoProfile): ReadmeCompression {
    return {
        projectPurpose: profile.description || `${profile.name} — ${profile.domain} project`,
        mainTechnologies:
            profile.techStack.length > 0
                ? `Built with ${profile.techStack.slice(0, 5).join(", ")}`
                : "Technologies not specified",
        complexityIndication: `Complexity: ${profile.complexityScore}/10, Maturity: ${profile.maturityScore}/10`,
    };
}

// ── LLM Compression ──────────────────────────────────────

async function buildLLMCompression(
    readmeText: string,
    profile: RepoProfile
): Promise<ReadmeCompression> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Truncate README to save tokens (max ~2000 chars)
    const truncated =
        readmeText.length > 2000
            ? readmeText.substring(0, 2000) + "\n...[truncated]"
            : readmeText;

    const prompt = `Analyze this GitHub repository README and respond with EXACTLY 3 lines, no markdown, no bullet points:

Line 1 — Project purpose (one sentence, what does this project do?)
Line 2 — Main technologies used (comma-separated list)
Line 3 — Complexity indication (simple/moderate/complex + brief reason)

Repository: ${profile.name}
Description: ${profile.description || "None"}
Language: ${profile.techStack.slice(0, 3).join(", ") || "Unknown"}

README:
${truncated}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const lines = text.split("\n").filter(Boolean);

    return {
        projectPurpose: cleanLine(lines[0] || profile.description || profile.name),
        mainTechnologies: cleanLine(lines[1] || profile.techStack.join(", ")),
        complexityIndication: cleanLine(lines[2] || `Complexity: ${profile.complexityScore}/10`),
    };
}

// ── Helpers ───────────────────────────────────────────────

function countSignals(analysis: ReadmeAnalysis): number {
    return (
        analysis.projectTypes.length +
        analysis.features.length +
        analysis.complexitySignals.length +
        analysis.techMentions.length
    );
}

function cleanLine(line: string): string {
    return line
        .replace(/^[\d]+[\.\)]\s*/, "")    // remove "1. " or "1) "
        .replace(/^[-•*]\s*/, "")           // remove bullet prefixes
        .replace(/^line\s*\d+\s*[-—:]\s*/i, "") // remove "Line 1 — "
        .replace(/[*#_`]/g, "")             // remove markdown
        .trim();
}
