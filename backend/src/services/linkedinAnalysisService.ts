/**
 * linkedinAnalysisService.ts
 *
 * Fully offline LinkedIn ZIP processing pipeline. No external AI APIs.
 *
 * Pipeline:
 *   LinkedIn ZIP upload
 *     → extract relevant CSVs (Positions, Skills, Education, Honors, Certifications, Profile)
 *       → parse + clean each file
 *         → rule-based experience description formatting  (replaces AI)
 *           → merge skills with existing GitHub skills
 *             → persist: Experience, Education, Award, Certification, Skill, UserSummary
 *
 * Nothing is stored except final structured, resume-ready data.
 */

import fs   from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma";
import { normalizeSkillName, formatExperienceDescription } from "./utils/textUtils";
import { inferSkillDomain }  from "./analysis/domainDetector";
import { generateUserSummary } from "./summary/summaryGenerator";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type CsvRow = Record<string, string>;

type ParsedData = {
  positions:      CsvRow[];
  skills:         CsvRow[];
  education:      CsvRow[];
  honors:         CsvRow[];
  certifications: CsvRow[];
  profileSummary: string | null;
};

// ─────────────────────────────────────────────
// ZIP extraction
// ─────────────────────────────────────────────

function extractZip(zipPath: string, destDir: string): string {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipPath);
  } catch {
    throw new Error("Invalid or corrupted LinkedIn ZIP file.");
  }
  try {
    zip.extractAllTo(destDir, true);
  } catch {
    throw new Error("Failed to extract LinkedIn ZIP.");
  }

  // Handle nested folder (some exports wrap everything in a subdirectory)
  const entries = fs.readdirSync(destDir);
  if (entries.length === 1) {
    const single = path.join(destDir, entries[0]);
    if (fs.statSync(single).isDirectory()) return single;
  }
  return destDir;
}

// ─────────────────────────────────────────────
// CSV parsing
// ─────────────────────────────────────────────

function readCsv(dir: string, filename: string): CsvRow[] {
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return parse(raw, {
      columns:            true,
      skip_empty_lines:   true,
      relax_column_count: true,
      trim:               true,
    }) as CsvRow[];
  } catch {
    console.warn(`[LinkedIn] Could not parse ${filename} — skipping.`);
    return [];
  }
}

function readProfileSummary(dir: string): string | null {
  // Try Profile.csv first
  const rows = readCsv(dir, "Profile.csv");
  const summary = rows[0]?.["Summary"] ?? rows[0]?.["summary"] ?? null;
  if (summary?.trim()) return summary.trim();

  // Fallback
  const summaryRows = readCsv(dir, "Profile Summary.csv");
  const text = summaryRows[0]?.["Summary"] ?? summaryRows[0]?.["summary"] ?? null;
  return text?.trim() || null;
}

function parseLinkedinData(rootDir: string): ParsedData {
  if (!fs.existsSync(path.join(rootDir, "Positions.csv"))) {
    throw new Error("Invalid LinkedIn export: Positions.csv not found.");
  }

  return {
    positions:      readCsv(rootDir, "Positions.csv"),
    skills:         readCsv(rootDir, "Skills.csv"),
    education:      readCsv(rootDir, "Education.csv"),
    honors:         readCsv(rootDir, "Honors.csv"),
    certifications: readCsv(rootDir, "Certifications.csv"),
    profileSummary: readProfileSummary(rootDir),
  };
}

// ─────────────────────────────────────────────
// Data cleaners
// ─────────────────────────────────────────────

function trimStr(val: string | undefined): string | null {
  const v = val?.trim();
  return v || null;
}

// ─────────────────────────────────────────────
// DB persistence helpers
// ─────────────────────────────────────────────

async function persistExperiences(
  userId: string,
  positions: CsvRow[],
): Promise<void> {
  if (!positions.length) return;

  // LinkedIn import always replaces all experiences
  await prisma.experience.deleteMany({ where: { userId } });

  const records = positions.map((p) => {
    const role    = trimStr(p["Title"])        ?? "Unknown Role";
    const company = trimStr(p["Company Name"]) ?? "Unknown Company";
    const rawDesc = trimStr(p["Description"])  ?? "";

    // ── Rule-based formatting (replaces AI) ───
    const description =
      rawDesc.length >= 15
        ? formatExperienceDescription(role, company, rawDesc)
        : rawDesc || null;

    return {
      userId,
      role,
      company,
      startDate:   trimStr(p["Started On"]),
      endDate:     trimStr(p["Finished On"]),
      description: description || null,
    };
  });

  await prisma.experience.createMany({ data: records });
}

