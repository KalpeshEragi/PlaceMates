// ────────────────────────────────────────────────────────────
// Smart Profile — Orchestration Service
// ────────────────────────────────────────────────────────────
//
// Pipeline:  fetch data → normalize → detect → rank → score → summarize → save
// ────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

import type {
    SmartProfile,
    SmartProfileInput,
    GitHubRepo,
} from "../utils/smartProfile/types.js";
import type {
    LinkedInProfile,
    LinkedInExperience,
    LinkedInEducation,
    LinkedInProject,
} from "../utils/linkedin/types.js";

import { normalizeSkills } from "../utils/smartProfile/normalizeSkills.js";
import { detectPrimaryDomain } from "../utils/smartProfile/detectDomain.js";
import { rankProjects } from "../utils/smartProfile/rankProjects.js";
import { estimateExperienceLevel } from "../utils/smartProfile/estimateExperience.js";
import { calculateGithubActivity } from "../utils/smartProfile/githubActivity.js";
import { generateAISummary } from "../utils/smartProfile/aiSummary.js";

/**
 * Generate a Smart Profile for the given user.
 *
 * Reads LinkedIn + GitHub data from the database,
 * runs the full analysis pipeline, saves the result,
 * and returns the generated Smart Profile.
 *
 * @param userId - Authenticated user's ID
 * @returns The generated SmartProfile object
 */
export async function generateSmartProfile(
    userId: string
): Promise<SmartProfile> {
    console.log(`[Smart Profile] Starting generation for user ${userId}`);

    // ── 1. Fetch user data from DB ────────────────────────────
    const profile = await prisma.userProfile.findUnique({
        where: { userId },
    });

    if (!profile) {
        throw new Error("User profile not found. Please complete your profile setup first.");
    }

    const importedData = (profile.importedData as Record<string, unknown>) || {};

    // ── 2. Extract and validate inputs ────────────────────────
    const input = extractInput(importedData);

    console.log(
        `[Smart Profile] Inputs: ${input.linkedInSkills.length} skills, ` +
        `${input.linkedInExperience.length} experiences, ` +
        `${input.githubRepos.length} repos`
    );

    // ── 3. Run pipeline ───────────────────────────────────────

    // 3a. Normalize & score skills
    const { topSkills, secondarySkills, strongestLanguages, allSkills } =
        normalizeSkills(input.linkedInSkills, input.githubRepos);
    console.log(`[Smart Profile] Top Skills: ${topSkills.join(", ")}`);

    // 3b. Detect primary domain
    const allSkillNames = allSkills.map((s) => s.name);
    const primaryDomain = detectPrimaryDomain(topSkills, allSkillNames, input.githubRepos);
    console.log(`[Smart Profile] Primary Domain: ${primaryDomain}`);

    // 3c. Rank projects
    const topProjects = rankProjects(input.githubRepos, topSkills);
    console.log(`[Smart Profile] Top Projects: ${topProjects.map((p) => p.name).join(", ")}`);

    // 3d. Estimate experience level
    const { level: experienceLevel, totalYears } = estimateExperienceLevel(input.linkedInExperience);
    console.log(`[Smart Profile] Experience: ${experienceLevel} (${totalYears} years)`);

    // 3e. Calculate GitHub activity
    const { score: githubActivityScore, details: activityDetails } =
        calculateGithubActivity(input.githubRepos);
    console.log(`[Smart Profile] GitHub Activity: ${githubActivityScore}`, activityDetails);

    // 3f. Generate AI summary
    const aiSummary = await generateAISummary(
        primaryDomain,
        topSkills,
        topProjects,
        experienceLevel,
        input.linkedInHeadline
    );
    console.log(`[Smart Profile] AI Summary generated (${aiSummary.length} chars)`);

    // ── 4. Compose final SmartProfile ─────────────────────────
    const smartProfile: SmartProfile = {
        primaryDomain,
        topSkills,
        secondarySkills,
        strongestLanguages,
        experienceLevel,
        topProjects,
        githubActivityScore,
        aiSummary,
        generatedAt: new Date().toISOString(),
    };

    // ── 5. Save to database ───────────────────────────────────
    const smartProfileJson = JSON.parse(
        JSON.stringify(smartProfile)
    ) as Prisma.InputJsonValue;

    await prisma.userProfile.update({
        where: { userId },
        data: { smartProfile: smartProfileJson },
    });

    console.log(`[Smart Profile] ✅ Saved to database for user ${userId}`);

    return smartProfile;
}

// ── Input Extraction ──────────────────────────────────────

/**
 * Safely extract and structure pipeline inputs from the
 * raw importedData JSON blob. Handles missing/malformed data
 * gracefully — every field defaults to an empty value.
 */
function extractInput(importedData: Record<string, unknown>): SmartProfileInput {
    // ── LinkedIn data ─────────────────────────────────────────
    const linkedin = (importedData.linkedInProfile || {}) as Partial<LinkedInProfile>;

    const linkedInSkills = Array.isArray(linkedin.skills)
        ? linkedin.skills.map((s: { name?: string }) => s.name || "").filter(Boolean)
        : [];

    const linkedInExperience = Array.isArray(linkedin.experience)
        ? linkedin.experience.map((e: LinkedInExperience) => ({
            title: e.title || "",
            companyName: e.companyName || "",
            startDate: e.startDate || undefined,
            endDate: e.endDate || undefined,
            description: e.description || undefined,
        }))
        : [];

    const linkedInEducation = Array.isArray(linkedin.education)
        ? linkedin.education.map((e: LinkedInEducation) => ({
            schoolName: e.schoolName || "",
            degree: e.degree || undefined,
            fieldOfStudy: e.fieldOfStudy || undefined,
        }))
        : [];

    const linkedInProjects = Array.isArray(linkedin.projects)
        ? linkedin.projects.map((p: LinkedInProject) => ({
            title: p.title || "",
            description: p.description || undefined,
        }))
        : [];

    const linkedInHeadline = linkedin.personal?.headline
        ? String(linkedin.personal.headline)
        : undefined;

    // ── GitHub data ───────────────────────────────────────────
    const rawRepos = importedData.githubRepos;
    const githubRepos: GitHubRepo[] = Array.isArray(rawRepos)
        ? rawRepos.map((r: Record<string, unknown>) => ({
            name: String(r.name || ""),
            description: r.description ? String(r.description) : null,
            html_url: String(r.html_url || ""),
            language: r.language ? String(r.language) : null,
            stargazers_count: Number(r.stargazers_count) || 0,
            updated_at: String(r.updated_at || ""),
            fork: Boolean(r.fork),
            topics: Array.isArray(r.topics) ? r.topics.map(String) : [],
        }))
        : [];

    return {
        linkedInSkills,
        linkedInExperience,
        linkedInEducation,
        linkedInProjects,
        linkedInHeadline,
        githubRepos,
    };
}
