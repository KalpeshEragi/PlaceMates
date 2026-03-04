import fs from "fs";
import os from "os";
import path from "path";
import simpleGit from "simple-git";
import { prisma } from "../lib/prisma";
import { calculateRepositoryLoc } from "../utils/locCalculator";
import { analyzeReadme } from "./geminiService";
import { computeProjectScore } from "./scoringService";
import { aggregateSkillsForUser, type RepoSkillInput } from "./skillInsightsService";

const MAX_REPO_SIZE_KB = 200 * 1024; // 200 MB

async function getUserGithubAccessToken(userId: string): Promise<string> {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: { githubAccessToken: true, githubConnected: true },
  });

  if (!user || !user.githubAccessToken || !user.githubConnected) {
    throw new Error("GitHub is not connected for this user.");
  }

  return user.githubAccessToken;
}

function parseOwnerAndName(repoUrl: string): { owner: string; name: string } | null {
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const name = parts[1].replace(/\.git$/, "");
    return { owner, name };
  } catch {
    return null;
  }
}

async function cloneRepoToTemp(
  userId: string,
  repoUrl: string,
  token: string,
): Promise<string | null> {
  const parsed = parseOwnerAndName(repoUrl);
  if (!parsed) return null;

  const { owner, name } = parsed;
  const baseTmp = path.join(os.tmpdir(), "placemates-temp", userId);
  await fs.promises.mkdir(baseTmp, { recursive: true });

  const dest = path.join(baseTmp, name);
  await fs.promises.rm(dest, { recursive: true, force: true }).catch(() => { });
  await fs.promises.mkdir(dest, { recursive: true });

  const git = simpleGit();

  const cloneUrl = `https://${encodeURIComponent("x-access-token")}:${encodeURIComponent(
    token,
  )}@github.com/${owner}/${name}.git`;

  await git.clone(cloneUrl, dest, ["--depth", "1"]);

  return dest;
}

function findReadme(rootDir: string): string | null {
  const candidates = ["README.md", "Readme.md", "readme.md"];
  for (const c of candidates) {
    const p = path.join(rootDir, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function computeDashboardInsights(userId: string): Promise<void> {
  const repos = await prisma.githubRepository.findMany({
    where: { userId, finalScore: { not: null } },
    orderBy: { finalScore: "desc" },
  });

  const topProjects = repos.slice(0, 10).map((r) => ({
    id: r.id,
    name: r.name,
    repoUrl: r.repoUrl,
    finalScore: r.finalScore,
    stars: r.stars,
    forks: r.forks,
    detectedDomain: r.detectedDomain,
    totalLoc: r.totalLoc,
  }));

  const skills = await prisma.userSkillInsight.findMany({
    where: { userId },
    orderBy: { strengthScore: "desc" },
    take: 50,
  });

  const topSkills = skills.slice(0, 10).map((s) => ({
    skillName: s.skillName,
    strengthScore: s.strengthScore,
    source: s.source,
  }));

  const domainCount = new Map<string, number>();
  for (const r of repos) {
    if (!r.detectedDomain) continue;
    const key = r.detectedDomain;
    domainCount.set(key, (domainCount.get(key) ?? 0) + 1);
  }

  const topDomains = Array.from(domainCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));

  const now = new Date();

  await prisma.userDashboardInsight.upsert({
    where: { userId },
    create: {
      userId,
      topProjects,
      topSkills,
      topDomains,
      lastComputedAt: now,
    },
    update: {
      topProjects,
      topSkills,
      topDomains,
      lastComputedAt: now,
    },
  });
}

export async function processUserGithubRepositories(userId: string): Promise<void> {



  const token = await getUserGithubAccessToken(userId);

  const repos = await prisma.githubRepository.findMany({
    where: { userId },
  });

  const skillInputs: RepoSkillInput[] = [];

  for (const repo of repos) {
    if (repo.size && repo.size > MAX_REPO_SIZE_KB) {
      console.warn(`Skipping large repo ${repo.repoUrl} (${repo.size} KB)`);
      continue;
    }

    let tmpDir: string | null = null;

    try {
      tmpDir = await cloneRepoToTemp(userId, repo.repoUrl, token);
      if (!tmpDir) continue;

      const { totalLoc, locByLanguage } = await calculateRepositoryLoc(tmpDir);

      const readmePath = findReadme(tmpDir);
      let readmeAnalysis = null;
      let readmeSummary: string | null = null;
      let detectedDomain: string | null = null;
      let resumeScore: number | null = null;
      let impactScore: number | null = null;

      if (readmePath) {
        const content = await fs.promises.readFile(readmePath, "utf8");
        readmeAnalysis = await analyzeReadme(content);

        if (readmeAnalysis) {
          readmeSummary = readmeAnalysis.projectSummary;
          detectedDomain = readmeAnalysis.domain;
          resumeScore = readmeAnalysis.resumeScore;
          impactScore = readmeAnalysis.impactScore;

          skillInputs.push({
            repoId: repo.id,
            userId,
            skills: readmeAnalysis.suggestedSkills,
            projectFinalScore: 0,
          });
        }
      }

      const scoreComponents = computeProjectScore({
        totalLoc,
        stars: repo.stars,
        forks: repo.forks,
        readmeAnalysis,
      });

      for (const s of skillInputs) {
        if (s.repoId === repo.id) {
          s.projectFinalScore = scoreComponents.finalScore;
        }
      }

      await prisma.githubRepository.update({
        where: { id: repo.id },
        data: {
          totalLoc,
          locByLanguage,
          readmeSummary,
          detectedDomain,
          resumeScore,
          impactScore,
          finalScore: scoreComponents.finalScore,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`Error processing repo ${repo.repoUrl}`, err);
    } finally {
      if (tmpDir) {
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
      }
    }
  }

  await aggregateSkillsForUser(userId, skillInputs);
  await computeDashboardInsights(userId);
}

