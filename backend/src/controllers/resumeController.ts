import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { analyzeJobDescriptionWithAI, improveResumeText, type ImproveTextContext } from "../services/geminiService";
import { prisma } from "../lib/prisma";
import { compareResumeWithJob, evaluateResumeAts } from "../services/resumeComparisonService";
import { extractPositionsFromZip } from "../utils/linkedin/positionExtractor";
import { extractCertificationsFromZip } from "../utils/linkedin/certificationsExtractor";
import { extractEducationFromZip } from "../utils/linkedin/educationExtractor";
import { extractHonorsFromZip } from "../utils/linkedin/honorsExtractor";
import { extractCoursesFromZip } from "../utils/linkedin/coursesExtractor";

// POST /api/resume/analyze-jd
export async function analyzeJobDescription(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Resolve job description text ─────────────────────────────────
  let text: string | undefined;

  if (typeof req.body?.jobDescriptionText === "string") {
    const trimmed = req.body.jobDescriptionText.trim();
    if (trimmed.length > 0) text = trimmed;
  }

  if (!text && req.file) {
    // Plain-text / txt files land here; PDF/DOCX are treated as-is for now
    text = req.file.buffer?.toString("utf-8")?.trim() || undefined;
  }

  if (!text) {
    return res.status(400).json({
      error:
        "Please provide a job description — either upload a file or paste text.",
    });
  }

  // ── Call Gemini AI ────────────────────────────────────────────────
  let analysis;
  try {
    analysis = await analyzeJobDescriptionWithAI(text);
  } catch (err) {
    console.error("[resumeController] Gemini call failed:", err);
    return res.status(500).json({ error: "AI analysis failed. Please try again." });
  }

  if (!analysis) {
    return res.status(500).json({ error: "AI returned an empty analysis. Please try again." });
  }

  // ── Persist to DB ─────────────────────────────────────────────────
  let insight;
  try {
    insight = await prisma.jobDescriptionInsight.create({
      data: {
        userId: req.userId,
        role: analysis.role,
        requiredSkills: analysis.requiredSkills,
        domain: analysis.domain,
        keywords: analysis.keywords,
        experienceLevel: analysis.experienceLevel,
      },
    });
  } catch (err) {
    console.error("[resumeController] DB save failed:", err);
    return res.status(500).json({ error: "Failed to save analysis. Please try again." });
  }

  // ── Return structured result ──────────────────────────────────────
  return res.status(200).json({
    success: true,
    insight,
  });
}

// GET /api/resume/comparison-scores
export async function getComparisonScores(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.userId;

  // ── Fetch latest JD insight ───────────────────────────────────────
  const jdInsight = await prisma.jobDescriptionInsight.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!jdInsight) {
    // No JD analyzed yet — return empty scores so the frontend degrades gracefully
    return res.status(200).json({ projectMatch: [], experienceMatch: [] });
  }

  // ── Assemble user data from GitHub repos ─────────────────────────
  const githubRepos = await prisma.githubRepository.findMany({
    where: { userId },
    select: { name: true, description: true, language: true },
  });

  // ── Assemble user data from LinkedIn positions ────────────────────
  const linkedinInsight = await prisma.linkedinInsight.findUnique({
    where: { userId },
    select: { id: true },
  });

  // We store positions as part of the raw LinkedIn import; retrieve from the related model
  // Use a raw query to get position data that was stored during LinkedIn import
  // The LinkedinInsight model doesn't store individual positions — they come from
  // the linkedinApi on the frontend. We'll use the careerSummary text as a fallback,
  // and build experience entries from LinkedinSkillInsight clusters combined with insight.
  const linkedinSkills = await prisma.linkedinSkillInsight.findMany({
    where: { userId },
    select: { skillName: true },
  });

  // ── Build UserData for compareResumeWithJob ───────────────────────
  const userData = {
    skills: linkedinSkills.map((s) => s.skillName),
    projects: githubRepos.map((r) => ({
      name: r.name,
      description: r.description ?? "",
      techStack: r.language ? [r.language] : [],
    })),
    // Experience entries can't be reconstructed from DB alone since LinkedIn positions
    // are not stored in a structured model. We pass an empty array; the service
    // will still score projects and skills accurately.
    experience: [] as { role: string; company: string; description: string }[],
  };

  // ── Build JobRequirements ─────────────────────────────────────────
  const jobRequirements = {
    role: jdInsight.role ?? undefined,
    skills: Array.isArray(jdInsight.requiredSkills)
      ? (jdInsight.requiredSkills as string[])
      : [],
    experienceLevel: jdInsight.experienceLevel ?? undefined,
    description: (jdInsight.keywords as string[] | null)?.join(", ") ?? undefined,
  };

  // ── Run comparison ────────────────────────────────────────────────
  try {
    const scores = await compareResumeWithJob(jobRequirements, userData);
    return res.status(200).json({
      projectMatch: scores.projectMatch,
      experienceMatch: scores.experienceMatch,
    });
  } catch (err) {
    console.error("[getComparisonScores] Comparison failed:", err);
    // Don't block the user — return empty scores
    return res.status(200).json({ projectMatch: [], experienceMatch: [] });
  }
}

