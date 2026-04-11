/**
 * portfolioPublicController.ts
 *
 * Public (no auth) endpoint:
 *   GET /api/portfolio/:slug — return full portfolio data for rendering
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { buildUserOutputPayload } from "../services/userOutputPayload";

export async function getPublicPortfolio(req: Request, res: Response) {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({ error: "Missing portfolio slug." });
  }

  try {
    const portfolio = await prisma.userPortfolio.findUnique({
      where: { portfolioSlug: slug as string },
      select: { userId: true, publicEmail: true, githubUrl: true, linkedinUrl: true },
    });

    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found." });
    }

    const payload = await buildUserOutputPayload(portfolio.userId);

    const { portfolioData } = payload;

    return res.status(200).json({
      templateId: payload.portfolioTemplateId ?? "p1",
      data: {
        ...portfolioData,
        projects: portfolioData.projects.map(
          ({ id: _id, projectIntent: _pi, ...rest }) => rest,
        ),
      },
      meta: {
        githubUrl: portfolio.githubUrl ?? payload.meta.githubUrl,
        linkedinUrl: portfolio.linkedinUrl ?? payload.meta.linkedinUrl,
        email: portfolio.publicEmail,
        profileImageUrl: payload.meta.profileImageUrl ?? null,
      },
    });
  } catch (error) {
    console.error("[Portfolio Public] Failed:", error);
    return res.status(500).json({ error: "Failed to load portfolio." });
  }
}
