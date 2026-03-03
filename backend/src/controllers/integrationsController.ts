import type { Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

export async function getIntegrationStatus(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await prisma.userAuth.findUnique({
      where: { id: req.userId },
      select: {
        githubConnected: true,
        linkedinImported: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      github_connected: user.githubConnected,
      linkedin_uploaded: user.linkedinImported,
    });
  } catch (error) {
    console.error("Failed to fetch integration status:", error);
    return res.status(500).json({ error: "Failed to fetch integration status" });
  }
}
