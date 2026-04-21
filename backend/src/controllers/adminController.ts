import { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// GET /api/admin/all-resumes
// Returns ALL tailored resumes for ALL users across the platform
// ─────────────────────────────────────────────────────────────
export const getAllResumes = async (req: AuthRequest, res: Response) => {
  try {
    const resumes = await prisma.tailoredResume.findMany({
      include: { 
        job: true,
        user: {
          include: {
            profile: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      resumes: resumes.map((r) => ({
        id: r.id,
        resumeUrl: r.resumeUrl,
        atsScore: r.atsScore ?? null,
        iterations: r.iterations ?? 1,
        createdAt: r.createdAt,
        user: {
           id: r.user.id,
           email: r.user.email,
           name: r.user.profile?.name || "Unknown User"
        },
        job: {
          id: r.job.id,
          title: r.job.title,
          company: r.job.company,
        },
      })),
      totalResumes: resumes.length,
    });
  } catch (error) {
    console.error("[getAllResumes] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
