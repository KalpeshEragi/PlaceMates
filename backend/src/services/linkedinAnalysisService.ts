import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { prisma } from "../lib/prisma";
import { computeDeterministicInsights } from "./linkedin/deterministicEngine";
import { runGeminiEnrichment } from "./linkedin/geminiEnrichment";
import { parse } from "csv-parse/sync";
import { computeAdvancedProfileScore } from "./linkedin/profileQualityEngine";

export async function processLinkedinZip(userId: string) {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
  });

  if (!user?.linkedinZipPath) {
    throw new Error("LinkedIn ZIP not found");
  }

  const absoluteZipPath = path.resolve(process.cwd(), user.linkedinZipPath);
  const tempDir = path.resolve(process.cwd(), "temp", "linkedin", userId);

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // =====================================================
    // 1️⃣ SAFE ZIP EXTRACTION
    // =====================================================
    let zip;

    try {
      zip = new AdmZip(absoluteZipPath);
    } catch {
      throw new Error("Invalid or corrupted LinkedIn ZIP file");
    }

    try {
      zip.extractAllTo(tempDir, true);
    } catch {
      throw new Error("Failed to extract LinkedIn ZIP");
    }

    // =====================================================
    // 2️⃣ RESOLVE ROOT DIRECTORY (Handle nested export)
    // =====================================================
    const rootDir = resolveLinkedinRootDir(tempDir);

    // =====================================================
    // 3️⃣ VALIDATE REQUIRED FILES
    // =====================================================
    validateLinkedinExport(rootDir);

    // =====================================================
    // 4️⃣ SAFE FILE PARSING
    // =====================================================
    const profile = readJsonIfExists(rootDir, "Profile.json");
    const positions = readCsvIfExists(rootDir, "Positions.csv");
    const skills = readCsvIfExists(rootDir, "Skills.csv");
    const education = readCsvIfExists(rootDir, "Education.csv");
    const projects = readCsvIfExists(rootDir, "Projects.csv");
    const certifications = readCsvIfExists(rootDir, "Certifications.csv");
    const connections = readCsvIfExists(rootDir, "Connections.csv");

    // =====================================================
    // 5️⃣ PARTIAL PROFILE SAFETY
    // =====================================================
    const safeProfile = profile || {};
    const safePositions = positions || [];
    const safeSkills = skills || [];
    const safeEducation = education || [];
    const safeProjects = projects || [];
    const safeCertifications = certifications || [];
    const safeConnections = connections || [];

    // =====================================================
    // 6️⃣ DETERMINISTIC ENGINE
    // =====================================================
    const deterministic = computeDeterministicInsights({
      profile: safeProfile,
      positions: safePositions,
      skills: safeSkills,
      education: safeEducation,
      projects: safeProjects,
      certifications: safeCertifications,
      connections: safeConnections,
    });

    const profileScore = computeAdvancedProfileScore({
      profile: safeProfile,
      positions: safePositions,
      skills: safeSkills,
      projects: safeProjects,
      certifications: safeCertifications,
      education: safeEducation,
      connections: safeConnections,
    });

    // =====================================================
    // 7️⃣ GEMINI ENRICHMENT (AI LAYER)
    // =====================================================
    let gemini = {};
    try {
      gemini = await runGeminiEnrichment({
        profile: safeProfile,
        positions: safePositions,
        projects: safeProjects,
      });
    } catch (error) {
      console.warn("Gemini enrichment failed. Continuing without AI layer.");
      gemini = {};
    }

    // =====================================================
    // 8️⃣ SAVE MAIN INSIGHT RECORD
    // =====================================================
    const { skillClusters, ...deterministicRest } = deterministic;

    const savedInsight = await prisma.linkedinInsight.upsert({
      where: { userId },
      update: {
        ...deterministicRest,
        ...gemini,
        profileScore,
        processedAt: new Date(),
      },
      create: {
        userId,
        ...deterministicRest,
        ...gemini,
        profileScore,
        processedAt: new Date(),
      },
    });

    // =====================================================
    // 9️⃣ SAVE SKILL INSIGHTS (linked to the insight record)
    // =====================================================
    if (skillClusters?.length) {
      await prisma.linkedinSkillInsight.deleteMany({
        where: { userId },
      });

      await prisma.linkedinSkillInsight.createMany({
        data: skillClusters.map((s: any) => ({
          userId,
          insightId: savedInsight.id,  // populate FK for the new relation
          skillName: s.skillName,
          frequency: s.frequency,
          cluster: s.cluster,
        })),
      });
    }

  } finally {
    // =====================================================
    // 🔟 CLEANUP (ALWAYS RUNS)
    // =====================================================
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      console.warn("Temp cleanup failed");
    }
  }
}

// =========================================================
// 🧠 HELPER FUNCTIONS
// =========================================================

function resolveLinkedinRootDir(baseDir: string): string {
  const files = fs.readdirSync(baseDir);

  if (files.length === 1) {
    const possibleDir = path.join(baseDir, files[0]);
    if (fs.statSync(possibleDir).isDirectory()) {
      return possibleDir;
    }
  }

  return baseDir;
}

function validateLinkedinExport(dir: string) {
  const requiredFiles = ["Positions.csv"];

  const missing = requiredFiles.filter(
    (file) => !fs.existsSync(path.join(dir, file))
  );

  if (missing.length) {
    throw new Error(
      `Invalid LinkedIn export. Missing required file(s): ${missing.join(", ")}`
    );
  }
}

function readJsonIfExists(dir: string, file: string) {
  const filePath = path.join(dir, file);

  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    console.warn(`Invalid JSON file: ${file}`);
    return null;
  }
}

function readCsvIfExists(dir: string, file: string) {
  const filePath = path.join(dir, file);

  if (!fs.existsSync(filePath)) return [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");

    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch {
    console.warn(`Failed to parse CSV: ${file}`);
    return [];
  }
}