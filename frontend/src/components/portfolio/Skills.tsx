import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioSkill, GithubSkillSignal, RepoLanguageInfo } from "./types";

// ── Skill name cleaning ──────────────────────────────────────

/** Maps common LinkedIn verbose names → clean developer names. */
const CLEAN_NAME_MAP: Record<string, string> = {
  "python (programming language)": "Python",
  "cascading style sheets (css)": "CSS",
  "bootstrap (framework)": "Bootstrap",
  "node.js": "Node.js",
  "react.js": "React",
  "vue.js": "Vue.js",
  "angular (web framework)": "Angular",
  "next.js": "Next.js",
  "express.js": "Express",
  "tensorflow (machine learning framework)": "TensorFlow",
  "pytorch (machine learning framework)": "PyTorch",
  "amazon web services (aws)": "AWS",
  "google cloud platform (gcp)": "GCP",
  "microsoft azure": "Azure",
  "structured query language (sql)": "SQL",
  "hypertext markup language (html)": "HTML",
  "javascript (programming language)": "JavaScript",
  "typescript (programming language)": "TypeScript",
  "java (programming language)": "Java",
  "c++ (programming language)": "C++",
  "c (programming language)": "C",
  "c# (programming language)": "C#",
  "go (programming language)": "Go",
  "rust (programming language)": "Rust",
  "ruby (programming language)": "Ruby",
  "swift (programming language)": "Swift",
  "kotlin (programming language)": "Kotlin",
  "php (programming language)": "PHP",
  "r (programming language)": "R",
  "dart (programming language)": "Dart",
  "scala (programming language)": "Scala",
  "mongodb (database)": "MongoDB",
  "postgresql (database)": "PostgreSQL",
  "mysql (database)": "MySQL",
  "docker (software)": "Docker",
  "kubernetes (software)": "Kubernetes",
  "git (version control)": "Git",
  "tailwind css": "Tailwind CSS",
  "jquery (javascript library)": "jQuery",
  "flask (web framework)": "Flask",
  "django (web framework)": "Django",
  "spring framework": "Spring",
  "spring boot": "Spring Boot",
  "ruby on rails": "Rails",
  "redux.js": "Redux",
};

/**
 * Clean a skill name: strip parenthetical suffixes, apply known
 * mappings, and title-case the result.
 */
function cleanSkillName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (!lower) return raw;

  // Direct lookup
  if (CLEAN_NAME_MAP[lower]) return CLEAN_NAME_MAP[lower];

  // Strip common parenthetical suffixes:
  // "Python (Programming Language)" → "Python"
  const stripped = raw.replace(/\s*\((?:programming language|framework|database|software|web framework|javascript library|machine learning framework)\)/i, "").trim();
  if (stripped) return titleCase(stripped);

  return titleCase(raw.trim());
}

