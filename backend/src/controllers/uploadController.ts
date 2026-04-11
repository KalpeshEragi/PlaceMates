/**
 * uploadController.ts
 *
 * Routes:
 *   POST /api/upload/profile-image   — upload profile image → Cloudinary → save URL
 *   POST /api/upload/project-image/:projectId — upload project image → Cloudinary → save URL
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { uploadImageToCloudinary } from "../services/cloudinaryService";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── POST /api/upload/profile-image ──────────────────────────

export async function uploadProfileImage(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  if (file.size > MAX_FILE_SIZE) {
    return res.status(400).json({ error: "File size exceeds 5 MB limit." });
  }

  try {
    const imageUrl = await uploadImageToCloudinary(file.buffer, "placemates/profiles");

    await prisma.userProfile.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId, profileImageUrl: imageUrl },
      update: { profileImageUrl: imageUrl },
    });

    return res.status(200).json({ success: true, imageUrl });
  } catch (error) {
    console.error("[Upload] Profile image failed:", error);
    return res.status(500).json({ error: "Failed to upload profile image." });
  }
}

// ─── POST /api/upload/project-image/:projectId ──────────────

export async function uploadProjectImage(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const projectId = req.params.projectId as string;
  if (!projectId) {
    return res.status(400).json({ error: "Missing projectId." });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  if (file.size > MAX_FILE_SIZE) {
    return res.status(400).json({ error: "File size exceeds 5 MB limit." });
  }

  try {
    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      select: { id: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    const imageUrl = await uploadImageToCloudinary(file.buffer, "placemates/projects");

    await prisma.project.update({
      where: { id: projectId },
      data: { imageUrl },
    });

    return res.status(200).json({ success: true, imageUrl });
  } catch (error) {
    console.error("[Upload] Project image failed:", error);
    return res.status(500).json({ error: "Failed to upload project image." });
  }
}
