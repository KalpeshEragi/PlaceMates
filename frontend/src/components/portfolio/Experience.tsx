import { Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioExperienceItem } from "./types";

function formatRange(item: PortfolioExperienceItem): string {
  const start = item.start ?? null;
  const end = item.end ?? null;
  const date = item.date ?? null;
  if (date) return date;
  if (start && end) return `${start} — ${end}`;
  if (start && !end) return `${start} — Present`;
  return "—";
}

export function Experience({
  experience,
  className,
}: {
  experience: PortfolioExperienceItem[] | undefined;
  className?: string;
}) {
  const items = experience ?? [];

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Experience Timeline
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Roles and milestones that shaped this developer’s trajectory.
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="border-white/10 bg-white/5 text-white/80 backdrop-blur">
          <CardContent className="py-10">
            Experience data isn’t available for this portfolio yet.
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
          <div className="space-y-4">
            {items.map((item, idx) => {
              const role = item.role ?? item.title ?? "Role";
              const org = item.organization ?? item.company ?? "Organization";
              const range = formatRange(item);
              return (
                <Card
                  key={`${range}-${org}-${idx}`}
                  className="relative ml-10 border-white/10 bg-white/5 shadow-xl backdrop-blur"
                >
                  <div className="absolute -left-10 top-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur">
                    <Briefcase className="h-4 w-4 text-indigo-200" />
                  </div>
                  <CardContent className="py-6">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm text-white/60">{range}</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {role}
                        </div>
                        <div className="text-sm text-white/70">{org}</div>
                      </div>
                    </div>
                    {item.description && (
                      <p className="mt-4 text-sm leading-relaxed text-white/70">
                        {item.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

