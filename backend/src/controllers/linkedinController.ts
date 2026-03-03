import type { Response } from "express";
import path from "path";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { advanceStage } from "../middleware/onboardingGuard";

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
