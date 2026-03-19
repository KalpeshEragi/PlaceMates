import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioProject } from "./types";
import { formatCompactNumber, scoreToPercent, safeUrl } from "./portfolio-utils";

/** Deduplicate projects by name — keep the one with the highest score. */
function deduplicateProjects(projects: PortfolioProject[]): PortfolioProject[] {
  const map = new Map<string, PortfolioProject>();
  for (const p of projects) {
    const key = p.name.toLowerCase().trim();
    const existing = map.get(key);
    const score = p.finalScore ?? p.score ?? 0;
    const existingScore = existing?.finalScore ?? existing?.score ?? 0;
    if (!existing || score > existingScore) {
      map.set(key, p);
    }
  }
  return [...map.values()];
}

function ProjectCard({ project }: { project: PortfolioProject }) {
  const domain = project.domain ?? project.detectedDomain ?? null;
  const url = safeUrl(project.repoUrl ?? project.url ?? null);
  const score = scoreToPercent(project.finalScore ?? project.score);
  const stars = project.stars ?? 0;

  return (
    <Card className="group relative overflow-hidden border-white/10 bg-white/5 shadow-xl backdrop-blur transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-indigo-500/15">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-transparent to-fuchsia-500/10" />
      </div>

      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base text-white">{project.name}</CardTitle>
          {url && (
            <Link
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
            >
              View <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {domain && (
            <Badge className="border-white/10 bg-white/10 text-white/90">
              {domain}
            </Badge>
          )}
          {project.language && (
            <Badge
              variant="outline"
              className="border-white/15 bg-transparent text-white/70"
            >
              {project.language}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-white/70">
          {project.description || "High-signal repository with measurable impact and strong engineering hygiene."}
        </p>

        <div className="flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-300/90" />
            <span>{formatCompactNumber(stars)} stars</span>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/80">
            Score {score}/100
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Projects({
  projects,
  className,
}: {
  projects: PortfolioProject[] | undefined;
  className?: string;
}) {
  const uniqueItems = deduplicateProjects(projects ?? []);

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Featured Projects
          </h2>
          <p className="mt-1 text-sm text-white/60">
            High-impact repositories ranked by your intelligence engine.
          </p>
        </div>
        <div className="hidden md:block text-xs text-white/50">
          Hover to elevate • Click to open
        </div>
      </div>

      {uniqueItems.length === 0 ? (
        <Card className="border-white/10 bg-white/5 text-white/80 backdrop-blur">
          <CardContent className="py-10">
            No projects found for this portfolio yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {uniqueItems.map((p) => (
            <ProjectCard key={`${p.name}-${p.repoUrl ?? ""}`} project={p} />
          ))}
        </div>
      )}
    </section>
  );
}
