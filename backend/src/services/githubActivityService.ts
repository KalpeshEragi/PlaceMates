import axios from "axios";
import { prisma } from "../lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

const GITHUB_API_BASE = "https://api.github.com";
const MAX_PAGES = 10; // GitHub allows max 10 pages of 30 events = 300

// ── Types ──────────────────────────────────────────────────

export interface RadarDataPoint {
  category: string;
  value: number;
  fullMark: number;
}

export interface PieDataPoint {
  name: string;
  value: number;
  fill: string;
}

export interface ActivityStats {
  totalEvents: number;
  activeDays: number;
  topCollaboratedRepos: string[];
}

export interface GitHubActivityResponse {
  radarData: RadarDataPoint[];
  pieData: PieDataPoint[];
  stats: ActivityStats;
}

// ── Pie chart colors (matching existing palette) ───────────
const PIE_COLORS = {
  Commits: "#818cf8",       // indigo-400
  "Pull Requests": "#a78bfa", // purple-400
  Issues: "#34d399",        // emerald-400
  "Code Reviews": "#60a5fa", // blue-400
  Collaborations: "#fb923c", // orange-400
};

// ── Helpers ────────────────────────────────────────────────

async function getGithubUsername(token: string): Promise<string> {
  const res = await axios.get(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  return res.data.login;
}

async function fetchAllEvents(username: string, token: string): Promise<any[]> {
  const events: any[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const res = await axios.get(
        `${GITHUB_API_BASE}/users/${username}/events`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          params: { per_page: 30, page },
        }
      );

      if (!res.data.length) break;
      events.push(...res.data);
      if (res.data.length < 30) break;
    } catch {
      break;
    }
  }

  return events;
}

interface EventCounts {
  commits: number;
  pullRequests: number;
  issues: number;
  codeReviews: number;
  collaborations: number;
  repoActivity: number;
}

