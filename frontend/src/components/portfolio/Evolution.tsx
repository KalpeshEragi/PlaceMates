import { ArrowRight, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioCareer, PortfolioEvolutionStage, PortfolioProject, PortfolioSkill } from "./types";

function buildFallbackStages({
  career,
  projects,
  skills,
}: {
  career: PortfolioCareer | undefined;
  projects: PortfolioProject[] | undefined;
  skills: PortfolioSkill[] | undefined;
}): PortfolioEvolutionStage[] {
  const primary = career?.primaryDomain ?? null;
  const secondary = career?.secondaryDomain ?? null;
  const orientation = career?.technicalOrientation ?? null;
  const tech = (skills ?? [])
    .slice()
    .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0))
    .slice(0, 6)
    .map((s) => s.name);

  const topProjects = (projects ?? []).slice(0, 4).map((p) => p.name);

  // Stage 1 label
  const stage1Label = "Programming Foundations";

  // Stage 2 label — derived from primary domain + orientation
  let stage2Label = "Engineering Momentum";
  if (primary && secondary) {
    stage2Label = `${primary} & ${secondary} Development`;
  } else if (primary) {
    stage2Label = `${primary} Systems Development`;
  } else if (secondary) {
    stage2Label = `${secondary} Development`;
  }

  // Stage 3 label — derived from orientation or primary domain
  let stage3Label = "High-Impact Systems";
  if (orientation && primary) {
    stage3Label = `${primary} ${orientation.charAt(0).toUpperCase() + orientation.slice(1)} Engineering`;
  } else if (primary) {
    stage3Label = `${primary} Systems Engineering`;
  } else if (orientation) {
    stage3Label = `${orientation.charAt(0).toUpperCase() + orientation.slice(1)} Engineering`;
  }

  return [
    {
      year: "Foundation",
      label: stage1Label,
      domains: ["Problem Solving", "Data Structures", "System Thinking"],
      technologies: tech.slice(0, 3),
      projects: topProjects.slice(0, 1),
    },
    {
      year: "Growth",
      label: stage2Label,
      domains: [primary ?? "Full‑Stack", secondary ?? "Product"].filter(Boolean) as string[],
      technologies: tech.slice(2, 6),
      projects: topProjects.slice(1, 3),
    },
    {
      year: "Mastery",
      label: stage3Label,
      domains: ["Architecture", "Quality", "Ownership"],
      technologies: tech.slice(0, 4),
      projects: topProjects.slice(3, 4),
    },
  ];
}

export function Evolution({
  stages,
  career,
  projects,
  skills,
  className,
}: {
  stages?: PortfolioEvolutionStage[] | undefined;
  career?: PortfolioCareer | undefined;
  projects?: PortfolioProject[] | undefined;
  skills?: PortfolioSkill[] | undefined;
  className?: string;
}) {
  const items = (stages && stages.length > 0)
    ? stages
    : buildFallbackStages({ career, projects, skills });

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Developer Evolution
        </h2>
        <p className="mt-1 text-sm text-white/60">
          A visual progression of domains, systems, and technologies over time.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {items.map((stage, idx) => (
          <Card
            key={`${stage.label}-${idx}`}
            className="relative overflow-hidden border-white/10 bg-white/5 shadow-xl backdrop-blur"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 opacity-60" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-white">{stage.label}</CardTitle>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  <Layers className="h-4 w-4 text-indigo-200" />
                  {stage.year ?? `Stage ${idx + 1}`}
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-4">
              {stage.domains?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-white/60">Domains</div>
                  <div className="flex flex-wrap gap-2">
                    {stage.domains.map((d) => (
                      <Badge
                        key={d}
                        className="border-white/10 bg-white/10 text-white/90"
                      >
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {stage.technologies?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-white/60">Technologies</div>
                  <div className="flex flex-wrap gap-2">
                    {stage.technologies.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="border-white/15 bg-transparent text-white/70"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {stage.projects?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-white/60">Projects</div>
                  <div className="space-y-1 text-sm text-white/75">
                    {stage.projects.map((p) => (
                      <div key={p} className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-white/40" />
                        <span className="line-clamp-1">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