function titleCase(s: string): string {
  // Skip if it already looks like an acronym or proper name (e.g. "CSS", "Node.js")
  if (/^[A-Z][A-Z]+$/.test(s) || /\.[a-z]/.test(s)) return s;
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

// ── Cluster label formatting ─────────────────────────────────

const CLUSTER_LABELS: Record<string, string> = {
  "frontend": "Frontend",
  "backend": "Backend",
  "ai_ml": "AI & ML",
  "prompt_engineering": "Prompt Engineering",
  "systems_programming": "Systems Programming",
  "other": "Other",
  "general": "General",
};

function formatCluster(raw: string): string {
  const key = raw.toLowerCase().trim();
  return CLUSTER_LABELS[key] ?? raw;
}

// ── Signal merging ───────────────────────────────────────────

interface EnrichedSkill {
  name: string;
  displayName: string;
  cluster: string;
  linkedinFrequency: number;
  githubStrength: number;
  projectMentions: number;
  compositeScore: number;
}

/**
 * Build a map of skill name → GitHub LOC usage from repo language data.
 * Normalizes language names to lowercase keys.
 */
function buildGithubLocMap(repos: RepoLanguageInfo[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const repo of repos) {
    // Primary language
    if (repo.language) {
      const key = repo.language.toLowerCase().trim();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    // Detailed LOC breakdown
    if (repo.locByLanguage && typeof repo.locByLanguage === "object") {
      for (const [lang, loc] of Object.entries(repo.locByLanguage)) {
        const key = lang.toLowerCase().trim();
        // Normalize LOC to a 0-1 signal: each language used counts as usage fraction
        const locNum = typeof loc === "number" ? loc : 0;
        if (locNum > 0) {
          map.set(key, (map.get(key) ?? 0) + 1);
        }
      }
    }
  }
  return map;
}

/**
 * Count how many repo descriptions/readmes mention a skill.
 */
function countProjectMentions(skillKey: string, repos: RepoLanguageInfo[]): number {
  let count = 0;
  for (const repo of repos) {
    const text = `${repo.description ?? ""} ${repo.readmeSummary ?? ""}`.toLowerCase();
    if (text.includes(skillKey)) count++;
  }
  return count;
}

/**
 * Merge LinkedIn skills with GitHub signals to produce enriched skills
 * with composite scores.
 *
 * Score formula:
 *   compositeScore = (linkedinFrequency × 2) + githubUsage + projectMentions
 */
function mergeSkillSignals(
  linkedinSkills: PortfolioSkill[],
  githubSkills: GithubSkillSignal[],
  repoLanguages: RepoLanguageInfo[],
): EnrichedSkill[] {
  const enriched = new Map<string, EnrichedSkill>();

  const githubMap = new Map<string, number>();
  for (const gs of githubSkills) {
    const key = gs.name.toLowerCase().trim();
    githubMap.set(key, Math.max(githubMap.get(key) ?? 0, gs.strength));
  }

  const locMap = buildGithubLocMap(repoLanguages);

  // Process LinkedIn skills first
  for (const s of linkedinSkills) {
    const key = cleanSkillName(s.name).toLowerCase().trim();
    if (!key) continue;

    const existing = enriched.get(key);
    const freq = s.frequency ?? 1;

    if (existing) {
      existing.linkedinFrequency = Math.max(existing.linkedinFrequency, freq);
      if (!existing.cluster || existing.cluster === "General") {
        existing.cluster = formatCluster(s.cluster ?? "General");
      }
    } else {
      const ghStrength = githubMap.get(key) ?? 0;
      const locUsage = locMap.get(key) ?? 0;
      const githubScore = Math.max(ghStrength, locUsage);
      const mentions = countProjectMentions(key, repoLanguages);

      enriched.set(key, {
        name: key,
        displayName: cleanSkillName(s.name),
        cluster: formatCluster(s.cluster ?? "General"),
        linkedinFrequency: freq,
        githubStrength: githubScore,
        projectMentions: mentions,
        compositeScore: 0, // computed below
      });
    }
  }

  // Add GitHub-only skills (languages detected in repos but not in LinkedIn)
  for (const [langKey, usage] of locMap.entries()) {
    if (!enriched.has(langKey) && usage > 0) {
      enriched.set(langKey, {
        name: langKey,
        displayName: titleCase(langKey),
        cluster: "General",
        linkedinFrequency: 0,
        githubStrength: usage,
        projectMentions: countProjectMentions(langKey, repoLanguages),
        compositeScore: 0,
      });
    }
  }

  // Compute composite scores
  for (const skill of enriched.values()) {
    skill.compositeScore =
      skill.linkedinFrequency * 2 +
      skill.githubStrength +
      skill.projectMentions;
  }

  return [...enriched.values()];
}

// ── Clustering ───────────────────────────────────────────────

function clusterEnrichedSkills(skills: EnrichedSkill[]) {
  const map = new Map<string, EnrichedSkill[]>();
  for (const s of skills) {
    const arr = map.get(s.cluster) ?? [];
    arr.push(s);
    map.set(s.cluster, arr);
  }
  for (const [k, arr] of map.entries()) {
    arr.sort((a, b) => b.compositeScore - a.compositeScore);
    map.set(k, arr);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

// ── Component ────────────────────────────────────────────────

export function Skills({
  skills,
  githubSkills,
  repoLanguages,
  className,
}: {
  skills: PortfolioSkill[] | undefined;
  githubSkills?: GithubSkillSignal[];
  repoLanguages?: RepoLanguageInfo[];
  className?: string;
}) {
  const enriched = mergeSkillSignals(
    skills ?? [],
    githubSkills ?? [],
    repoLanguages ?? [],
  );

  const maxScore = Math.max(1, ...enriched.map((s) => s.compositeScore));
  const clusters = clusterEnrichedSkills(enriched);

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Skills Intelligence
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Clustered signals from LinkedIn and project codebases.
        </p>
      </div>

      {enriched.length === 0 ? (
        <Card className="border-white/10 bg-white/5 text-white/80 backdrop-blur">
          <CardContent className="py-10">
            No skills found for this portfolio yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {clusters.map(([cluster, list]) => (
            <Card
              key={cluster}
              className="border-white/10 bg-white/5 shadow-xl backdrop-blur"
            >
              <CardHeader>
                <CardTitle className="text-white">{cluster}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  {list.slice(0, 6).map((s) => {
                    const pct = Math.round((s.compositeScore / maxScore) * 100);
                    const barColor =
                      pct >= 70
                        ? "from-emerald-500 to-emerald-400"
                        : pct >= 40
                        ? "from-amber-500 to-yellow-400"
                        : "from-indigo-500 to-indigo-400";
                    return (
                      <div key={`${cluster}-${s.name}`} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white/90">
                            {s.displayName}
                          </div>
                          <div className="text-xs text-white/60">{pct}%</div>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full rounded-full bg-gradient-to-r transition-all duration-700",
                              barColor,
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  {list.slice(0, 14).map((s) => (
                    <Badge
                      key={`${cluster}-chip-${s.name}`}
                      className="border-white/10 bg-white/10 text-white/85 hover:bg-white/15"
                    >
                      {s.displayName}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
