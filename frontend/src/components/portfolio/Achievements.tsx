import { Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioAchievement } from "./types";

export function Achievements({
  achievements,
  className,
}: {
  achievements: PortfolioAchievement[] | undefined;
  className?: string;
}) {
  const items = achievements ?? [];

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Achievements
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Certifications, honors, and standout recognitions.
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="border-white/10 bg-white/5 text-white/80 backdrop-blur">
          <CardContent className="py-10">
            No certifications or honors available yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, idx) => (
            <Card
              key={`${a.title}-${idx}`}
              className="group border-white/10 bg-white/5 shadow-xl backdrop-blur transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start justify-between gap-4 text-white">
                  <span className="line-clamp-2">{a.title}</span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Award className="h-4 w-4 text-indigo-200" />
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {a.issuer && (
                    <Badge className="border-white/10 bg-white/10 text-white/85">
                      {a.issuer}
                    </Badge>
                  )}
                  {a.year != null && (
                    <Badge
                      variant="outline"
                      className="border-white/15 bg-transparent text-white/70"
                    >
                      {a.year}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-white/55">
                  Verified signals strengthen credibility and narrative cohesion.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>

  );
}
