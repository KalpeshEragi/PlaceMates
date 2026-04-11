/**
 * quizFinalizer.ts
 *
 * Simplified finalizer for the new single-page quiz + AI enrichment flow.
 *
 * Two paths:
 *   1. AI path: LLM returned enriched bullets → use them (bullet 1 = intent)
 *   2. Offline path: LLM failed → fall back to baseBullets (bullet 1 = intent)
 *
 * Impact/contribution editing now happens in Resume Studio, not here.
 */

import { prisma } from "../../lib/prisma";

/**
 * Format the user's project intent into a professional opening bullet.
 */
function formatIntentBullet(intent: string, projectName: string, techStack: string[]): string {
  const t = techStack.slice(0, 3).join(", ") || "modern technologies";
  const trimmed = intent.trim().replace(/\s+/g, " ");
  const first =
    trimmed.length > 0 ? trimmed[0].toUpperCase() + trimmed.slice(1) : projectName;
  return `Delivered ${first} — ${projectName} using ${t} for production-ready delivery.`;
}

/**
 * Pad with baseBullets if we don't have enough tail bullets.
 */
function padTailFromBase(
  projectName: string,
  techStack: string[],
  baseTail: string[],
): string[] {
  const t0 = techStack[0] ?? "TypeScript";
  const t1 = techStack[1] ?? t0;
  const pool = [
    ...baseTail,
    `Engineered core features for ${projectName} with ${t0} and ${t1}, focusing on reliability and maintainability.`,
    `Implemented scalable modules in ${projectName} using ${t0} with clear structure and test-friendly boundaries.`,
    `Strengthened ${projectName} quality by hardening integrations and refining the ${t0} implementation.`,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of pool) {
    if (out.length >= 3) break;
    if (!seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
  }
  return out.slice(0, 3);
}

/**
 * Finalize a project's bullets using AI-enriched bullets or offline fallback.
 *
 * @param projectId - Project UUID
 * @param userId - User UUID
 * @param intent - User's one-line description (2-8 words)
 * @param aiBullets - AI-generated bullets (null if LLM failed)
 * @param aiMeta - Optional AI metadata to store
 */
export async function finalizeProjectWithAI(
  projectId: string,
  userId: string,
  intent: string,
  aiBullets: string[] | null,
  aiMeta?: {
    description?: string;
    skills?: string[];
    complexity?: string;
    uniqueAngle?: string;
  },
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.userId !== userId) {
    throw new Error("Project not found or access denied.");
  }

  const trimmedIntent = intent.trim();
  if (trimmedIntent.split(/\s+/).filter(Boolean).length < 2) {
    throw new Error("Project intent must be at least 2 words.");
  }

  // Build fallback description from intent (if AI fails or AI desc is empty)
  const intentBullet = formatIntentBullet(trimmedIntent, project.name, project.techStack);

  let finalBullets: string[];

  if (aiBullets && aiBullets.length > 0) {
    // AI path: use all LLM-generated bullets
    finalBullets = aiBullets.slice(0, 4);
  } else {
    // Offline fallback: use baseBullets
    const base = (project.baseBullets as string[]) ?? [];
    if (base.length >= 4) {
      finalBullets = base.slice(0, 4);
    } else {
      const tail = padTailFromBase(project.name, project.techStack, base);
      finalBullets = tail.slice(0, 4);
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    projectIntent: trimmedIntent,
    finalBullets,
    // Description prioritizes AI description, falls back to intent-formatted string
    description: aiMeta?.description || intentBullet,
    updatedAt: new Date(),
  };

  // Store AI metadata if available
  if (aiMeta) {
    if (aiMeta.description) updateData.aiDescription = aiMeta.description;
    if (aiMeta.skills) updateData.aiSkills = aiMeta.skills;
    if (aiMeta.complexity) updateData.aiComplexity = aiMeta.complexity;
    if (aiMeta.uniqueAngle) updateData.aiUniqueAngle = aiMeta.uniqueAngle;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: updateData,
  });

  return finalBullets;
}
