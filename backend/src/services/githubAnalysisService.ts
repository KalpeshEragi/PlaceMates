/**
 * githubAnalysisService.ts
 *
 * Fully offline GitHub analysis pipeline. No external AI APIs.
 *
 * Pipeline:
 *   GitHub API → score all repos → top 5
 *     → per repo: languages + contributors + readme + user commits
 *       → readmeAnalyzer   (rule-based README extraction)
 *       → commitAnalyzer   (commit pattern + feature detection)
 *       → fileAnalyzer     (module + feature detection from paths)
 *       → domainDetector   (multi-signal domain inference)
 *         → ProjectInsight
 *           → generateCandidates() [templateEngine]
 *             → rankAndSelect()    [rankingEngine]
 *               → baseBullets
 *                 → upsert Project
 *                   → upsert Skills
 *                     → generateUserSummary [summaryGenerator — offline]
 *                       → upsert UserSummary
 */

import { prisma } from "../lib/prisma";
import {
  classifyProjectType,
  fetchAllGithubRepos,
  fetchCommitDetail,
  fetchRepoCommits,
  fetchRepoContributors,
  fetchRepoLanguages,
  fetchRepoReadme,
  selectTopRepos,
  type GitHubCommitDetail,
  type GitHubRepoAPI,
} from "./githubService";

// ── Offline analysis layer ────────────────────
import { analyzeReadme }           from "./analysis/readmeAnalyzer";
import { analyzeCommits }          from "./analysis/commitAnalyzer";
import { analyzeFiles }            from "./analysis/fileAnalyzer";
import { extractFeatureConfidence } from "./analysis/featureExtractor";
import { inferDomain, inferSkillDomain } from "./analysis/domainDetector";
import { generateProjectBullets }  from "./generator/bulletGenerator";
import { generateUserSummary }     from "./summary/summaryGenerator";

import type {
  RepoAnalysis,
  TemplateEngineInput,
} from "./types/index";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COLLAB_COMMIT_LIMIT = 15;
const TOP_REPOS_COUNT = 10;

// ─────────────────────────────────────────────
// URL helpers
// ─────────────────────────────────────────────

