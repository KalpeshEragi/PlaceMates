import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { extractPositionsFromZip } from "../utils/linkedin/positionExtractor";
import { extractCertificationsFromZip } from "../utils/linkedin/certificationsExtractor";

export async function getPublicPortfolio(req: Request, res: Response) {
  const { slug } = req.params;
  const portfolioSlug = Array.isArray(slug) ? slug[0] : slug;

  try {
    // 1. Find portfolio by slug
    const portfolio = await prisma.userPortfolio.findUnique({
      where: { portfolioSlug },
    });

    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const userId = portfolio.userId;

    // 2. Fetch all related data in parallel
    const [user, linkedinInsight, skills, repositories, dashboardInsight, positions, certifications, githubSkillInsights] =
      await Promise.all([
        prisma.userAuth.findUnique({
          where: { id: userId },
          include: { profile: true },
        }),

        prisma.linkedinInsight.findUnique({
          where: { userId },
        }),

        prisma.linkedinSkillInsight.findMany({
          where: { userId },
        }),

        prisma.githubRepository.findMany({
          where: { userId },
          orderBy: { finalScore: "desc" },
        }),

        prisma.userDashboardInsight.findUnique({
          where: { userId },
        }),

        extractPositionsFromZip(userId),

        extractCertificationsFromZip(userId),

        prisma.userSkillInsight.findMany({
          where: { userId },
        }),
      ]);

    // 3. Shape response
    return res.json({
      profile: {
        photo: user?.profile?.avatarUrl ?? null,
        email: portfolio.publicEmail,
        github: portfolio.githubUrl,
        linkedin: portfolio.linkedinUrl,
        website: portfolio.websiteUrl,
      },

      career: {
        primaryDomain: linkedinInsight?.primaryDomain ?? null,
        secondaryDomain: linkedinInsight?.secondaryDomain ?? null,
        technicalOrientation: linkedinInsight?.technicalOrientation ?? null,
        experienceYears: linkedinInsight?.totalExperienceYears ?? null,
        careerSummary: linkedinInsight?.careerSummary ?? null,
      },

      skills: skills.map((s: any) => ({
        name: s.skillName,
        frequency: s.frequency,
        cluster: s.cluster,
      })),

      projects: repositories.slice(0, 6).map((r: any) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stars,
        forks: r.forks,
        repoUrl: r.repoUrl,
        detectedDomain: r.detectedDomain,
        finalScore: r.finalScore,
      })),

      githubSkills: githubSkillInsights.map((s: any) => ({
        name: s.skillName,
        strength: s.strengthScore,
        source: s.source,
      })),

      repoLanguages: repositories.map((r: any) => ({
        language: r.language,
        locByLanguage: r.locByLanguage,
        description: r.description,
        readmeSummary: r.readmeSummary,
      })),

      experience: positions.map((p: any) => ({
        start: p.start || null,
        end: p.end || null,
        role: p.title || null,
        company: p.company || null,
        description: p.description || null,
      })),

      achievements: certifications.map((c: any) => ({
        title: c.name,
        issuer: c.authority || null,
        year: c.startDate || null,
      })),

      domains: {
        primaryDomain: linkedinInsight?.primaryDomain ?? null,
        secondaryDomain: linkedinInsight?.secondaryDomain ?? null,
        technicalOrientation: linkedinInsight?.technicalOrientation ?? null,
      },

      stats: {
        profileScore: linkedinInsight?.profileScore ?? null,
        leadershipScore: linkedinInsight?.leadershipScore ?? null,
        impactScore: linkedinInsight?.impactScore ?? null,
        ownershipScore: linkedinInsight?.ownershipScore ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch public portfolio:", error);
    return res.status(500).json({ error: "Failed to fetch portfolio" });
  }
}
