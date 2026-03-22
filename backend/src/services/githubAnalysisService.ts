/**
 * githubAnalysisService.ts
 *
 * Pipeline:
 *   GitHub API → top 15 repos by score
 *     → per repo: languages + contributors + readme + user commits
 *       → classify solo | collaborative
 *         → infer tech stack, modules, domain
 *           → generate AI bullets (bulletGeneratorService)
 *             → upsert Project row
 *               → upsert Skill rows (source = "github")
 *                 → upsert UserSummary
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
  type ProjectType,
} from "./githubService";
import { generateProjectBullets, generateUserSummary } from "./BulletGeneratorService";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COLLAB_COMMIT_LIMIT = 15;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type RepoAnalysis = {
  repo: GitHubRepoAPI;
  projectType: ProjectType;
  collaboratorCount: number;
  techStack: string[];
  modules: string[];
  domain: string | null;
  readmeSummary: string | null;
  commitMessages: string[];
  contributionFiles: string[];
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseOwnerAndName(repoUrl: string): { owner: string; name: string } | null {
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], name: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

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
  return Array.from(files);
}

/**
 * Infer module areas from filenames (e.g. src/auth → "Auth").
 */
function inferModules(files: string[]): string[] {
  const rules: [RegExp, string][] = [
    [/auth|login|session|jwt|oauth/i, "Auth"],
    [/api|route|controller|handler/i, "API"],
    [/component|view|page|ui|frontend/i, "UI"],
    [/db|database|migration|model|schema|prisma/i, "Database"],
    [/test|spec|__test__|e2e/i, "Testing"],
    [/docker|ci|github\/workflows|deploy|infra/i, "DevOps"],
    [/worker|queue|job|cron/i, "Background Jobs"],
    [/socket|websocket|realtime/i, "Realtime"],
    [/ml|model|train|infer|predict/i, "ML/AI"],
  ];
  const found = new Set<string>();
  for (const file of files) {
    for (const [pattern, label] of rules) {
      if (pattern.test(file)) found.add(label);
    }
  }
  return Array.from(found);
}

/**
 * Infer project domain from tech stack using keyword matching.
 * Returns the most confident match or null.
 */
function inferDomainFromStack(techStack: string[]): string | null {
  const joined = techStack.join(" ").toLowerCase();
  if (/react|vue|next|angular|svelte|html|css|tailwind/.test(joined)) return "Frontend";
  if (/node|express|django|flask|spring|fastapi|rails|graphql/.test(joined)) return "Backend";
  if (/tensorflow|pytorch|keras|scikit|pandas|numpy|ml/.test(joined)) return "ML";
  if (/docker|kubernetes|terraform|ansible|aws|gcp|azure/.test(joined)) return "DevOps";
  if (/swift|kotlin|flutter|react.native|android|ios/.test(joined)) return "Mobile";
  return null;
}

// ─────────────────────────────────────────────
// Inline README summarisation (replaces deleted geminiService)
// ─────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const AI_MODEL = "claude-sonnet-4-20250514";

async function summariseReadme(
  readme: string,
): Promise<{ summary: string; domain: string | null } | null> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1000,
        system: [
          "You are a technical project analyst.",
          "Given a README, return ONLY a JSON object with two fields:",
          '  "summary": a 1-2 sentence plain-English description of what the project does',
          '  "domain": one of Frontend | Backend | ML | DevOps | Mobile | Other',
          "No markdown. No extra keys.",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: readme.slice(0, 3000),
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content: { type: string; text?: string }[];
    };

    const raw = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");

    const parsed = JSON.parse(raw);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
      domain: typeof parsed.domain === "string" ? parsed.domain : null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Skill domain inference + normalization
// ─────────────────────────────────────────────

function inferSkillDomain(name: string): string {
  const lower = name.toLowerCase();
  if (/react|vue|next|angular|html|css|tailwind|svelte/.test(lower)) return "Frontend";
  if (/node|express|django|flask|spring|fastapi|graphql|rails/.test(lower)) return "Backend";
  if (/python|tensorflow|pytorch|keras|scikit|pandas|numpy|ml/.test(lower)) return "ML";
  if (/docker|kubernetes|aws|azure|gcp|terraform|devops|linux/.test(lower)) return "DevOps";
  if (/swift|kotlin|flutter|android|ios|mobile/.test(lower)) return "Mobile";
  if (/postgres|mysql|mongodb|redis|sql|database|prisma|firebase/.test(lower)) return "Backend";
  return "Other";
}

// ─────────────────────────────────────────────
// Per-repo analysis
// ─────────────────────────────────────────────