function parseOwnerAndName(
  repoUrl: string,
): { owner: string; name: string } | null {
  try {
    const url  = new URL(repoUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], name: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Stack helpers
// ─────────────────────────────────────────────

function languagesToStack(languages: Record<string, number>): string[] {
  return Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .map(([lang]) => lang);
}

function collectFilesFromCommits(details: GitHubCommitDetail[]): string[] {
  const files = new Set<string>();
  for (const d of details) {
    for (const f of d.files ?? []) files.add(f.filename);
  }
  return [...files];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function recencyScore(updatedAt: string): number {
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();
  const days = Math.max(0, (now - updated) / (1000 * 60 * 60 * 24));
  // 100 if updated now, 0 after ~365 days.
  return clamp(100 - (days / 365) * 100);
}

function safeLogScale(value: number, multiplier = 20): number {
  return clamp(Math.log10(value + 1) * multiplier);
}

function inferFullStackBonus(techStack: string[]): number {
  const lower = techStack.map((t) => t.toLowerCase());
  const frontendSignals = ["react", "vue", "angular", "next.js", "html", "css"];
  const backendSignals = ["node.js", "express", "fastapi", "django", "spring", "postgresql", "mysql", "mongodb"];
  const hasFrontend = lower.some((tech) =>
    frontendSignals.some((signal) => tech.includes(signal)),
  );
  const hasBackend = lower.some((tech) =>
    backendSignals.some((signal) => tech.includes(signal)),
  );
  return hasFrontend && hasBackend ? 25 : 0;
}

function inferDatabaseSignal(
  modules: string[],
  contributionFiles: string[],
  readmeSummary: string | null,
): number {
  const fromModules = modules.some((m) => m.toLowerCase().includes("database")) ? 20 : 0;
  const fromFiles = contributionFiles.some((file) =>
    /(prisma|schema|migration|sql|mongo|postgres|mysql|redis)/i.test(file),
  )
    ? 20
    : 0;
  const fromReadme = readmeSummary && /\b(database|sql|postgres|mysql|mongodb|redis|prisma)\b/i.test(readmeSummary)
    ? 15
    : 0;
  return clamp(fromModules + fromFiles + fromReadme, 0, 30);
}

function computeRepositoryScore(input: {
  commitCount: number;
  updatedAt: string;
  stars: number;
  forks: number;
  hasReadme: boolean;
  readmeLength: number;
  languageCount: number;
  fullStackBonus: number;
  databaseSignal: number;
  featureCount: number;
  userContributionAreas: number;
  projectType: "solo" | "collaborative";
}): number {
  const commitScore = clamp(input.commitCount * 6);
  const recentScore = recencyScore(input.updatedAt);
  const qualityScore =
    safeLogScale(input.stars, 25) +
    safeLogScale(input.forks, 20) +
    (input.hasReadme ? 20 : 0) +
    clamp(input.readmeLength / 80, 0, 15);
  const complexityScore =
    clamp(input.languageCount * 12, 0, 35) +
    input.fullStackBonus +
    input.databaseSignal;
  const featureScore = clamp(input.featureCount * 12, 0, 100);
  const contributionScore =
    input.projectType === "collaborative"
      ? clamp(input.commitCount * 5 + input.userContributionAreas * 12, 0, 100)
      : clamp(input.commitCount * 5, 0, 100);

  const finalScore =
    commitScore * 0.3 +
    qualityScore * 0.2 +
    featureScore * 0.2 +
    (input.hasReadme ? 100 : 0) * 0.1 +
    recentScore * 0.1 +
    complexityScore * 0.1 +
    contributionScore * 0.1;

  return Number(finalScore.toFixed(2));
}

function isMeaningfulRepository(input: {
  repo: GitHubRepoAPI;
  hasReadme: boolean;
  languageCount: number;
  commitCount: number;
  featureCount: number;
  moduleCount: number;
  projectType: "solo" | "collaborative";
}): boolean {
  const isEmpty = input.repo.size <= 0 && input.languageCount === 0 && !input.hasReadme && input.commitCount === 0;
  if (isEmpty) return false;

  const isForkWithoutContribution = Boolean(input.repo.fork) && input.commitCount === 0;
  if (isForkWithoutContribution) return false;

  const noMeaningfulData =
    input.languageCount === 0 &&
    input.commitCount === 0 &&
    input.featureCount === 0 &&
    input.moduleCount === 0 &&
    !input.hasReadme;
  if (noMeaningfulData) return false;

  // For collaborative repos, ensure user actually contributed.
  if (input.projectType === "collaborative" && input.commitCount === 0) return false;

  return true;
}

// ─────────────────────────────────────────────
// Safe commit fetching (handles 409 and other errors)
// ─────────────────────────────────────────────

async function safelyFetchCommits(
  owner: string,
  name: string,
  token: string,
  githubLogin: string,
  limit: number,
): Promise<any[]> {
  try {
    return await fetchRepoCommits(owner, name, token, githubLogin, limit);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 409) {
      // 409 = empty repo or Git repository conflicts — skip gracefully
      console.warn(`[GitHub Analysis] Skipping commits for ${owner}/${name}: 409 (empty/conflict)`);
      return [];
    }
    if (status === 404) {
      console.warn(`[GitHub Analysis] Skipping commits for ${owner}/${name}: 404 (not found)`);
      return [];
    }
    // For other errors, log and return empty rather than crashing
    console.warn(`[GitHub Analysis] Error fetching commits for ${owner}/${name}:`, err?.message);
    return [];
  }
}

async function safelyFetchCommitDetail(
  owner: string,
  name: string,
  sha: string,
  token: string,
): Promise<GitHubCommitDetail | null> {
  try {
    return await fetchCommitDetail(owner, name, sha, token);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 409 || status === 404 || status === 422) {
      return null; // skip silently
    }
    console.warn(`[GitHub Analysis] Error fetching commit ${sha.slice(0, 7)}:`, err?.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// Per-repo analysis  (fully offline)
// ─────────────────────────────────────────────

async function analyzeRepo(
  repo: GitHubRepoAPI,
  token: string,
  githubLogin: string,
): Promise<RepoAnalysis | null> {
  const parsed = parseOwnerAndName(repo.html_url);
  if (!parsed) return null;
  const { owner, name } = parsed;

  // ── Fetch GitHub data in parallel ────────────
  const [languagesRaw, contributors, readmeRaw] = await Promise.all([
    fetchRepoLanguages(owner, name, token).catch(() => ({} as Record<string, number>)),
    fetchRepoContributors(owner, name, token).catch(() => []),
    fetchRepoReadme(owner, name, token).catch(() => null),
  ]);

  const { type: projectType, collaboratorCount } =
    classifyProjectType(contributors, githubLogin);
  const techStack = languagesToStack(languagesRaw);

  // ── Offline README analysis (enhanced) ──────
  const readmeResult = analyzeReadme(readmeRaw);

  // ── User commits (with 409 safe handling) ────
  const userCommits = await safelyFetchCommits(
    owner, name, token, githubLogin, COLLAB_COMMIT_LIMIT,
  );
  const commitMessages = userCommits.map((c: any) => c.commit.message.split("\n")[0]);

  // ── Commit details for file analysis (safe) ──
  const commitDetails = (
    await Promise.all(
      userCommits
        .slice(0, COLLAB_COMMIT_LIMIT)
        .map((c: any) => safelyFetchCommitDetail(owner, name, c.sha, token)),
    )
  ).filter((d): d is GitHubCommitDetail => d !== null);

  const contributionFiles = collectFilesFromCommits(commitDetails);

  // ── Commit analysis (enhanced) ───────────────
  const commitResult = analyzeCommits(commitMessages);

  // ── File analysis (enhanced with arch style) ──
  const fileResult = analyzeFiles(
    projectType === "solo" ? contributionFiles : contributionFiles,
  );

  // ── Domain inference (multi-signal) ──────────
  const mergedTechStack = Array.from(new Set([...techStack, ...readmeResult.mentionedTech]));
  const domain = inferDomain({
    techStack: mergedTechStack,
    languages: Object.keys(languagesRaw),
    modules:   fileResult.modules,
    readmeDomain: readmeResult.domain,
  });

  // ── Merge detected features from all sources ──
  const featureConfidence = extractFeatureConfidence({
    readmeFeatures: readmeResult.extractedFeatures,
    fileFeatures: fileResult.detectedFeatures,
    commitFeatures: commitResult.detectedFeatures,
    minConfidence: 0.6,
  });
  const detectedFeatures = featureConfidence.map((f) => f.name);

  const rankingScore = computeRepositoryScore({
    commitCount: userCommits.length,
    updatedAt: repo.updated_at,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    hasReadme: Boolean(readmeRaw && readmeRaw.trim().length > 0),
    readmeLength: (readmeRaw ?? "").length,
    languageCount: Object.keys(languagesRaw).length,
    fullStackBonus: inferFullStackBonus(techStack),
    databaseSignal: inferDatabaseSignal(
      fileResult.modules,
      contributionFiles,
      readmeResult.summary,
    ),
    featureCount: detectedFeatures.length,
    userContributionAreas: fileResult.modules.length,
    projectType,
  });

  const isMeaningful = isMeaningfulRepository({
    repo,
    hasReadme: Boolean(readmeRaw && readmeRaw.trim().length > 0),
    languageCount: Object.keys(languagesRaw).length,
    commitCount: userCommits.length,
    featureCount: detectedFeatures.length,
    moduleCount: fileResult.modules.length,
    projectType,
  });
  if (!isMeaningful) return null;

  // ── Capture first 15 lines of raw README for AI context ──
  const readmeExcerptRaw = readmeRaw
    ? readmeRaw.split('\n').slice(0, 15).join('\n')
    : null;

  return {
    projectType,
    collaboratorCount,
    techStack: mergedTechStack,
    modules:              fileResult.modules,
    domain,
    readmeSummary:        readmeResult.summary,
    commitMessages,
    contributionFiles,
    detectedFeatures,
    featureConfidence,
    commitTypes:          commitResult.commitTypes,
    contributionNarrative: commitResult.contributionNarrative,
    readmeFeatures:       readmeResult.extractedFeatures,
    readmeMentionedTech:  readmeResult.mentionedTech,
    architectureStyle:    fileResult.architectureStyle,
    rankingScore,
    readmeExcerptRaw,
  };
}

// ─────────────────────────────────────────────
// Skill persistence
// ─────────────────────────────────────────────

async function persistGithubSkills(
  userId: string,
  allTechStacks: string[][],
): Promise<void> {
  const skillSet = new Set<string>();
  for (const stack of allTechStacks) {
    for (const skill of stack) skillSet.add(skill);
  }

  for (const name of skillSet) {
    const domain = inferSkillDomain(name);
    await prisma.skill.upsert({
      where:  { userId_name: { userId, name } },
      create: { userId, name, domain, source: "github" },
      update: { source: "both", domain },
    });
  }
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export async function processUserGithubRepositories(
  userId: string,
): Promise<void> {
  const userRow = await prisma.userAuth.findUnique({
    where:  { id: userId },
    select: {
      githubAccessToken: true,
      githubConnected:   true,
      githubLogin:       true,
    },
  });

  if (!userRow?.githubAccessToken || !userRow.githubConnected) {
    throw new Error("GitHub is not connected for this user.");
  }
  if (!userRow.githubLogin) {
    throw new Error("githubLogin is missing — call syncUserGithubRepos first.");
  }

  const token       = userRow.githubAccessToken;
  const githubLogin = userRow.githubLogin;

  const allRepos = await fetchAllGithubRepos(token);
  if (!allRepos.length) return;

  const allTechStacks: string[][] = [];
  const analyzedRepos: Array<{
    repo: GitHubRepoAPI;
    analysis: RepoAnalysis;
  }> = [];

  // Sequential to respect GitHub secondary rate limits
  for (const repo of allRepos) {
    try {
      const analysis = await analyzeRepo(repo, token, githubLogin);
      if (!analysis) continue;
      analyzedRepos.push({ repo, analysis });
    } catch (err) {
      console.error(`[GitHub Analysis] Failed on ${repo.html_url}:`, err);
    }
  }

  if (!analyzedRepos.length) return;

  const scoreByRepoId = new Map<number, number>();
  for (const row of analyzedRepos) {
    scoreByRepoId.set(row.repo.id, row.analysis.rankingScore);
  }

  const topRepos = selectTopRepos(
    analyzedRepos.map((row) => row.repo),
    scoreByRepoId,
    TOP_REPOS_COUNT,
  );
  const topRepoUrlSet = new Set(topRepos.map((r) => r.html_url));
  const topAnalyzed = analyzedRepos
    .filter((row) => topRepoUrlSet.has(row.repo.html_url))
    .sort((a, b) => b.analysis.rankingScore - a.analysis.rankingScore);

  for (const row of topAnalyzed) {
    const repo = row.repo;
    const analysis = row.analysis;
    try {

      // ── Build TemplateEngineInput (enhanced) ───
      const engineInput: TemplateEngineInput & {
        contributionNarrative: string[];
        readmeFeatures: string[];
        readmeMentionedTech: string[];
        architectureStyle: string;
        featureConfidence: typeof analysis.featureConfidence;
      } = {
        projectName:          repo.name,
        projectType:          analysis.projectType,
        techStack:            analysis.techStack,
        modules:              analysis.modules,
        domain:               analysis.domain,
        readmeSummary:        analysis.readmeSummary,
        commitMessages:       analysis.commitMessages,
        contributionFiles:    analysis.contributionFiles,
        collaborators:        analysis.collaboratorCount,
        detectedFeatures:     analysis.detectedFeatures,
        commitTypes:          analysis.commitTypes,
        // Enhanced fields
        contributionNarrative: analysis.contributionNarrative,
        readmeFeatures:       analysis.readmeFeatures,
        readmeMentionedTech:  analysis.readmeMentionedTech,
        architectureStyle:    analysis.architectureStyle,
        featureConfidence:    analysis.featureConfidence,
      };

      // ── Offline bullet generation (enhanced) ──
      const baseBullets = generateProjectBullets(engineInput);

      // ── Upsert Project — never overwrite user-edited data ──
      const existing = await prisma.project.findUnique({
        where:  { userId_repoUrl: { userId, repoUrl: repo.html_url } },
        select: { finalBullets: true, description: true },
      });

      await prisma.project.upsert({
        where:  { userId_repoUrl: { userId, repoUrl: repo.html_url } },
        create: {
          userId,
          name:          repo.name,
          repoUrl:       repo.html_url,
          domain:        analysis.domain,
          projectType:   analysis.projectType,
          collaborators: analysis.collaboratorCount,
          techStack:     analysis.techStack,
          rankingScore:  analysis.rankingScore,
          baseBullets,
          finalBullets:  [],
          description:   null,
          // GitHub metadata for AI enrichment
          stars:           repo.stargazers_count,
          forks:           repo.forks_count,
          repoDescription: repo.description,
          readmeExcerpt:   analysis.readmeExcerptRaw,
          lastPushedAt:    repo.pushed_at ? new Date(repo.pushed_at) : null,
          repoSize:        repo.size,
        },
        update: {
          name:          repo.name,
          domain:        analysis.domain,
          projectType:   analysis.projectType,
          collaborators: analysis.collaboratorCount,
          techStack:     analysis.techStack,
          rankingScore:  analysis.rankingScore,
          baseBullets,
          // Preserve any user-edited final bullets / description
          finalBullets:  existing?.finalBullets ?? [],
          description:   existing?.description  ?? null,
          // GitHub metadata for AI enrichment
          stars:           repo.stargazers_count,
          forks:           repo.forks_count,
          repoDescription: repo.description,
          readmeExcerpt:   analysis.readmeExcerptRaw,
          lastPushedAt:    repo.pushed_at ? new Date(repo.pushed_at) : null,
          repoSize:        repo.size,
        },
      });

      allTechStacks.push(analysis.techStack);
    } catch (err) {
      console.error(`[GitHub Analysis] Failed on ${repo.html_url}:`, err);
    }
  }

  await persistGithubSkills(userId, allTechStacks);
  await persistUserSummary(userId);
}

// ─────────────────────────────────────────────
// Offline user summary
// ─────────────────────────────────────────────

async function persistUserSummary(userId: string): Promise<void> {
  const userRow = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: { selectedProjectIds: true },
  });

  let projects: {
    name: string;
    domain: string | null;
    techStack: string[];
    baseBullets: string[];
    finalBullets: string[];
  }[];

  const selected = userRow?.selectedProjectIds ?? [];
  if (selected.length > 0) {
    const found = await prisma.project.findMany({
      where: { userId, id: { in: selected } },
      select: {
        id: true,
        name: true,
        domain: true,
        techStack: true,
        baseBullets: true,
        finalBullets: true,
      },
    });
    const order = new Map(selected.map((id, i) => [id, i]));
    projects = found
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(({ id: _id, ...rest }) => rest);
  } else {
    projects = await prisma.project.findMany({
      where: { userId },
      orderBy: [{ rankingScore: "desc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        name: true,
        domain: true,
        techStack: true,
        baseBullets: true,
        finalBullets: true,
      },
    });
  }

  const skills = await prisma.skill.findMany({
    where:  { userId },
    select: { name: true, domain: true },
  });

  // Aggregate domain counts
  const domainCount = new Map<string, number>();
  for (const p of projects) {
    if (p.domain) domainCount.set(p.domain, (domainCount.get(p.domain) ?? 0) + 1);
  }

  const topDomains = [...domainCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d);

  const primaryDomain = topDomains[0] ?? null;

  // ── Fully offline summary generation ─────────
  const summaryText = generateUserSummary({
    topProjects: projects.map((p) => ({
      name:      p.name,
      domain:    p.domain,
      techStack: p.techStack,
      bullets:   p.finalBullets.length > 0 ? p.finalBullets : p.baseBullets,
    })),
    topSkills:     skills.map((s) => s.name).slice(0, 12),
    topDomains,
    primaryDomain,
  });

  await prisma.userSummary.upsert({
    where:  { userId },
    create: { userId, summaryText, primaryDomain },
    update: { summaryText, primaryDomain },
  });
}

/** Re-run summary generation after quiz updates (selected projects + final bullets). */
export async function regenerateUserSummaryForUser(userId: string): Promise<void> {
  await persistUserSummary(userId);
}