/**
 * Builds portfolio + resume preview payloads for a user (shared by public portfolio API and /user/preview-data).
 */

import { prisma } from "../lib/prisma";

export type PublicPortfolioDataShape = {
  name: string;
  role: string;
  summary: string;
  skills: string[];
  projects: Array<{
    id: string;
    name: string;
    description: string;
    techStack: string[];
    finalBullets: string[];
    projectIntent?: string | null;
    imageUrl?: string | null;
    repoUrl?: string;
  }>;
  experience: Array<{
    role: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education: Array<{ institution: string; degree: string; duration: string }>;
  awards: Array<{ title: string; description?: string }>;
};

export type ResumeDataShape = {
  name?: string;
  email: string;
  summary?: string;
  skills: Array<{ name: string; domain?: string }>;
  projects: Array<{
    name: string;
    techStack: string[];
    finalBullets: string[];
    description?: string;
  }>;
  experiences: Array<{
    role: string;
    company: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  educations: Array<{
    institution: string;
    degree?: string;
    field?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
  }>;
  awards?: Array<{ title: string; description?: string; issuedAt?: string }>;
  certifications?: Array<{ name: string; issuer?: string; issuedAt?: string }>;
};

export type UserOutputPayload = {
  portfolioTemplateId: string | null;
  resumeTemplateId: string | null;
  onboardingOutputFinalizedAt: string | null;
  portfolioData: PublicPortfolioDataShape;
  resumeData: ResumeDataShape;
  meta: {
    email: string;
    githubUrl: string | null;
    linkedinUrl: string | null;
    profileImageUrl: string | null;
  };
};

export async function buildUserOutputPayload(userId: string): Promise<UserOutputPayload> {
  const [userAuth, profile, summary, projects, skills, experiences, educations, awards, certifications, portfolio] =
    await Promise.all([
      prisma.userAuth.findUnique({
        where: { id: userId },
        select: {
          email: true,
          githubLogin: true,
          portfolioTemplateId: true,
          resumeTemplateId: true,
          onboardingOutputFinalizedAt: true,
          selectedProjectIds: true,
        },
      }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: { name: true, avatarUrl: true, profileImageUrl: true },
      }),
      prisma.userSummary.findUnique({
        where: { userId },
        select: { summaryText: true, primaryDomain: true },
      }),
      prisma.project.findMany({
        where: { userId },
        orderBy: [{ rankingScore: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          name: true,
          repoUrl: true,
          domain: true,
          techStack: true,
          baseBullets: true,
          finalBullets: true,
          description: true,
          projectIntent: true,
          imageUrl: true,
        },
      }),
      prisma.skill.findMany({
        where: { userId },
        select: { name: true, domain: true },
      }),
      prisma.experience.findMany({
        where: { userId },
        select: {
          role: true,
          company: true,
          startDate: true,
          endDate: true,
          description: true,
        },
      }),
      prisma.education.findMany({
        where: { userId },
        select: {
          institution: true,
          degree: true,
          field: true,
          startDate: true,
          endDate: true,
          gpa: true,
        },
      }),
      prisma.award.findMany({
        where: { userId },
        select: { title: true, description: true, issuedAt: true },
      }),
      prisma.certification.findMany({
        where: { userId },
        select: { name: true, issuer: true, issuedAt: true },
      }),
      prisma.userPortfolio.findUnique({
        where: { userId },
        select: { publicEmail: true, githubUrl: true, linkedinUrl: true },
      }),
    ]);

  if (!userAuth) {
    throw new Error("User not found");
  }

  const name = profile?.name ?? userAuth.githubLogin ?? "Developer";
  const role = summary?.primaryDomain
    ? `${summary.primaryDomain} Developer`
    : "Software Developer";

  const selectedIds = userAuth.selectedProjectIds ?? [];
  let orderedProjects = projects;
  if (selectedIds.length > 0) {
    const byId = new Map(projects.map((p) => [p.id, p]));
    orderedProjects = selectedIds
      .map((id) => byId.get(id))
      .filter((p): p is (typeof projects)[number] => Boolean(p));
  }
  /** All projects in selection order (up to 6). Preview/finalize must include every ID in `selectedProjectIds`. */
  const showcaseProjects = orderedProjects;

  const defaultSummary = `${name} is a software developer building production-grade applications.`;
  const summaryText = summary?.summaryText ?? defaultSummary;

  const portfolioData: PublicPortfolioDataShape = {
    name,
    role,
    summary: summaryText,
    skills: skills.map((s) => s.name),
    projects: showcaseProjects.map((p) => ({
      id: p.id,
      name: p.name,
      description:
        p.description ??
        (p.finalBullets.length > 0
          ? p.finalBullets[0]
          : p.baseBullets.length > 0
            ? p.baseBullets[0]
            : `A project built with ${p.techStack.slice(0, 3).join(", ")}`),
      techStack: p.techStack,
      finalBullets: p.finalBullets.length > 0 ? p.finalBullets : p.baseBullets,
      projectIntent: p.projectIntent ?? null,
      imageUrl: p.imageUrl ?? null,
      repoUrl: p.repoUrl,
    })),
    experience: experiences.map((e) => ({
      role: e.role,
      company: e.company,
      duration: [e.startDate, e.endDate ?? "Present"].filter(Boolean).join(" – "),
      description: e.description ?? "",
    })),
    education: educations.map((e) => ({
      institution: e.institution,
      degree: [e.degree, e.field].filter(Boolean).join(" in "),
      duration: [e.startDate, e.endDate].filter(Boolean).join(" – "),
    })),
    awards: awards.map((a) => ({
      title: a.title,
      description: a.description ?? undefined,
    })),
  };

  const email = portfolio?.publicEmail ?? userAuth.email;

  const resumeData: ResumeDataShape = {
    name,
    email,
    summary: summaryText,
    skills: skills.map((s) => ({ name: s.name, domain: s.domain ?? undefined })),
    projects: showcaseProjects.map((p) => ({
      name: p.name,
      techStack: p.techStack,
      finalBullets: p.finalBullets.length > 0 ? p.finalBullets : p.baseBullets,
      description: p.description ?? undefined,
    })),
    experiences: experiences.map((e) => ({
      role: e.role,
      company: e.company,
      startDate: e.startDate ?? undefined,
      endDate: e.endDate ?? undefined,
      description: e.description ?? undefined,
    })),
    educations: educations.map((e) => ({
      institution: e.institution,
      degree: e.degree ?? undefined,
      field: e.field ?? undefined,
      startDate: e.startDate ?? undefined,
      endDate: e.endDate ?? undefined,
      gpa: e.gpa ?? undefined,
    })),
    awards: awards.map((a) => ({
      title: a.title,
      description: a.description ?? undefined,
      issuedAt: a.issuedAt ?? undefined,
    })),
    certifications: certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer ?? undefined,
      issuedAt: c.issuedAt ?? undefined,
    })),
  };

  return {
    portfolioTemplateId: userAuth.portfolioTemplateId,
    resumeTemplateId: userAuth.resumeTemplateId,
    onboardingOutputFinalizedAt: userAuth.onboardingOutputFinalizedAt
      ? userAuth.onboardingOutputFinalizedAt.toISOString()
      : null,
    portfolioData,
    resumeData,
    meta: {
      email,
      githubUrl: portfolio?.githubUrl ?? (userAuth.githubLogin ? `https://github.com/${userAuth.githubLogin}` : null),
      linkedinUrl: portfolio?.linkedinUrl ?? null,
      profileImageUrl: profile?.profileImageUrl ?? null,
    },
  };
}