function categorizeEvents(events: any[], username: string): {
  counts: EventCounts;
  activeDays: number;
  topCollaboratedRepos: string[];
} {
  const counts: EventCounts = {
    commits: 0,
    pullRequests: 0,
    issues: 0,
    codeReviews: 0,
    collaborations: 0,
    repoActivity: 0,
  };

  const activeDaySet = new Set<string>();
  const collabRepoMap = new Map<string, number>();

  for (const event of events) {
    const created = event.created_at?.slice(0, 10);
    if (created) activeDaySet.add(created);

    const repoName: string = event.repo?.name ?? "";
    const isOwnRepo = repoName.toLowerCase().startsWith(`${username.toLowerCase()}/`);

    switch (event.type) {
      case "PushEvent":
        counts.commits += event.payload?.commits?.length ?? 1;
        break;
      case "PullRequestEvent":
        counts.pullRequests++;
        break;
      case "IssuesEvent":
        counts.issues++;
        break;
      case "PullRequestReviewEvent":
      case "PullRequestReviewCommentEvent":
        counts.codeReviews++;
        break;
      case "CreateEvent":
      case "DeleteEvent":
      case "ForkEvent":
      case "WatchEvent":
      case "ReleaseEvent":
        counts.repoActivity++;
        break;
    }

    if (!isOwnRepo && ["PushEvent", "PullRequestEvent", "PullRequestReviewEvent", "IssuesEvent"].includes(event.type)) {
      counts.collaborations++;
      collabRepoMap.set(repoName, (collabRepoMap.get(repoName) ?? 0) + 1);
    }
  }

  const topCollaboratedRepos = Array.from(collabRepoMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  return {
    counts,
    activeDays: activeDaySet.size,
    topCollaboratedRepos,
  };
}

// ── AI Scoring via Gemini ──────────────────────────────────

interface AIScores {
  codingConsistency: number;
  problemSolving: number;
  openSourceImpact: number;
  collaboration: number;
  learningSpeed: number;
  projectDepth: number;
}

async function scoreWithAI(
  counts: EventCounts,
  activeDays: number,
  repoStats: { totalRepos: number; totalStars: number; totalForks: number; languages: string[]; domains: string[]; avgLoc: number }
): Promise<AIScores> {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are a GitHub profile analyst. Based on the following GitHub activity data, score the user on 6 dimensions from 0 to 100.

Activity Data:
- Total commits: ${counts.commits}
- Pull requests: ${counts.pullRequests}
- Issues: ${counts.issues}
- Code reviews: ${counts.codeReviews}
- Collaborations (contributions to others' repos): ${counts.collaborations}
- Repo management events: ${counts.repoActivity}
- Active days (recent): ${activeDays}
- Total repositories: ${repoStats.totalRepos}
- Total stars: ${repoStats.totalStars}
- Total forks: ${repoStats.totalForks}
- Languages used: ${repoStats.languages.join(", ") || "Unknown"}
- Domains: ${repoStats.domains.join(", ") || "Unknown"}
- Average LOC per repo: ${Math.round(repoStats.avgLoc)}

Score these 6 dimensions (0-100 each):
1. codingConsistency - How regularly they code (commit frequency, active days, push regularity)
2. problemSolving - Issue engagement, debugging activity, PRs that fix bugs
3. openSourceImpact - Stars, forks, contributions to public repos, community engagement
4. collaboration - PRs to others' repos, code reviews, merged contributions
5. learningSpeed - Language diversity, new tech adoption, breadth of domains
6. projectDepth - Average LOC, project complexity, long-term maintenance

Return ONLY valid JSON: {"codingConsistency":N,"problemSolving":N,"openSourceImpact":N,"collaboration":N,"learningSpeed":N,"projectDepth":N}
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(result.response.text());
    return {
      codingConsistency: clamp(parsed.codingConsistency ?? 50),
      problemSolving: clamp(parsed.problemSolving ?? 50),
      openSourceImpact: clamp(parsed.openSourceImpact ?? 50),
      collaboration: clamp(parsed.collaboration ?? 50),
      learningSpeed: clamp(parsed.learningSpeed ?? 50),
      projectDepth: clamp(parsed.projectDepth ?? 50),
    };
  } catch (err) {
    console.error("Gemini scoring failed, using heuristic fallback:", err);
    return heuristicFallback(counts, activeDays, repoStats);
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function heuristicFallback(
  counts: EventCounts,
  activeDays: number,
  repoStats: { totalRepos: number; totalStars: number; totalForks: number; languages: string[]; avgLoc: number }
): AIScores {
  return {
    codingConsistency: clamp(Math.min(activeDays * 4, 100)),
    problemSolving: clamp(Math.min((counts.issues + counts.pullRequests) * 5, 100)),
    openSourceImpact: clamp(Math.min((repoStats.totalStars + repoStats.totalForks) * 3, 100)),
    collaboration: clamp(Math.min((counts.collaborations + counts.codeReviews) * 6, 100)),
    learningSpeed: clamp(Math.min(repoStats.languages.length * 15, 100)),
    projectDepth: clamp(Math.min(repoStats.avgLoc / 500, 100)),
  };
}

// ── Main export ────────────────────────────────────────────

export async function fetchGithubActivitySummary(userId: string): Promise<GitHubActivityResponse> {
  const user = await prisma.userAuth.findUnique({
    where: { id: userId },
    select: { githubAccessToken: true, githubConnected: true },
  });

  if (!user?.githubAccessToken || !user.githubConnected) {
    throw new Error("GitHub is not connected for this user.");
  }

  const token = user.githubAccessToken;
  const username = await getGithubUsername(token);
  const events = await fetchAllEvents(username, token);
  const { counts, activeDays, topCollaboratedRepos } = categorizeEvents(events, username);

  // Gather repo stats from DB for richer AI context
  const repos = await prisma.githubRepository.findMany({
    where: { userId },
    select: { language: true, stars: true, forks: true, totalLoc: true, detectedDomain: true },
  });

  const languages = [...new Set(repos.map((r) => r.language).filter(Boolean) as string[])];
  const domains = [...new Set(repos.map((r) => r.detectedDomain).filter(Boolean) as string[])];
  const totalStars = repos.reduce((s, r) => s + r.stars, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks, 0);
  const totalLoc = repos.reduce((s, r) => s + (r.totalLoc ?? 0), 0);
  const avgLoc = repos.length > 0 ? totalLoc / repos.length : 0;

  const scores = await scoreWithAI(counts, activeDays, {
    totalRepos: repos.length,
    totalStars,
    totalForks,
    languages,
    domains,
    avgLoc,
  });

  const radarData: RadarDataPoint[] = [
    { category: "Coding Consistency", value: scores.codingConsistency, fullMark: 100 },
    { category: "Problem Solving", value: scores.problemSolving, fullMark: 100 },
    { category: "Open Source Impact", value: scores.openSourceImpact, fullMark: 100 },
    { category: "Collaboration", value: scores.collaboration, fullMark: 100 },
    { category: "Learning Speed", value: scores.learningSpeed, fullMark: 100 },
    { category: "Project Depth", value: scores.projectDepth, fullMark: 100 },
  ];

  const pieData: PieDataPoint[] = [
    { name: "Commits", value: counts.commits, fill: PIE_COLORS.Commits },
    { name: "Pull Requests", value: counts.pullRequests, fill: PIE_COLORS["Pull Requests"] },
    { name: "Issues", value: counts.issues, fill: PIE_COLORS.Issues },
    { name: "Code Reviews", value: counts.codeReviews, fill: PIE_COLORS["Code Reviews"] },
    { name: "Collaborations", value: counts.collaborations, fill: PIE_COLORS.Collaborations },
  ].filter((d) => d.value > 0);

  return {
    radarData,
    pieData,
    stats: {
      totalEvents: events.length,
      activeDays,
      topCollaboratedRepos,
    },
  };
}
