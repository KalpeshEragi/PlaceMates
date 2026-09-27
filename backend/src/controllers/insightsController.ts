import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// ─────────────────────────────────────────────────────────────
// In-memory cache (refreshes once every 24 hours)
// ─────────────────────────────────────────────────────────────
interface InsightsCache {
  data: InsightsResponse | null;
  expiresAt: number;
}

interface LocationShare {
  city: string;
  count: number;
  share: string;       // e.g. "38%"
  shareValue: number;  // e.g. 38
}

interface SkillDemand {
  name: string;
  percentage: number;
  count: number;
}

interface InsightsResponse {
  totalJobs: number;
  periodDays: number;
  topLocations: LocationShare[];
  skillsDemand: {
    frontend: SkillDemand[];
    backend: SkillDemand[];
    cloud: SkillDemand[];
  };
  generatedAt: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cache: InsightsCache = {
  data: null,
  expiresAt: 0,
};

// ─────────────────────────────────────────────────────────────
// Predefined skill keywords to scan in job descriptions
// ─────────────────────────────────────────────────────────────
const SKILL_KEYWORDS: Record<string, { label: string; category: "frontend" | "backend" | "cloud"; patterns: RegExp[] }> = {
  react: {
    label: "React.js / Next.js",
    category: "frontend",
    patterns: [/\breact\b/i, /\bnext\.?js\b/i, /\bnextjs\b/i],
  },
  angular: {
    label: "Angular",
    category: "frontend",
    patterns: [/\bangular\b/i],
  },
  vue: {
    label: "Vue.js",
    category: "frontend",
    patterns: [/\bvue\.?js\b/i, /\bvuejs\b/i, /\bvue\b/i],
  },
  node: {
    label: "Node.js (Express/Nest)",
    category: "backend",
    patterns: [/\bnode\.?js\b/i, /\bnodejs\b/i, /\bexpress\.?js\b/i, /\bnestjs\b/i, /\bnest\.?js\b/i],
  },
  java: {
    label: "Java (Spring Boot)",
    category: "backend",
    patterns: [/\bjava\b/i, /\bspring\s*boot\b/i, /\bspring\b/i],
  },
  python: {
    label: "Python (Django/FastAPI)",
    category: "backend",
    patterns: [/\bpython\b/i, /\bdjango\b/i, /\bfastapi\b/i, /\bflask\b/i],
  },
  aws: {
    label: "AWS",
    category: "cloud",
    patterns: [/\baws\b/i, /\bamazon\s+web\s+services\b/i, /\bec2\b/i, /\bs3\b/i, /\blambda\b/i],
  },
  docker: {
    label: "Docker / Kubernetes",
    category: "cloud",
    patterns: [/\bdocker\b/i, /\bkubernetes\b/i, /\bk8s\b/i, /\bcontainer/i],
  },
  gcp: {
    label: "GCP / Azure",
    category: "cloud",
    patterns: [/\bgcp\b/i, /\bgoogle\s+cloud\b/i, /\bazure\b/i],
  },
};

// ─────────────────────────────────────────────────────────────
// City normalization helpers
// ─────────────────────────────────────────────────────────────
const CITY_ALIASES: Record<string, string> = {
  bengaluru: "Bengaluru",
  bangalore: "Bengaluru",
  hyderabad: "Hyderabad",
  pune: "Pune",
  mumbai: "Mumbai",
  "navi mumbai": "Mumbai",
  delhi: "Delhi NCR",
  "new delhi": "Delhi NCR",
  noida: "Delhi NCR",
  gurugram: "Delhi NCR",
  gurgaon: "Delhi NCR",
  chennai: "Chennai",
  kolkata: "Kolkata",
  ahmedabad: "Ahmedabad",
  jaipur: "Jaipur",
  kochi: "Kochi",
  thiruvananthapuram: "Thiruvananthapuram",
  indore: "Indore",
  coimbatore: "Coimbatore",
};

function normalizeCity(rawLocation: string): string {
  const lower = rawLocation.toLowerCase().trim();
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  // Fallback: capitalize first letter of each word
  return rawLocation.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────
// Core aggregation logic
// ─────────────────────────────────────────────────────────────
async function computeInsights(): Promise<InsightsResponse> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch all jobs from the last 30 days
  const jobs = await prisma.job.findMany({
    where: {
      postedAt: { gte: thirtyDaysAgo },
    },
    select: {
      id: true,
      location: true,
      description: true,
    },
  });

  const totalJobs = jobs.length;

  // ── Top Locations ────────────────────────────────────────
  const locationCounts = new Map<string, number>();
  for (const job of jobs) {
    const city = normalizeCity(job.location);
    locationCounts.set(city, (locationCounts.get(city) || 0) + 1);
  }

  // Sort by count descending, take top 6
  const sortedLocations = [...locationCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const topLocations: LocationShare[] = sortedLocations.map(([city, count]) => {
    const shareValue = totalJobs > 0 ? Math.round((count / totalJobs) * 100) : 0;
    return {
      city,
      count,
      share: `${shareValue}%`,
      shareValue,
    };
  });

  // ── Skill Demand ─────────────────────────────────────────
  const skillCounts: Record<string, number> = {};
  for (const key of Object.keys(SKILL_KEYWORDS)) {
    skillCounts[key] = 0;
  }

  for (const job of jobs) {
    const text = job.description || "";
    for (const [key, config] of Object.entries(SKILL_KEYWORDS)) {
      const matched = config.patterns.some((p) => p.test(text));
      if (matched) skillCounts[key]++;
    }
  }

  function buildDemand(category: "frontend" | "backend" | "cloud"): SkillDemand[] {
    return Object.entries(SKILL_KEYWORDS)
      .filter(([, v]) => v.category === category)
      .map(([key, config]) => ({
        name: config.label,
        percentage: totalJobs > 0 ? Math.round((skillCounts[key] / totalJobs) * 100) : 0,
        count: skillCounts[key],
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  return {
    totalJobs,
    periodDays: 30,
    topLocations,
    skillsDemand: {
      frontend: buildDemand("frontend"),
      backend: buildDemand("backend"),
      cloud: buildDemand("cloud"),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/insights
// ─────────────────────────────────────────────────────────────
export const getInsights = async (_req: Request, res: Response) => {
  try {
    const now = Date.now();

    // Return cached data if still fresh
    if (cache.data && cache.expiresAt > now) {
      return res.json({ success: true, cached: true, ...cache.data });
    }

    // Compute fresh insights
    const insights = await computeInsights();

    // Update cache
    cache = {
      data: insights,
      expiresAt: now + CACHE_TTL_MS,
    };

    return res.json({ success: true, cached: false, ...insights });
  } catch (error) {
    console.error("[getInsights] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to compute insights" });
  }
};