// POST /api/resume/ats-score
export async function getAtsScore(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.userId;
  const { resumeData } = req.body;

  if (!resumeData) {
    return res.status(400).json({ error: "Missing resumeData in request body." });
  }

  // ── Fetch latest JD insight ───────────────────────────────────────
  const jdInsight = await prisma.jobDescriptionInsight.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!jdInsight) {
    return res.status(400).json({ error: "No Job Description analysis found. Please analyze a JD first." });
  }

  // ── Build JobRequirements ─────────────────────────────────────────
  const jobRequirements = {
    role: jdInsight.role ?? undefined,
    skills: Array.isArray(jdInsight.requiredSkills)
      ? (jdInsight.requiredSkills as string[])
      : [],
    experienceLevel: jdInsight.experienceLevel ?? undefined,
    description: (jdInsight.keywords as string[] | null)?.join(", ") ?? undefined,
  };

  // ── Run Evaluation ────────────────────────────────────────────────
  try {
    const evaluation = await evaluateResumeAts(jobRequirements, resumeData);
    return res.status(200).json({
      success: true,
      evaluation,
    });
  } catch (err) {
    console.error("[getAtsScore] ATS evaluation failed:", err);
    return res.status(500).json({ error: "Failed to evaluate ATS score." });
  }
}

// GET /api/resume/user-data
// Returns all LinkedIn data for the Resume Information Form autofill.
export async function getUserData(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.userId;

  try {
    // Extract all CSV data from the stored LinkedIn ZIP in parallel
    const [positions, education, certifications, honors, courses, linkedinSkills] =
      await Promise.all([
        extractPositionsFromZip(userId),
        extractEducationFromZip(userId),
        extractCertificationsFromZip(userId),
        extractHonorsFromZip(userId),
        extractCoursesFromZip(userId),
        prisma.linkedinSkillInsight.findMany({
          where: { userId },
          select: { skillName: true },
        }),
      ]);

    return res.status(200).json({
      positions,
      education,
      certifications,
      honors,
      courses,
      skills: linkedinSkills.map((s) => s.skillName),
    });
  } catch (err) {
    console.error("[getUserData] Failed to fetch user data:", err);
    return res.status(500).json({ error: "Failed to fetch user data." });
  }
}

// POST /api/resume/improve-text
export async function improveText(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { text, context } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing or empty 'text' in request body." });
  }

  const validContexts: ImproveTextContext[] = ["experience", "project", "education", "award"];
  if (!context || !validContexts.includes(context)) {
    return res.status(400).json({
      error: `Invalid 'context'. Must be one of: ${validContexts.join(", ")}`,
    });
  }

  try {
    const improvedText = await improveResumeText(text, context as ImproveTextContext);
    return res.status(200).json({ improvedText });
  } catch (err) {
    console.error("[improveText] AI rewrite failed:", err);
    return res.status(500).json({ error: "AI text improvement failed. Please try again." });
  }
}
