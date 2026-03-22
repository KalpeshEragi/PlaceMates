/**
 * linkedinAnalysisService.ts
 *
 * Pipeline:
 *   LinkedIn ZIP upload
 *     → extract relevant CSVs (Positions, Skills, Education, Honors, Certifications, Profile)
 *       → parse + clean each file
 *         → light AI refinement for experience descriptions
 *           → merge skills with existing GitHub skills
 *             → persist: Experience, Education, Award, Certification, Skill, UserSummary
 *
 * Nothing is stored except the final structured, resume-ready data.
 */

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type CsvRow = Record<string, string>;

type ParsedData = {
  positions: CsvRow[];
  skills: CsvRow[];
  education: CsvRow[];
  honors: CsvRow[];
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

  // Handle nested folder (some LinkedIn exports wrap everything in a subdirectory)
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
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as CsvRow[];
  } catch {
    console.warn(`Could not parse ${filename} — skipping.`);
    return [];
  }
}

/**
 * Profile.csv has a single data row. Extract the "Summary" field.
 * LinkedIn also exports "Profile Summary.csv" as a fallback.
 */
function readProfileSummary(dir: string): string | null {
  // Try Profile.csv first
  const rows = readCsv(dir, "Profile.csv");
  const summary = rows[0]?.["Summary"] || rows[0]?.["summary"] || null;
  if (summary?.trim()) return summary.trim();

  // Fallback to Profile Summary.csv
  const summaryRows = readCsv(dir, "Profile Summary.csv");
  const text = summaryRows[0]?.["Summary"] || summaryRows[0]?.["summary"] || null;
  return text?.trim() || null;
}

function parseLinkedinData(rootDir: string): ParsedData {
  // Validate: Positions.csv is the only required file
  if (!fs.existsSync(path.join(rootDir, "Positions.csv"))) {
    throw new Error("Invalid LinkedIn export: Positions.csv not found.");
  }

  return {
    positions: readCsv(rootDir, "Positions.csv"),
    skills: readCsv(rootDir, "Skills.csv"),
    education: readCsv(rootDir, "Education.csv"),
    honors: readCsv(rootDir, "Honors.csv"),
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

/**
 * Normalize skill names so GitHub and LinkedIn skills can be deduplicated.
 * Keeps the result human-readable (not lowercased) for display.
 *
 * Examples:
 *   "React.js"  → "React"
 *   "NodeJS"    → "Node.js"
 *   "node.js"   → "Node.js"
 *   "Typescript"→ "TypeScript"
 */
const SKILL_ALIASES: Record<string, string> = {
  "react.js": "React",
  "reactjs": "React",
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "vue.js": "Vue.js",
  "vuejs": "Vue.js",
  "express.js": "Express",
  "expressjs": "Express",
  "typescript": "TypeScript",
  "javascript": "JavaScript",
  "postgresql": "PostgreSQL",
  "postgres": "PostgreSQL",
  "mongodb": "MongoDB",
  "c plus plus": "C++",
  "c/c++": "C++",
};

function normalizeSkillName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];
  // Title-case everything else
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map a normalized skill name to a broad domain.
 */
function inferSkillDomain(name: string): string {
  const lower = name.toLowerCase();
  if (/react|vue|next|angular|html|css|tailwind|svelte|frontend/.test(lower)) return "Frontend";
  if (/node|express|django|flask|spring|rails|fastapi|backend|api|rest|graphql/.test(lower)) return "Backend";
  if (/python|tensorflow|pytorch|keras|scikit|pandas|numpy|ml|machine learning|ai/.test(lower)) return "ML";
  if (/docker|kubernetes|aws|azure|gcp|ci\/cd|terraform|devops|linux/.test(lower)) return "DevOps";
  if (/swift|kotlin|flutter|react native|android|ios|mobile/.test(lower)) return "Mobile";
  if (/postgres|mysql|mongodb|redis|sql|database|prisma|firebase/.test(lower)) return "Backend";
  return "Other";
}

// ─────────────────────────────────────────────
// Light AI — experience description refinement
// ─────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const AI_MODEL = "claude-sonnet-4-20250514";

/**
 * Rewrite a raw LinkedIn experience description into a concise,
 * resume-friendly paragraph. If the description is missing or very
 * short we return it as-is (no hallucination).
 */
async function refineExperienceDescription(
  role: string,
  company: string,
  rawDescription: string,
): Promise<string> {
  if (!rawDescription || rawDescription.length < 30) return rawDescription;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1000,
        system: [
          "You are a professional resume editor.",
          "Rewrite the provided job description into 2-3 concise, resume-friendly sentences.",
          "Rules:",
          "- Use strong action verbs",
          "- Keep the original meaning intact — do NOT invent metrics or achievements",
          "- Remove filler phrases like 'I was responsible for' or 'My duties included'",
          "- Return ONLY the rewritten description as plain text. No JSON, no markdown.",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: `Role: ${role} at ${company}\n\nDescription:\n${rawDescription.slice(0, 800)}`,
          },
        ],
      }),
    });

    if (!response.ok) return rawDescription;

    const data = (await response.json()) as {
      content: { type: string; text?: string }[];
    };

    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    return text || rawDescription;
  } catch {
    return rawDescription;
  }
}

