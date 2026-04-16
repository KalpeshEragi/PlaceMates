/**
 * profileTextEncoder.ts
 *
 * Converts a user's structured profile data into a single text string
 * suitable for embedding. Also computes MD5 hash for cache invalidation.
 */

import { createHash } from "crypto";

export interface ProfileData {
  name?: string;
  email?: string;
  primaryDomain?: string;
  summaryText?: string;
  skills: Array<{ name: string; domain?: string | null }>;
  projects: Array<{
    name: string;
    domain?: string | null;
    techStack: string[];
    description?: string | null;
    finalBullets: string[];
  }>;
  experiences: Array<{
    role: string;
    company: string;
    description?: string | null;
  }>;
  educations: Array<{
    institution: string;
    degree?: string | null;
    field?: string | null;
  }>;
  certifications: Array<{ name: string; issuer?: string | null }>;
  awards: Array<{ title: string }>;
}

/**
 * Encode a user's profile into a single text string for embedding.
 *
 * The output is structured for maximum semantic matching quality:
 * weighting domain, skills, and experience most heavily.
 */
export function encodeProfileToText(profile: ProfileData): string {
  const parts: string[] = [];

  // Domain (most important signal)
  if (profile.primaryDomain) {
    parts.push(`Domain: ${profile.primaryDomain}`);
  }

  // Summary
  if (profile.summaryText) {
    parts.push(profile.summaryText);
  }

  // Skills (critical for matching)
  if (profile.skills.length > 0) {
    const skillNames = profile.skills.map((s) => s.name);
    parts.push(`Skills: ${skillNames.join(", ")}`);
  }

  // Experience
  for (const exp of profile.experiences) {
    let expText = `${exp.role} at ${exp.company}`;
    if (exp.description) {
      expText += `: ${exp.description}`;
    }
    parts.push(expText);
  }

  // Top projects (limit to 5 for embedding quality)
  const topProjects = profile.projects.slice(0, 5);
  for (const proj of topProjects) {
    const tech = proj.techStack.join(", ");
    let projText = `Project ${proj.name} (${tech})`;
    if (proj.description) {
      projText += `: ${proj.description}`;
    } else if (proj.finalBullets.length > 0) {
      projText += `: ${proj.finalBullets.join(". ")}`;
    }
    parts.push(projText);
  }

  // Education
  for (const edu of profile.educations) {
    parts.push(
      `${edu.degree || "Degree"} in ${edu.field || "CS"} from ${edu.institution}`
    );
  }

  // Certifications
  for (const cert of profile.certifications) {
    parts.push(`Certified: ${cert.name}${cert.issuer ? ` by ${cert.issuer}` : ""}`);
  }

  return parts.join(" | ");
}

/**
 * Compute MD5 hash of the profile text for cache invalidation.
 * If the hash hasn't changed, we skip re-embedding.
 */
export function computeProfileHash(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

/**
 * Build the profile data structure from a Prisma user include result.
 */
export function buildProfileDataFromPrisma(user: any): ProfileData {
  return {
    name: user.profile?.name,
    email: user.email,
    primaryDomain: user.summary?.primaryDomain,
    summaryText: user.summary?.summaryText,
    skills: (user.skills || []).map((s: any) => ({
      name: s.name,
      domain: s.domain,
    })),
    projects: (user.projects || []).map((p: any) => ({
      name: p.name,
      domain: p.domain,
      techStack: p.techStack || [],
      description: p.description,
      finalBullets: p.finalBullets || [],
    })),
    experiences: (user.experiences || []).map((e: any) => ({
      role: e.role,
      company: e.company,
      description: e.description,
    })),
    educations: (user.educations || []).map((e: any) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field,
    })),
    certifications: (user.certifications || []).map((c: any) => ({
      name: c.name,
      issuer: c.issuer,
    })),
    awards: (user.awards || []).map((a: any) => ({
      title: a.title,
    })),
  };
}
