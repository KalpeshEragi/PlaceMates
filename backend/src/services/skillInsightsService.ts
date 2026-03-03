import { prisma } from "../lib/prisma";

export interface RepoSkillInput {
  repoId: string;
  userId: string;
  skills: string[];
  projectFinalScore: number; // 0-100
}

export async function aggregateSkillsForUser(
  userId: string,
  repoSkills: RepoSkillInput[],
): Promise<void> {
  const strengthBySkill = new Map<string, number>();

  for (const entry of repoSkills) {
    const weight = entry.projectFinalScore / 100;
    for (const raw of entry.skills) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      const current = strengthBySkill.get(key) ?? 0;
      strengthBySkill.set(key, current + 1 + weight);
    }
  }

  const now = new Date();
  const ops: Promise<unknown>[] = [];

  for (const [key, strength] of strengthBySkill.entries()) {
    const displayName = key
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    ops.push(
      prisma.userSkillInsight.upsert({
        where: {
          userId_skillName: {
            userId,
            skillName: displayName,
          },
        },
        create: {
          userId,
          skillName: displayName,
          strengthScore: strength,
          source: "github",
          createdAt: now,
        },
        update: {
          strengthScore: {
            increment: strength,
          },
        },
      }) as any,
    );
  }

  if (ops.length) {
    await prisma.$transaction(ops);
  }
}

