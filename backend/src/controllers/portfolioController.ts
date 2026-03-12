import type { Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

export async function createPortfolio(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { email, github, linkedin, website } = req.body as {
    email?: string;
    github?: string;
    linkedin?: string;
    website?: string;
  };

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Generate slug from email: "rahul@gmail.com" -> "rahul"
  const portfolioSlug = email.split("@")[0];

  try {
    const portfolio = await prisma.userPortfolio.create({
      data: {
        userId,
        publicEmail: email,
        githubUrl: github || null,
        linkedinUrl: linkedin || null,
        websiteUrl: website || null,
        portfolioSlug,
      },
    });

    return res.json({ success: true, slug: portfolio.portfolioSlug });
  } catch (error: any) {
    // Handle unique constraint violation (slug or userId already exists)
    if (error?.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Portfolio already exists for this user or slug is taken" });
    }

    console.error("Failed to create portfolio:", error);
    return res.status(500).json({ error: "Failed to create portfolio" });
  }
}
