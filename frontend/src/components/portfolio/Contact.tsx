import Link from "next/link";
import { Github, Globe, Linkedin, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioProfile } from "./types";
import { safeUrl } from "./portfolio-utils";

export function Contact({
  profile,
  className,
}: {
  profile: PortfolioProfile | undefined;
  className?: string;
}) {
  const email = profile?.email ?? null;
  const github = safeUrl(profile?.github ?? null);
  const linkedin = safeUrl(profile?.linkedin ?? null);
  const website = safeUrl(profile?.website ?? null);

  const links = [
    email
      ? {
          label: "Email",
          href: `mailto:${email}`,
          icon: Mail,
        }
      : null,
    github
      ? {
          label: "GitHub",
          href: github,
          icon: Github,
        }
      : null,
    linkedin
      ? {
          label: "LinkedIn",
          href: linkedin,
          icon: Linkedin,
        }
      : null,
    website
      ? {
          label: "Website",
          href: website,
          icon: Globe,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: any }>;

  return (
    <section className={cn("mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Contact
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Quick links to reach out and verify work.
        </p>
      </div>

      <Card className="overflow-hidden border-white/10 bg-white/5 shadow-2xl shadow-indigo-500/10 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10" />
        <CardContent className="relative py-10">
          {links.length === 0 ? (
            <div className="text-sm text-white/70">
              No public contact links are available for this portfolio yet.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {links.map((l) => {
                const Icon = l.icon;
                const external = l.href.startsWith("http");
                return (
                  <Button
                    key={l.label}
                    asChild
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10 backdrop-blur"
                  >
                    {external ? (
                      <Link href={l.href} target="_blank" rel="noreferrer">
                        <Icon className="mr-2 h-4 w-4" />
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href}>
                        <Icon className="mr-2 h-4 w-4" />
                        {l.label}
                      </a>
                    )}
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