async function persistEducation(
  userId: string,
  rows: CsvRow[],
): Promise<void> {
  if (!rows.length) return;

  await prisma.education.deleteMany({ where: { userId } });

  await prisma.education.createMany({
    data: rows.map((r) => ({
      userId,
      institution: trimStr(r["School Name"])                     ?? "Unknown Institution",
      degree:      trimStr(r["Degree Name"]),
      field:       trimStr(r["Field Of Study"] ?? r["Field of Study"]),
      startDate:   trimStr(r["Start Date"]),
      endDate:     trimStr(r["End Date"]),
      gpa:         trimStr(r["Grade"] ?? r["GPA"]),
    })),
  });
}

async function persistAwards(
  userId: string,
  rows: CsvRow[],
): Promise<void> {
  if (!rows.length) return;

  await prisma.award.deleteMany({ where: { userId } });

  await prisma.award.createMany({
    data: rows
      .filter((r) => trimStr(r["Title"] ?? r["Honor Title"]))
      .map((r) => ({
        userId,
        title:       trimStr(r["Title"] ?? r["Honor Title"]) ?? "Award",
        description: trimStr(r["Description"]),
        issuedAt:    trimStr(r["Issued On"] ?? r["Date"]),
      })),
  });
}

async function persistCertifications(
  userId: string,
  rows: CsvRow[],
): Promise<void> {
  if (!rows.length) return;

  await prisma.certification.deleteMany({ where: { userId } });

  await prisma.certification.createMany({
    data: rows
      .filter((r) => trimStr(r["Name"] ?? r["Certification Name"]))
      .map((r) => ({
        userId,
        name:     trimStr(r["Name"] ?? r["Certification Name"]) ?? "Certification",
        issuer:   trimStr(r["Authority"] ?? r["Issuing Authority"] ?? r["Issuer"]),
        issuedAt: trimStr(r["Started On"] ?? r["Issued On"]),
      })),
  });
}

/**
 * Merge LinkedIn skills into the Skill table.
 *
 * Rules:
 *  - GitHub skills (source = "github") are primary — upgraded to "both"
 *  - Net-new LinkedIn skills → source = "linkedin"
 */
async function mergeSkills(
  userId: string,
  rawSkills: CsvRow[],
): Promise<void> {
  if (!rawSkills.length) return;

  const linkedinSkills = rawSkills
    .map((r) =>
      normalizeSkillName(
        r["Name"] ?? r["Skill Name"] ?? r["Skill"] ?? "",
      ),
    )
    .filter(Boolean)
    .filter((name, idx, arr) => arr.indexOf(name) === idx); // deduplicate

  for (const name of linkedinSkills) {
    const domain = inferSkillDomain(name);
    await prisma.skill.upsert({
      where:  { userId_name: { userId, name } },
      create: { userId, name, domain, source: "linkedin" },
      update: { source: "both", domain },
    });
  }
}

async function persistOrUpdateSummary(
  userId: string,
  linkedinSummary: string | null,
): Promise<void> {
  // If user already has an AI/GitHub-generated summary, don't overwrite it
  const existing = await prisma.userSummary.findUnique({ where: { userId } });
  if (existing) return;

  if (!linkedinSummary) return;

  // Use the offline summary generator to polish the LinkedIn About text
  // by treating it as the only project bullet available
  const summaryText = generateUserSummary({
    topProjects:   [],
    topSkills:     [],
    topDomains:    [],
    primaryDomain: null,
  });

  // Prefer the raw LinkedIn summary if it's rich enough
  const finalSummary =
    linkedinSummary.length > 60 ? linkedinSummary : summaryText;

  await prisma.userSummary.upsert({
    where:  { userId },
    create: { userId, summaryText: finalSummary },
    update: { summaryText: finalSummary },
  });
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export async function processLinkedinZip(userId: string): Promise<void> {
  const user = await prisma.userAuth.findUnique({
    where:  { id: userId },
    select: { linkedinZipPath: true },
  });

  if (!user?.linkedinZipPath) {
    throw new Error("LinkedIn ZIP path not found for this user.");
  }

  const absoluteZipPath = path.resolve(process.cwd(), user.linkedinZipPath);
  const tempDir         = path.resolve(process.cwd(), "temp", "linkedin", userId);

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const rootDir = extractZip(absoluteZipPath, tempDir);
    const data    = parseLinkedinData(rootDir);

    // Experiences are processed sequentially (each can be heavy text)
    await persistExperiences(userId, data.positions);

    // Everything else can run in parallel
    await Promise.all([
      persistEducation(userId, data.education),
      persistAwards(userId, data.honors),
      persistCertifications(userId, data.certifications),
      mergeSkills(userId, data.skills),
    ]);

    // Seed summary only if none exists yet
    await persistOrUpdateSummary(userId, data.profileSummary);

    await prisma.userAuth.update({
      where: { id: userId },
      data:  { linkedinImported: true },
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}