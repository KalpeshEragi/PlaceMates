// ────────────────────────────────────────────────────────────
// Career Intelligence — Orchestrator
// ────────────────────────────────────────────────────────────
//
// Single-action pipeline:
//   1. Load githubAnalysis + linkedinInsights from DB
//   2. If missing → auto-run the relevant processor
//   3. Run deterministic engines (skill, domain, level,
//      project, impact, alignment)
//   4. Compose raw CareerIntelligence
//   5. Polish via Gemini (1 LLM call)
//   6. Save to database
//
// Handles partial data gracefully (GitHub-only or LinkedIn-only).
// Never requires the caller to run processors separately.
//
// Exports:
//   generateCareerIntelligence(userId) → CareerIntelligence
// ────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

import type { GitHubAnalysis } from "../githubIntelligence/types.js";
import type { LinkedInInsights } from "../linkedinIntelligence/types.js";
import type { CareerIntelligence } from "./types.js";

import { processGitHubIntelligence } from "../githubIntelligence/index.js";
import { processLinkedInIntelligence } from "../linkedinIntelligence/index.js";

import { computeSkillConfidence } from "./skillEngine.js";
import { resolveDomains } from "./domainResolver.js";
import { estimateCareerLevel } from "./levelEstimator.js";
import { mergeProjects } from "./projectMerger.js";
import { calculateImpact } from "./impactCalculator.js";
import { checkAlignment } from "./alignmentChecker.js";
import { polishIntelligence } from "./intelligencePolisher.js";
import { enrichForUI } from "./uiEnricher.js";

import type {
    LinkedInProfile,
    LinkedInExperience,
    LinkedInEducation,
} from "../../utils/linkedin/types.js";

// ── Public API ────────────────────────────────────────────

/**
 * Generate unified career intelligence by merging GitHub analysis
 * and LinkedIn insights.
 *
 * Automatically runs missing processors before merging.
 * Requires at least one data source (GitHub repos or LinkedIn data)
 * to be available in the user's importedData.
 *
 * @param userId - Authenticated user's ID
 * @returns Polished CareerIntelligence object
 */
