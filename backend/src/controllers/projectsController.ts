/**
 * projectsController.ts
 *
 * Routes:
 *   GET  /api/projects/candidates   — top 10 analyzed repos (for selection UI)
 *   GET  /api/projects/selected     — projects user chose for portfolio (quiz order)
 *   POST /api/projects/select       — persist 5–6 selected project IDs
 *   GET  /api/projects/analyzed     — backward compatible: same as /selected when set, else top 5
 *   POST /api/projects/batch-finalize — single-page quiz: all intents + AI enrichment in one call
 *   POST /api/projects/:id/update-impact — Resume Studio: update impact/contribution per project
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { finalizeProjectWithAI } from "../services/generator/quizFinalizer";
import { regenerateUserSummaryForUser } from "../services/githubAnalysisService";
import {
  enrichAllProjects,
  type ProjectContext,
  type EnrichedProject,
} from "../services/ai/projectEnrichmentService";

const SELECT_MIN = 5;
const SELECT_MAX = 6;
const CANDIDATE_LIMIT = 10;

// ─── GET /api/projects/candidates ────────────────────────────

export async function getProjectCandidates(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: req.userId,
        baseBullets: { isEmpty: false },
      },
      orderBy: [{ rankingScore: "desc" }, { updatedAt: "desc" }],
      take: CANDIDATE_LIMIT,
      select: {
        id: true,
        name: true,
        repoUrl: true,
        domain: true,
        projectType: true,
        collaborators: true,
        techStack: true,
        description: true,
        baseBullets: true,
        finalBullets: true,
        rankingScore: true,
        stars: true,
        forks: true,
        repoDescription: true,
        aiDescription: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({ projects });
  } catch (error) {
    console.error("[Projects] candidates:", error);
    return res.status(500).json({ error: "Failed to fetch project candidates." });
  }
}

// ─── GET /api/projects/selected ───────────────────────────────

export async function getSelectedProjects(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await prisma.userAuth.findUnique({
      where: { id: req.userId },
      select: { selectedProjectIds: true },
    });

    const ids = user?.selectedProjectIds ?? [];
    if (ids.length === 0) {
      return res.status(200).json({ projects: [] });
    }

    const found = await prisma.project.findMany({
      where: { userId: req.userId, id: { in: ids } },
      select: {
        id: true,
        name: true,
        repoUrl: true,
        domain: true,
        projectType: true,
        collaborators: true,
        techStack: true,
        description: true,
        baseBullets: true,
        finalBullets: true,
        projectIntent: true,
        impactEntries: true,
        contributionArea: true,
        quizExtraNotes: true,
        stars: true,
        forks: true,
        repoDescription: true,
        readmeExcerpt: true,
        aiDescription: true,
        aiSkills: true,
        aiComplexity: true,
        aiUniqueAngle: true,
        updatedAt: true,
      },
    });

    const order = new Map(ids.map((id, i) => [id, i]));
    const projects = found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return res.status(200).json({ projects });
  } catch (error) {
    console.error("[Projects] selected:", error);
    return res.status(500).json({ error: "Failed to fetch selected projects." });
  }
}

// ─── POST /api/projects/select ───────────────────────────────

export async function selectPortfolioProjects(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const { projectIds } = req.body as { projectIds?: string[] };
  if (!Array.isArray(projectIds)) {
    return res.status(400).json({ error: "projectIds must be an array of UUIDs." });
  }

  if (projectIds.length < SELECT_MIN || projectIds.length > SELECT_MAX) {
    return res.status(400).json({
      error: `Select between ${SELECT_MIN} and ${SELECT_MAX} projects.`,
    });
  }

  const unique = new Set(projectIds);
  if (unique.size !== projectIds.length) {
    return res.status(400).json({ error: "Duplicate project IDs are not allowed." });
  }

  try {
    const rows = await prisma.project.findMany({
      where: {
        userId: req.userId,
        id: { in: projectIds },
        baseBullets: { isEmpty: false },
      },
      select: { id: true },
    });

    if (rows.length !== projectIds.length) {
      return res.status(400).json({
        error: "One or more projects are invalid or not analyzed.",
      });
    }

    await prisma.userAuth.update({
      where: { id: req.userId },
      data: {
        selectedProjectIds: projectIds,
        onboardingQuizCompletedAt: null,
      },
    });

    return res.status(200).json({ success: true, projectIds });
  } catch (error) {
    console.error("[Projects] select:", error);
    return res.status(500).json({ error: "Failed to save project selection." });
  }
}

// ─── GET /api/projects/analyzed (backward compatible) ─────────

export async function getAnalyzedProjects(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await prisma.userAuth.findUnique({
      where: { id: req.userId },
      select: { selectedProjectIds: true },
    });

    const ids = user?.selectedProjectIds ?? [];

    if (ids.length > 0) {
      const found = await prisma.project.findMany({
        where: { userId: req.userId, id: { in: ids } },
        select: {
          id: true,
          name: true,
          repoUrl: true,
          domain: true,
          projectType: true,
          collaborators: true,
          techStack: true,
          description: true,
          baseBullets: true,
          finalBullets: true,
          updatedAt: true,
        },
      });
      const order = new Map(ids.map((id, i) => [id, i]));
      const projects = found
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .slice(0, 6);

      return res.status(200).json({ projects });
    }

    const projects = await prisma.project.findMany({
      where: {
        userId: req.userId,
        baseBullets: { isEmpty: false },
      },
      orderBy: [{ rankingScore: "desc" }, { updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        name: true,
        repoUrl: true,
        domain: true,
        projectType: true,
        collaborators: true,
        techStack: true,
        description: true,
        baseBullets: true,
        finalBullets: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({ projects });
  } catch (error) {
    console.error("[Projects] Failed to fetch analyzed projects:", error);
    return res.status(500).json({ error: "Failed to fetch analyzed projects." });
  }
}

// ─── POST /api/projects/batch-finalize ───────────────────────
//
// Single-page quiz: receives all project intents at once.
// Makes ONE LLM call for all projects, then finalizes bullets.
//
// Body: { projects: [{ projectId: string, intent: string }] }

export async function batchFinalizeProjects(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body as { projects?: Array<{ projectId: string; intent: string }> };

  if (!Array.isArray(body.projects) || body.projects.length === 0) {
    return res.status(400).json({ error: "projects array is required." });
  }

  // Validate all intents
  for (const p of body.projects) {
    if (!p.projectId || typeof p.projectId !== "string") {
      return res.status(400).json({ error: "Each project must have a projectId." });
    }
    const words = (p.intent || "").trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      return res.status(400).json({
        error: `Intent for project ${p.projectId} must be at least 2 words.`,
      });
    }
  }

  try {
    // 1. Verify all projects belong to user and are selected
    const userRow = await prisma.userAuth.findUnique({
      where: { id: req.userId },
      select: { selectedProjectIds: true },
    });
    const selected = new Set(userRow?.selectedProjectIds ?? []);

    const projectIds = body.projects.map((p) => p.projectId);
    for (const id of projectIds) {
      if (selected.size > 0 && !selected.has(id)) {
        return res.status(400).json({
          error: `Project ${id} is not in your portfolio selection.`,
        });
      }
    }

    // 2. Load all projects with metadata
    const dbProjects = await prisma.project.findMany({
      where: { userId: req.userId, id: { in: projectIds } },
      select: {
        id: true,
        name: true,
        repoUrl: true,
        domain: true,
        projectType: true,
        collaborators: true,
        techStack: true,
        baseBullets: true,
        stars: true,
        forks: true,
        repoDescription: true,
        readmeExcerpt: true,
      },
    });

    if (dbProjects.length !== projectIds.length) {
      return res.status(400).json({ error: "One or more projects not found." });
    }

    // 3. Build context for LLM
    const intentMap = new Map(body.projects.map((p) => [p.projectId, p.intent.trim()]));
    const projectContexts: ProjectContext[] = dbProjects.map((p) => ({
      name: p.name,
      userIntent: intentMap.get(p.id) ?? "",
      repoDescription: p.repoDescription,
      readmeExcerpt: p.readmeExcerpt,
      techStack: p.techStack,
      domain: p.domain,
      stars: p.stars,
      forks: p.forks,
      collaborators: p.collaborators,
      modules: [],      // Could be enriched from analysis if stored
      features: [],     // Could be enriched from analysis if stored
      architectureStyle: "modular",
      baseBullets: p.baseBullets as string[],
    }));

    // 4. SINGLE LLM CALL for all projects
    const enriched = await enrichAllProjects(projectContexts);

    // 5. Build enrichment lookup by name
    const enrichmentByName = new Map<string, EnrichedProject>();
    if (enriched) {
      for (const e of enriched) {
        enrichmentByName.set(e.name.toLowerCase(), e);
      }
    }

    // 6. Finalize each project (merge AI + baseBullets)
    const results: Array<{ projectId: string; finalBullets: string[] }> = [];

    for (const dbProj of dbProjects) {
      const intent = intentMap.get(dbProj.id) ?? "";
      const aiMatch = enrichmentByName.get(dbProj.name.toLowerCase());

      const finalBullets = await finalizeProjectWithAI(
        dbProj.id,
        req.userId,
        intent,
        aiMatch?.bulletPoints ?? null,
        aiMatch
          ? {
              description: aiMatch.description,
              skills: aiMatch.skills,
              complexity: aiMatch.complexity,
              uniqueAngle: aiMatch.uniqueAngle,
            }
          : undefined,
      );

      results.push({ projectId: dbProj.id, finalBullets });
    }

    // 7. Mark quiz complete
    await prisma.userAuth.update({
      where: { id: req.userId },
      data: { onboardingQuizCompletedAt: new Date() },
    });

    // 8. Regenerate user summary
    await regenerateUserSummaryForUser(req.userId);

    return res.status(200).json({
      success: true,
      aiEnriched: enriched !== null,
      projects: results,
    });
  } catch (error) {
    console.error("[Projects] Batch finalize failed:", error);
    const msg = (error as Error).message ?? "";
    if (msg.includes("not found") || msg.includes("access denied")) {
      return res.status(404).json({ error: msg });
    }
    return res.status(500).json({ error: "Failed to finalize projects." });
  }
}

// ─── POST /api/projects/:id/update-impact ────────────────────
//
// Resume Studio: update impact metrics and contribution area for a single project.
// Optionally regenerates bullets with impact context.
//
// Body: { impactEntries?: ImpactEntry[], contributionArea?: string, extraNotes?: string }

export async function updateProjectImpact(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const projectId = req.params.id as string;
  if (!projectId) {
    return res.status(400).json({ error: "Missing project ID." });
  }

  const { impactEntries, contributionArea, extraNotes } = req.body as {
    impactEntries?: unknown[];
    contributionArea?: string;
    extraNotes?: string;
  };

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project || project.userId !== req.userId) {
      return res.status(404).json({ error: "Project not found." });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        impactEntries: impactEntries ? (impactEntries as object[]) : undefined,
        contributionArea: contributionArea ?? undefined,
        quizExtraNotes: extraNotes ?? undefined,
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Projects] Impact update failed:", error);
    return res.status(500).json({ error: "Failed to update project impact." });
  }
}