// ─────────────────────────────────────────────
// DB persistence helpers
// ─────────────────────────────────────────────

async function persistExperiences(userId: string, positions: CsvRow[]): Promise<void> {
  if (!positions.length) return;

  // Wipe and re-insert — LinkedIn import is always a full replacement
  await prisma.experience.deleteMany({ where: { userId } });

  const records = await Promise.all(
    positions.map(async (p) => {
      const role = trimStr(p["Title"]) ?? "Unknown Role";
      const company = trimStr(p["Company Name"]) ?? "Unknown Company";
      const rawDesc = trimStr(p["Description"]) ?? "";
      const description = await refineExperienceDescription(role, company, rawDesc);

      return {
        userId,
        role,
        company,
        startDate: trimStr(p["Started On"]),
        endDate: trimStr(p["Finished On"]),
        description: description || null,
      };
    }),
  );

  await prisma.experience.createMany({ data: records });
}

async function persistEducation(userId: string, rows: CsvRow[]): Promise<void> {
  if (!rows.length) return;

  await prisma.education.deleteMany({ where: { userId } });

  await prisma.education.createMany({
    data: rows.map((r) => ({
      userId,
      institution: trimStr(r["School Name"]) ?? "Unknown Institution",
      degree: trimStr(r["Degree Name"]),
      field: trimStr(r["Field Of Study"] || r["Field of Study"]),
      startDate: trimStr(r["Start Date"]),
      endDate: trimStr(r["End Date"]),
      gpa: trimStr(r["Grade"] || r["GPA"]),
    })),
  });
}

async function persistAwards(userId: string, rows: CsvRow[]): Promise<void> {
  if (!rows.length) return;

  await prisma.award.deleteMany({ where: { userId } });

  await prisma.award.createMany({
    data: rows
      .filter((r) => trimStr(r["Title"] || r["Honor Title"]))
      .map((r) => ({
        userId,
        title: trimStr(r["Title"] || r["Honor Title"]) ?? "Award",
        description: trimStr(r["Description"]),
        issuedAt: trimStr(r["Issued On"] || r["Date"]),
      })),
  });
}

async function persistCertifications(userId: string, rows: CsvRow[]): Promise<void> {
  if (!rows.length) return;

  await prisma.certification.deleteMany({ where: { userId } });

  await prisma.certification.createMany({
    data: rows
      .filter((r) => trimStr(r["Name"] || r["Certification Name"]))
      .map((r) => ({
        userId,
        name: trimStr(r["Name"] || r["Certification Name"]) ?? "Certification",
        issuer: trimStr(r["Authority"] || r["Issuing Authority"] || r["Issuer"]),
        issuedAt: trimStr(r["Started On"] || r["Issued On"]),
      })),
  });
}

/**
 * Merge LinkedIn skills into the Skill table.
 *
 * Rules:
 * - GitHub skills (source = "github") are primary — never overwritten
 * - LinkedIn skills with no match → inserted with source = "linkedin"
 * - LinkedIn skills that match an existing GitHub skill → source updated to "both"
 */
async function mergeSkills(userId: string, rawSkills: CsvRow[]): Promise<void> {
  if (!rawSkills.length) return;

  const linkedinSkills = rawSkills
    .map((r) => normalizeSkillName(r["Name"] || r["Skill Name"] || r["Skill"] || ""))
    .filter(Boolean)
    .filter((name, idx, arr) => arr.indexOf(name) === idx); // deduplicate

  for (const name of linkedinSkills) {
    const domain = inferSkillDomain(name);

    await prisma.skill.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, domain, source: "linkedin" },
      update: {
        // If it already exists from GitHub → mark as "both"
        source: "both",
        domain, // LinkedIn may add domain context
      },
    });
  }
}

async function persistSummary(userId: string, summaryText: string): Promise<void> {
  await prisma.userSummary.upsert({
    where: { userId },
    create: { userId, summaryText },
    update: { summaryText },
  });
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export async function processLinkedinZip(userId: string): Promise<void> {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: { linkedinZipPath: true },
  });

  if (!user?.linkedinZipPath) {
    throw new Error("LinkedIn ZIP path not found for this user.");
  }

  const absoluteZipPath = path.resolve(process.cwd(), user.linkedinZipPath);
  const tempDir = path.resolve(process.cwd(), "temp", "linkedin", userId);

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const rootDir = extractZip(absoluteZipPath, tempDir);
    const data = parseLinkedinData(rootDir);

    // Run all persistence steps — experiences need sequential AI calls,
    // the rest can run in parallel.
    await persistExperiences(userId, data.positions);

    await Promise.all([
      persistEducation(userId, data.education),
      persistAwards(userId, data.honors),
      persistCertifications(userId, data.certifications),
      mergeSkills(userId, data.skills),
    ]);

    // If the user has no existing summary, seed one from the LinkedIn About section
    if (data.profileSummary) {
      const existing = await prisma.userSummary.findUnique({ where: { userId } });
      if (!existing) {
        await persistSummary(userId, data.profileSummary);
      }
    }

    // Mark LinkedIn as imported
    await prisma.userAuth.update({
      where: { id: userId },
      data: { linkedinImported: true },
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}