async function analyzeRepo(
  repo: GitHubRepoAPI,
  token: string,
  githubLogin: string,
): Promise<RepoAnalysis | null> {
  const parsed = parseOwnerAndName(repo.html_url);
  if (!parsed) return null;
  const { owner, name } = parsed;

  // Parallel: languages + contributors + readme
  const [languages, contributors, readmeRaw] = await Promise.all([
    fetchRepoLanguages(owner, name, token).catch(() => ({})),
    fetchRepoContributors(owner, name, token).catch(() => []),
    fetchRepoReadme(owner, name, token).catch(() => null),
  ]);

  const { type: projectType, collaboratorCount } = classifyProjectType(
    contributors,
    githubLogin,
  );
  const techStack = languagesToStack(languages);

  // README → summary + domain
  let readmeSummary: string | null = null;
  let domain: string | null = inferDomainFromStack(techStack); // fallback

  if (readmeRaw) {
    const readmeAnalysis = await summariseReadme(readmeRaw).catch(() => null);
    if (readmeAnalysis) {
      readmeSummary = readmeAnalysis.summary;
      if (readmeAnalysis.domain) domain = readmeAnalysis.domain;
    }
  }

  // User's commits + file diffs
  const userCommits = await fetchRepoCommits(
    owner,
    name,
    token,
    githubLogin,
    COLLAB_COMMIT_LIMIT,
  );
  const commitMessages = userCommits.map((c) => c.commit.message.split("\n")[0]);

  const commitDetails = (
    await Promise.all(
      userCommits
        .slice(0, COLLAB_COMMIT_LIMIT)
        .map((c) => fetchCommitDetail(owner, name, c.sha, token)),
    )
  ).filter((d): d is GitHubCommitDetail => d !== null);

  const contributionFiles = collectFilesFromCommits(commitDetails);
  const modules = projectType === "solo" ? inferModules(contributionFiles) : [];

  return {
    repo,
    projectType,
    collaboratorCount,
    techStack,
    modules,
    domain,
    readmeSummary,
    commitMessages,
    contributionFiles,
  };
}

// ─────────────────────────────────────────────
// Skill persistence
// ─────────────────────────────────────────────

async function persistGithubSkills(
  userId: string,
  allTechStacks: string[][],
): Promise<void> {
  // Flatten + deduplicate skill names across all repos
  const skillSet = new Set<string>();
  for (const stack of allTechStacks) {
    for (const skill of stack) skillSet.add(skill);
  }

  for (const name of skillSet) {
    const domain = inferSkillDomain(name);
    await prisma.skill.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, domain, source: "github" },
      update: {
        // If LinkedIn already added this skill, upgrade source to "both"
        source: "both",
        domain,
      },
    });
  }
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export async function processUserGithubRepositories(userId: string): Promise<void> {
  const userRow = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: {
      githubAccessToken: true,
      githubConnected: true,
      githubLogin: true,
    },
  });

  if (!userRow?.githubAccessToken || !userRow.githubConnected) {
    throw new Error("GitHub is not connected for this user.");
  }

  if (!userRow.githubLogin) {
    throw new Error(
      "githubLogin is missing — call syncUserGithubRepos first to resolve it.",
    );
  }

  const token = userRow.githubAccessToken;
  const githubLogin = userRow.githubLogin;

  // Fetch and score repos directly from the GitHub API
  const allRepos = await fetchAllGithubRepos(token);
  const topRepos = selectTopRepos(allRepos);

  if (!topRepos.length) return;

  const allTechStacks: string[][] = [];

  // Sequential to respect GitHub secondary rate limits
  for (const repo of topRepos) {
    try {
      const input = await analyzeRepo(repo, token, githubLogin);
      if (!input) continue;

      // Generate base bullets via AI
      const baseBullets = await generateProjectBullets({
        projectName: repo.name,
        projectType: input.projectType,
        techStack: input.techStack,
        modules: input.modules,
        domain: input.domain,
        readmeSummary: input.readmeSummary,
        commitMessages: input.commitMessages,
        contributionFiles: input.contributionFiles,
      });

      // Upsert Project — preserves finalBullets + description if quiz was already done
      const existing = await prisma.project.findUnique({
        where: { userId_repoUrl: { userId, repoUrl: repo.html_url } },
        select: { finalBullets: true, description: true },
      });

      await prisma.project.upsert({
        where: { userId_repoUrl: { userId, repoUrl: repo.html_url } },
        create: {
          userId,
          name: repo.name,
          repoUrl: repo.html_url,
          domain: input.domain,
          projectType: input.projectType,
          collaborators: input.collaboratorCount,
          techStack: input.techStack,
          baseBullets,
          finalBullets: [],
          description: null,
        },
        update: {
          name: repo.name,
          domain: input.domain,
          projectType: input.projectType,
          collaborators: input.collaboratorCount,
          techStack: input.techStack,
          baseBullets,
          // Do NOT overwrite finalBullets or description — user may have completed quiz
          finalBullets: existing?.finalBullets ?? [],
          description: existing?.description ?? null,
        },
      });

      allTechStacks.push(input.techStack);
    } catch (err) {
      console.error(`[GitHub Analysis] Failed on ${repo.html_url}:`, err);
    }
  }

  // Persist all GitHub skills at once after all repos processed
  await persistGithubSkills(userId, allTechStacks);

  // Generate + persist user summary
  await persistUserSummary(userId);
}

// ─────────────────────────────────────────────
// User summary
// ─────────────────────────────────────────────

async function persistUserSummary(userId: string): Promise<void> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      name: true,
      domain: true,
      techStack: true,
      baseBullets: true,
      finalBullets: true,
    },
  });

  const skills = await prisma.skill.findMany({
    where: { userId },
    select: { name: true, domain: true },
  });

  // Dominant domain across all projects
  const domainCount = new Map<string, number>();
  for (const p of projects) {
    if (p.domain) domainCount.set(p.domain, (domainCount.get(p.domain) ?? 0) + 1);
  }
  const primaryDomain =
    Array.from(domainCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topDomains = Array.from(domainCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d);

  const summaryText = await generateUserSummary({
    topProjects: projects.map((p) => ({
      name: p.name,
      domain: p.domain,
      techStack: p.techStack,
      bullets: p.finalBullets.length > 0 ? p.finalBullets : p.baseBullets,
    })),
    topSkills: skills.map((s) => s.name).slice(0, 10),
    topDomains,
  });

  await prisma.userSummary.upsert({
    where: { userId },
    create: { userId, summaryText, primaryDomain },
    update: { summaryText, primaryDomain },
  });
}