export async function generateCareerIntelligence(
    userId: string
): Promise<CareerIntelligence> {
    console.log(`[Career Intelligence] Starting orchestration for user ${userId}`);

    // ── 1. Load existing analysis data ────────────────────
    const profile = await prisma.userProfile.findUnique({
        where: { userId },
    });

    if (!profile) {
        throw new Error(
            "User profile not found. Please complete your profile setup first."
        );
    }

    const profileData = profile as Record<string, unknown>;
    let github = (profileData.githubAnalysis as GitHubAnalysis) ?? null;
    let linkedin = (profileData.linkedinInsights as LinkedInInsights) ?? null;

    // ── 2. Auto-run missing processors ────────────────────

    // 2a. GitHub Intelligence
    if (!github) {
        console.log(`[Career Intelligence] [running_github_analysis] GitHub analysis missing — running processor...`);
        try {
            github = await processGitHubIntelligence(userId);
            console.log(`[Career Intelligence] GitHub analysis complete`);
        } catch (err) {
            // Not fatal — user may not have GitHub connected
            console.log(
                `[Career Intelligence] GitHub analysis skipped: ${err instanceof Error ? err.message : "unknown error"}`
            );
        }
    } else {
        console.log(`[Career Intelligence] GitHub analysis already available`);
    }

    // 2b. LinkedIn Intelligence
    if (!linkedin) {
        console.log(`[Career Intelligence] [running_linkedin_analysis] LinkedIn insights missing — running processor...`);
        try {
            linkedin = await processLinkedInIntelligence(userId);
            console.log(`[Career Intelligence] LinkedIn analysis complete`);
        } catch (err) {
            // Not fatal — user may not have LinkedIn data imported
            console.log(
                `[Career Intelligence] LinkedIn analysis skipped: ${err instanceof Error ? err.message : "unknown error"}`
            );
        }
    } else {
        console.log(`[Career Intelligence] LinkedIn insights already available`);
    }

    // ── 3. Validate at least one source is available ──────
    if (!github && !linkedin) {
        throw new Error(
            "No data sources available. Please connect your GitHub account or import your LinkedIn data first."
        );
    }

    console.log(
        `[Career Intelligence] Inputs ready: GitHub=${!!github}, LinkedIn=${!!linkedin}`
    );

    // ── 4. Run deterministic engines ──────────────────────
    console.log(`[Career Intelligence] [merging_intelligence] Running merge engines...`);

    // 4a. Skill confidence
    const skills = computeSkillConfidence(github, linkedin);
    console.log(
        `[Career Intelligence] Skills: ${skills.coreSkills.length} core, ` +
        `${skills.strongSkills.length} strong, ${skills.workingSkills.length} working, ` +
        `${skills.weakSkills.length} weak`
    );

    // 4b. Domain resolution
    const domains = resolveDomains(github, linkedin);
    console.log(
        `[Career Intelligence] Primary domain: ${domains.primaryDomain}, ` +
        `secondary: ${domains.secondaryDomains.join(", ") || "none"}`
    );

    // 4c. Career level estimation
    const careerLevel = estimateCareerLevel(github, linkedin);
    console.log(`[Career Intelligence] Career level: ${careerLevel}`);

    // 4d. Project merging
    const highlightProjects = mergeProjects(github, linkedin);
    console.log(
        `[Career Intelligence] Merged ${highlightProjects.length} highlight projects`
    );

    // 4e. Impact calculation
    const impact = calculateImpact(github, linkedin);
    console.log(
        `[Career Intelligence] Impact: professional=${impact.professionalImpactScore}, ` +
        `technical=${impact.technicalStrengthScore}`
    );

    // 4f. Alignment check
    const alignment = checkAlignment(github, linkedin);
    console.log(
        `[Career Intelligence] Alignment score: ${alignment.careerAlignmentScore}`
    );

    // ── 5. Compose raw CareerIntelligence ─────────────────

    // 5a. Load raw LinkedIn profile data for timeline enrichment
    const importedData = (profile as Record<string, unknown>).importedData as Record<string, unknown> | null;
    const linkedInProfile = (importedData?.linkedInProfile ?? null) as Partial<LinkedInProfile> | null;
    const rawExperiences: LinkedInExperience[] = Array.isArray(linkedInProfile?.experience)
        ? linkedInProfile.experience
        : [];
    const rawEducation: LinkedInEducation[] = Array.isArray(linkedInProfile?.education)
        ? linkedInProfile.education
        : [];

    // 5b. Build base intelligence object (without enrichment)
    const baseIntelligence: CareerIntelligence = {
        primaryDomain: domains.primaryDomain,
        secondaryDomains: domains.secondaryDomains,
        domainDistribution: domains.domainDistribution,
        careerLevel,

        coreSkills: skills.coreSkills,
        strongSkills: skills.strongSkills,
        workingSkills: skills.workingSkills,
        weakSkills: skills.weakSkills,

        highlightProjects,

        leadershipSignals: impact.leadershipSignals,
        professionalImpactScore: impact.professionalImpactScore,
        technicalStrengthScore: impact.technicalStrengthScore,
        activityScore: github?.activityScore ?? 0,

        careerIntent: linkedin?.careerIntentKeywords ?? [],
        careerAlignmentScore: alignment.careerAlignmentScore,
        alignmentInsight: alignment.alignmentInsight,

        // Deterministic summary as fallback before Gemini polishing
        aiCareerSummary: generateDeterministicSummary(
            domains.primaryDomain,
            skills.coreSkills,
            highlightProjects,
            careerLevel,
            alignment.alignmentInsight
        ),

        // Placeholder enrichment fields — filled below
        profileSummary: "",
        skillsInsight: "",
        domainInsight: "",
        projectsIntro: "",
        strengthInsight: "",
        careerIntentExplanation: "",
        alignmentExplanation: "",
        techStackDistribution: { backend: 0, frontend: 0, ai_ml: 0, mobile: 0, devops: 0, data: 0, automation: 0, other: 100 },
        projectComplexityMap: [],
        skillsDetailed: [],
        experienceTimeline: [],
        careerProgression: { score: 0, trendLabel: "Early stage" },

        generatedAt: new Date().toISOString(),
    };

    // 5c. Run UI enrichment
    console.log(`[Career Intelligence] Running UI enrichment...`);
    const enrichment = enrichForUI(
        baseIntelligence,
        skills,
        github,
        linkedin,
        rawExperiences,
        rawEducation
    );

    const rawIntelligence: CareerIntelligence = {
        ...baseIntelligence,
        ...enrichment,
    };
    console.log(
        `[Career Intelligence] UI enrichment complete: ` +
        `${enrichment.skillsDetailed.length} detailed skills, ` +
        `${enrichment.experienceTimeline.length} timeline entries, ` +
        `progression=${enrichment.careerProgression.score} (${enrichment.careerProgression.trendLabel})`
    );

    // ── 6. Polish via Gemini ──────────────────────────────
    console.log(`[Career Intelligence] Sending to Gemini for polishing...`);
    const polished = await polishIntelligence(rawIntelligence);
    console.log(`[Career Intelligence] Polishing complete`);

    // ── 7. Save to database ───────────────────────────────
    const intelligenceJson = JSON.parse(
        JSON.stringify(polished)
    ) as Prisma.InputJsonValue;

    await prisma.userProfile.update({
        where: { userId },
        data: { careerIntelligence: intelligenceJson },
    });

    console.log(
        `[Career Intelligence] ✅ Saved career intelligence for user ${userId}`
    );

    return polished;
}

// ── FIX 4: Deterministic Summary Generator ────────────────

import type { MergedProject, CareerLevel } from "./types.js";

/**
 * Generate a professional summary from deterministic merge output.
 * Used as fallback if Gemini polishing fails, and as input seed
 * for Gemini to refine.
 */
function generateDeterministicSummary(
    primaryDomain: string,
    coreSkills: string[],
    highlightProjects: MergedProject[],
    careerLevel: CareerLevel,
    alignmentInsight: string
): string {
    const skillText = coreSkills.length > 0
        ? coreSkills.slice(0, 3).join(", ")
        : "various technologies";

    const projectText = highlightProjects.length > 0
        ? highlightProjects.slice(0, 2).map((p) => p.name).join(" and ")
        : null;

    let summary = `${careerLevel} specializing in ${primaryDomain} with core expertise in ${skillText}.`;

    if (projectText) {
        summary += ` Notable projects include ${projectText}.`;
    }

    // Add a brief alignment note
    if (alignmentInsight && !alignmentInsight.includes("skipped") && !alignmentInsight.includes("neutral")) {
        // Extract first sentence of alignment insight
        const firstSentence = alignmentInsight.split(".")[0] + ".";
        summary += ` ${firstSentence}`;
    }

    return summary;
}
