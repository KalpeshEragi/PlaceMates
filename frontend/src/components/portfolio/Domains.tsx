import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioCareer, PortfolioDomains } from "./types";

export function Domains({
  career,
  domains,
  className,
}: {
  career: PortfolioCareer | undefined;
  domains: PortfolioDomains | undefined;
  className?: string;
}) {
  const primary = career?.primaryDomain ?? domains?.primaryDomain ?? null;
  const secondary = career?.secondaryDomain ?? domains?.secondaryDomain ?? null;
  const orientation = career?.technicalOrientation ?? domains?.technicalOrientation ?? null;

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Domain Identity
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Specialization signals inferred from career and project patterns.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-white/10 bg-white/5 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Primary Domain</CardTitle>
          </CardHeader>
          <CardContent>
            {primary ? (
              <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/15">
                {primary}
              </Badge>
            ) : (
              <div className="text-sm text-white/70">Not available</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Secondary Domain</CardTitle>
          </CardHeader>
          <CardContent>
            {secondary ? (
              <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/15">
                {secondary}
              </Badge>
            ) : (
              <div className="text-sm text-white/70">Not available</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Technical Orientation</CardTitle>
          </CardHeader>
          <CardContent>
            {orientation ? (
              <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/15">
                {orientation}
              </Badge>
            ) : (
              <div className="text-sm text-white/70">Deep Technical Builder</div>
            )}
            <div className="mt-3 text-xs text-white/55">
              Interprets the balance between systems depth, product surface area, and delivery velocity.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

