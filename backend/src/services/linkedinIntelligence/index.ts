// ────────────────────────────────────────────────────────────
// LinkedIn Intelligence — Orchestrator
// ────────────────────────────────────────────────────────────
//
// Pipeline:
//   1. Fetch LinkedIn profile from importedData
//   2. Run experience semantic analysis
//   3. Analyze role progression
//   4. Separate claimed / validated / hidden skills
//   5. Parse career intent from About text
//   6. Analyze curated projects
//   7. Extract education context
//   8. Analyze certifications / learning direction
//   9. Compose final LinkedInInsights
//   10. Save to database
//
// Exports:
//   processLinkedInIntelligence(userId) → LinkedInInsights
// ────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

import type {
    LinkedInProfile,
    LinkedInExperience,
    LinkedInProject,
    LinkedInCertification,
    LinkedInEducation,
} from "../../utils/linkedin/types.js";

import type { LinkedInInsights } from "./types.js";

import { analyzeAllExperiences } from "./experienceAnalyzer.js";
import { analyzeRoleProgression } from "./roleProgressionAnalyzer.js";
import { analyzeSkills } from "./skillAnalyzer.js";
import { parseCareerIntent } from "./intentParser.js";
import { analyzeAllProjects } from "./projectAnalyzer.js";
import { analyzeEducation } from "./educationAnalyzer.js";
import { analyzeCertifications } from "./certificationAnalyzer.js";

// ── Public API ────────────────────────────────────────────

/**
 * Run the full LinkedIn Intelligence pipeline for a user.
 *
 * @param userId - Authenticated user's ID
 * @returns Complete LinkedInInsights object
 */
export async function processLinkedInIntelligence(
    userId: string
): Promise<LinkedInInsights> {
    console.log(`[LinkedIn Intelligence] Starting analysis for user ${userId}`);

    // ── 1. Fetch user data ─────────────────────────────────
    const profile = await prisma.userProfile.findUnique({
        where: { userId },
    });

    if (!profile) {
        throw new Error(
            "User profile not found. Please complete your profile setup first."
        );
    }

    const importedData =
        (profile.importedData as Record<string, unknown>) || {};
    const linkedInData = importedData.linkedInProfile as
        | Partial<LinkedInProfile>
        | undefined;

    if (!linkedInData) {
        throw new Error(
            "No LinkedIn data found. Please import your LinkedIn data export first."
        );
    }

    console.log(`[LinkedIn Intelligence] LinkedIn data found, running pipeline`);

    // ── 2. Extract raw sections safely ─────────────────────
    const experiences: LinkedInExperience[] = Array.isArray(
        linkedInData.experience
    )
        ? linkedInData.experience
        : [];

    const aboutText: string =
        typeof linkedInData.about === "string" ? linkedInData.about : "";

    const headline: string | undefined =
        typeof linkedInData.personal?.headline === "string"
            ? linkedInData.personal.headline
            : undefined;

    const skillNames: string[] = Array.isArray(linkedInData.skills)
        ? linkedInData.skills
            .map((s: { name?: string }) => s.name || "")
            .filter(Boolean)
        : [];

    const projects: LinkedInProject[] = Array.isArray(linkedInData.projects)
        ? linkedInData.projects
        : [];

    const education: LinkedInEducation[] = Array.isArray(
        linkedInData.education
    )
        ? linkedInData.education
        : [];

    const certifications: LinkedInCertification[] = Array.isArray(
        linkedInData.certifications
    )
        ? linkedInData.certifications
        : [];

    console.log(
        `[LinkedIn Intelligence] Sections: ${experiences.length} experiences, ` +
        `${skillNames.length} skills, ${projects.length} projects, ` +
        `${education.length} education, ${certifications.length} certifications`
    );

    // ── 3. Run analyzers ───────────────────────────────────

    // 3a. Experience semantic analysis
    const experienceInsights = analyzeAllExperiences(experiences);
    console.log(
        `[LinkedIn Intelligence] Analyzed ${experienceInsights.length} experiences`
    );

    // 3b. Role progression
    const roleProgression = analyzeRoleProgression(experiences);
    console.log(
        `[LinkedIn Intelligence] Career stage: ${roleProgression.careerStage}, ` +
        `progression score: ${roleProgression.roleProgressionScore}`
    );

    // 3c. Skills analysis
    const skillsInsight = analyzeSkills(skillNames, experiences, projects);
    console.log(
        `[LinkedIn Intelligence] Skills: ${skillsInsight.claimedSkills.length} claimed, ` +
        `${skillsInsight.validatedSkills.length} validated, ` +
        `${skillsInsight.hiddenSkills.length} hidden`
    );

    // 3d. Career intent parsing
    const careerIntent = parseCareerIntent(aboutText, headline);
    console.log(
        `[LinkedIn Intelligence] Intent: ${careerIntent.targetDomains.join(", ") || "none detected"}`
    );

    // 3e. Project analysis
    const curatedProjects = analyzeAllProjects(projects);
    console.log(
        `[LinkedIn Intelligence] Analyzed ${curatedProjects.length} curated projects`
    );

    // 3f. Education context
    const educationContext = analyzeEducation(education);
    console.log(
        `[LinkedIn Intelligence] Education: student=${educationContext.isStudent}, ` +
        `relevance=${educationContext.fieldRelevanceToTech}`
    );

    // 3g. Certification / learning direction
    const learningDir = analyzeCertifications(certifications);
    console.log(
        `[LinkedIn Intelligence] Learning direction: ${learningDir.learningDirection.join(", ") || "none detected"}`
    );

    // ── 4. Compute overall impact score ────────────────────
    const impactScoreOverall =
        experienceInsights.length > 0
            ? Math.round(
                (experienceInsights.reduce(
                    (sum, e) => sum + e.impactScore,
                    0
                ) /
                    experienceInsights.length) *
                10
            ) / 10
            : 0;

    // ── 5. Aggregate leadership signals ────────────────────
    const allLeadershipSignals = [
        ...new Set(
            experienceInsights.flatMap((e) => e.leadershipSignals)
        ),
    ];

    // ── 6. Compose final LinkedInInsights ──────────────────
    const linkedinInsights: LinkedInInsights = {
        careerStage: roleProgression.careerStage,
        roleProgressionScore: roleProgression.roleProgressionScore,
        impactScoreOverall,
        leadershipSignals: allLeadershipSignals,
        claimedSkills: skillsInsight.claimedSkills,
        validatedSkills: skillsInsight.validatedSkills,
        hiddenSkills: skillsInsight.hiddenSkills,
        curatedProjects,
        careerIntentKeywords: careerIntent.careerIntentKeywords,
        specializationDirection: careerIntent.specializationDirection,
        learningDirection: learningDir.learningDirection,
        experienceInsights,
        educationContext,
        generatedAt: new Date().toISOString(),
    };

    // ── 7. Save to database ────────────────────────────────
    const insightsJson = JSON.parse(
        JSON.stringify(linkedinInsights)
    ) as Prisma.InputJsonValue;

    await prisma.userProfile.update({
        where: { userId },
        data: { linkedinInsights: insightsJson },
    });

    console.log(
        `[LinkedIn Intelligence] ✅ Saved insights for user ${userId}`
    );

    return linkedinInsights;
}
