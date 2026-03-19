import { Brain, Gauge, Shield, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioStats } from "./types";
import { scoreToPercent } from "./portfolio-utils";

const METRICS = [
  { key: "profileScore", label: "Profile Score", icon: Brain },
  { key: "leadershipScore", label: "Leadership", icon: Users },
  { key: "impactScore", label: "Impact", icon: Gauge },
  { key: "ownershipScore", label: "Ownership", icon: Shield },
] as const;

/** Return a color class based on score tier. */
function scoreColor(value: number): string {
  if (value >= 70) return "from-emerald-500 to-emerald-400";
  if (value >= 40) return "from-amber-500 to-yellow-400";
  return "from-rose-500 to-pink-400";
}

function scoreLabel(value: number): string {
  if (value >= 70) return "Excellent";
  if (value >= 40) return "Good";
  if (value > 0) return "Developing";
  return "N/A";
}

export function Intelligence({
  stats,
  className,
}: {
  stats: PortfolioStats | undefined;
  className?: string;
}) {
  const s = stats ?? {};
  const values = METRICS.map((m) => ({
    ...m,
    value: scoreToPercent((s as any)[m.key]),
  }));

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Developer Intelligence
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Composite analytics from your GitHub + LinkedIn intelligence engines.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {values.map((m) => {
          const Icon = m.icon;
          const color = scoreColor(m.value);
          const label = scoreLabel(m.value);
          return (
            <Card
              key={m.key}
              className="border-white/10 bg-white/5 shadow-xl backdrop-blur"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-white/80">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon className="h-4 w-4 text-indigo-200" />
                  </span>
                  {m.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">
                    {m.value}
                  </span>
                  <span className="text-base font-medium text-white/60">/100</span>
                </div>

                {/* Color-coded progress bar */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r transition-all duration-700",
                      color,
                    )}
                    style={{ width: `${m.value}%` }}
                  />
                </div>

                <div className="text-xs text-white/55">
                  {label}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
