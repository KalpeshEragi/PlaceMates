import type { Response } from "express";
import path from "path";
import AdmZip from "adm-zip";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { advanceStage } from "../middleware/onboardingGuard";
import { classifyFile, isCsv, isExcel } from "../utils/linkedin/fileFilter.js";
import { parseCsvFile } from "../utils/linkedin/csvParser.js";
import { parseExcelFile } from "../utils/linkedin/xlsxParser.js";
import { mapToLinkedInProfile } from "../utils/linkedin/dataMapper.js";
import type { ParsedFile } from "../utils/linkedin/types.js";
import fs from "fs";
import os from "os";

// ── Helper: extract ZIP → parse files → LinkedInProfile ────
async function parseLinkedInZip(zipPath: string) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // Extract to a temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkedin-"));
  zip.extractAllTo(tmpDir, true);

  const parsedFiles: ParsedFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const category = classifyFile(entry.entryName);
    if (!category) continue;

    const filePath = path.join(tmpDir, entry.entryName);

    try {
      let rows: Record<string, string>[];
      if (isCsv(entry.entryName)) {
        rows = await parseCsvFile(filePath);
      } else if (isExcel(entry.entryName)) {
        rows = parseExcelFile(filePath);
      } else {
        continue;
      }

      parsedFiles.push({ category, rows });
    } catch (err) {
      console.warn(`Skipping file ${entry.entryName}:`, err);
    }
  }

  // Clean up temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return mapToLinkedInProfile(parsedFiles);
}

// ── Helper: compute basic insights from parsed profile ─────
function computeBasicInsights(profile: ReturnType<typeof mapToLinkedInProfile> extends Promise<infer T> ? T : ReturnType<typeof mapToLinkedInProfile>) {
  // Calculate total experience years
  let totalExperienceYears: number | null = null;
  if (profile.experience.length > 0) {
    let totalMonths = 0;
    for (const exp of profile.experience) {
      const start = exp.startDate ? new Date(exp.startDate) : null;
      const end = exp.endDate ? new Date(exp.endDate) : new Date();
      if (start && !isNaN(start.getTime())) {
        const endDate = end && !isNaN(end.getTime()) ? end : new Date();
        const months = (endDate.getFullYear() - start.getFullYear()) * 12 +
          (endDate.getMonth() - start.getMonth());
        totalMonths += Math.max(0, months);
      }
    }
    totalExperienceYears = Math.round((totalMonths / 12) * 10) / 10;
  }

  // Infer primary domain from most common industry or job titles
  const primaryDomain = profile.personal.industry || null;

  // Compute profile completeness score (0-100)
  let profileScore = 0;
  if (profile.personal.firstName) profileScore += 10;
  if (profile.personal.headline) profileScore += 15;
  if (profile.about) profileScore += 15;
  if (profile.experience.length > 0) profileScore += 20;
  if (profile.education.length > 0) profileScore += 15;
  if (profile.skills.length > 0) profileScore += 15;
  if (profile.projects.length > 0) profileScore += 5;
  if (profile.certifications.length > 0) profileScore += 5;

  return { totalExperienceYears, primaryDomain, profileScore };
}

export async function uploadLinkedinZip(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No ZIP file uploaded" });
  }

  try {
    const relativePath = path.relative(process.cwd(), req.file.path);

    // Parse the ZIP contents
    const profile = await parseLinkedInZip(req.file.path);
    const insights = computeBasicInsights(profile);

    // Store ZIP path + mark imported
    await prisma.userAuth.update({
      where: { id: req.userId },
      data: {
        linkedinImported: true,
        linkedinZipPath: relativePath,
      },
    });

    // Upsert LinkedinInsight
    await prisma.linkedinInsight.upsert({
      where: { userId: req.userId },
      create: {
        userId: req.userId,
        totalExperienceYears: insights.totalExperienceYears,
        primaryDomain: insights.primaryDomain,
        profileScore: insights.profileScore,
        processedAt: new Date(),
      },
      update: {
        totalExperienceYears: insights.totalExperienceYears,
        primaryDomain: insights.primaryDomain,
        profileScore: insights.profileScore,
        processedAt: new Date(),
      },
    });

    // Store LinkedIn skills
    if (profile.skills.length > 0) {
      // Delete existing skills for this user (replace with fresh data)
      await prisma.linkedinSkillInsight.deleteMany({
        where: { userId: req.userId },
      });

      await prisma.linkedinSkillInsight.createMany({
        data: profile.skills.map((s) => ({
          userId: req.userId!,
          skillName: s.name,
          frequency: 1,
        })),
      });
    }

    await advanceStage(req.userId, "linkedin_imported");

    return res.status(200).json({
      success: true,
      message: "LinkedIn ZIP uploaded and processed successfully",
      linkedin_zip_path: relativePath,
      linkedin_uploaded: true,
      profile,
    });
  } catch (error) {
    console.error("LinkedIn upload failed:", error);
    return res.status(500).json({ error: "Failed to process LinkedIn ZIP" });
  }
}

// ── Debug endpoint: return stored LinkedIn data ────────────
export async function getLinkedinData(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [user, insight, skills] = await Promise.all([
      prisma.userAuth.findUnique({
        where: { id: req.userId },
        select: {
          linkedinImported: true,
          linkedinZipPath: true,
        },
      }),
      prisma.linkedinInsight.findUnique({
        where: { userId: req.userId },
      }),
      prisma.linkedinSkillInsight.findMany({
        where: { userId: req.userId },
      }),
    ]);

    // Also re-parse the ZIP if it exists, to show the raw parsed profile
    let parsedProfile = null;
    if (user?.linkedinZipPath) {
      const absPath = path.resolve(process.cwd(), user.linkedinZipPath);
      if (fs.existsSync(absPath)) {
        try {
          parsedProfile = await parseLinkedInZip(absPath);
        } catch (e) {
          console.warn("Could not re-parse ZIP:", e);
        }
      }
    }

    return res.status(200).json({
      linkedinImported: user?.linkedinImported ?? false,
      linkedinZipPath: user?.linkedinZipPath ?? null,
      insight,
      skills,
      parsedProfile,
    });
  } catch (error) {
    console.error("Failed to fetch LinkedIn data:", error);
    return res.status(500).json({ error: "Failed to fetch LinkedIn data" });
  }
}
