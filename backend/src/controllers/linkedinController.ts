import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import path from "path";
import { advanceStage } from "../middleware/onboardingGuard";
import { processLinkedinZip } from "../services/linkedinAnalysisService";
import { extractPositionsFromZip } from "../utils/linkedin/positionExtractor";

export async function uploadLinkedinZip(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No ZIP file uploaded" });
  }

  try {
    const relativePath = path.relative(process.cwd(), req.file.path);

    await prisma.userAuth.update({
      where: { id: req.userId },
      data: {
        linkedinImported: true,
        linkedinZipPath: relativePath,
      },
    });
    await advanceStage(req.userId, "linkedin_imported");

    return res.status(200).json({
      success: true,
      message: "LinkedIn ZIP uploaded successfully",
      linkedin_zip_path: relativePath,
      linkedin_uploaded: true,
    });
  } catch (error) {
    console.error("LinkedIn upload failed:", error);
    return res.status(500).json({ error: "Failed to save LinkedIn ZIP" });
  }
}


// POST /api/linkedin/analyze
export async function analyzeLinkedin(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  processLinkedinZip(req.userId).catch((err) => {
    console.error("LinkedIn analysis failed:", err);
  });

  return res.status(202).json({
    success: true,
    status: "queued",
    message: "LinkedIn analysis started. Insights will be available shortly.",
  });
}


// In-flight deduplication: if two requests for the same userId arrive
// simultaneously (e.g. React StrictMode double-mount), they share one DB query.
const insightInflight = new Map<string, Promise<any>>();

// GET /api/linkedin/insights
export async function getLinkedinInsights(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Deduplicate concurrent calls for the same user
    if (!insightInflight.has(req.userId)) {
      const query = prisma.linkedinInsight.findUnique({
        where: { userId: req.userId },
        include: {
          skills: {
            orderBy: { frequency: "desc" },
          },
        },
      }).finally(() => {
        insightInflight.delete(req.userId!);
      });
      insightInflight.set(req.userId, query);
    }

    const result = await insightInflight.get(req.userId)!;

    const insight = result ? (({ skills: _s, ...rest }: any) => rest)(result) : null;
    const skills = result?.skills ?? [];

    // Extract positions from the stored LinkedIn ZIP (best-effort)
    const positions = await extractPositionsFromZip(req.userId!);

    return res.status(200).json({
      insight,
      skills,
      positions,
    });
  } catch (error) {
    console.error("Failed to fetch LinkedIn insights:", error);
    return res.status(500).json({
      error: "linkedin_insights_fetch_failed",
    });
  }
}