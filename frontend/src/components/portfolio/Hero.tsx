import Image from "next/image";
import Link from "next/link";
import { Github, Globe, Linkedin, Mail, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortfolioResponse } from "./types";
import { pickDeterministicAvatar, safeUrl, scoreToPercent, slugToDisplayName, generateAiTitle, formatExperienceYears } from "./portfolio-utils";

export function Hero({
  slug,
  data,
  className,
}: {
  slug: string;
  data: PortfolioResponse;
  className?: string;
}) {
  const profile = data.profile ?? {};
  const career = data.career ?? {};
  const stats = data.stats ?? {};

  const name = profile.name ?? slugToDisplayName(slug);
  const primaryDomain = career.primaryDomain ?? data.domains?.primaryDomain ?? null;
  const title =
    career.aiTitle ??
    profile.title ??
    generateAiTitle(career);
  const tagline =
    career.tagline ??
    profile.tagline ??
    career.careerSummary ??
    "Building reliable systems, shipping polished products, and leveling up every release.";

  const profilePhoto =
    profile.profilePhoto ??
    profile.profilePhotoUrl ??
    profile.photo ??
    null;

  const avatarSrc = profilePhoto || pickDeterministicAvatar(slug);

  const email = profile.email ?? null;
  const github = safeUrl(profile.github ?? null);
  const linkedin = safeUrl(profile.linkedin ?? null);
  const website = safeUrl(profile.website ?? null);

  const profileScore = scoreToPercent(stats.profileScore);

  const experienceLabel = formatExperienceYears(career.experienceYears);

  return (
    <section className={cn("relative overflow-hidden", className)}>
      {/* Floating gradient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-[-6rem] h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-indigo-500/35 to-purple-500/25 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-gradient-to-br from-sky-500/25 to-fuchsia-500/25 blur-3xl animate-pulse [animation-delay:900ms]" />
        <div className="absolute top-24 right-16 h-52 w-52 rounded-full bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 blur-3xl animate-pulse [animation-delay:1500ms]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-8 lg:pb-14 lg:pt-24">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur">
              <Sparkles className="h-4 w-4 text-indigo-300" />
              AI Portfolio • Profile score {profileScore}/100
            </div>

            <div className="space-y-3">
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {name}
              </h1>
              <p className="text-pretty text-lg text-white/80 sm:text-xl">
                <span className="bg-gradient-to-r from-indigo-200 via-white to-fuchsia-200 bg-clip-text text-transparent">
                  {title}
                </span>
              </p>
              <p className="max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg">
                {tagline}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {primaryDomain && (
                <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/15">
                  Primary: {primaryDomain}
                </Badge>
              )}
              {career.secondaryDomain && (
                <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/15">
                  Secondary: {career.secondaryDomain}
                </Badge>
              )}
              {experienceLabel && (
                <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/15">
                  {experienceLabel}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {email && (
                <Button
                  asChild
                  className="bg-white text-slate-900 hover:bg-white/90 shadow-xl shadow-indigo-500/10"
                >
                  <a href={`mailto:${email}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </a>
                </Button>
              )}

              {github && (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 backdrop-blur"
                >
                  <Link href={github} target="_blank" rel="noreferrer">
                    <Github className="mr-2 h-4 w-4" />
                    GitHub
                  </Link>
                </Button>
              )}

              {linkedin && (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 backdrop-blur"
                >
                  <Link href={linkedin} target="_blank" rel="noreferrer">
                    <Linkedin className="mr-2 h-4 w-4" />
                    LinkedIn
                  </Link>
                </Button>
              )}

              {website && (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 backdrop-blur"
                >
                  <Link href={website} target="_blank" rel="noreferrer">
                    <Globe className="mr-2 h-4 w-4" />
                    Website
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Glass avatar card */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-indigo-500/10 backdrop-blur">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-60" />
              <div className="relative">
                <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-2xl border border-white/10 shadow-xl">
                  <Image
                    src={avatarSrc}
                    alt={`${name} avatar`}
                    fill
                    className="object-cover"
                    unoptimized={!!profilePhoto}
                  />
                </div>
                <div className="mt-6 space-y-2 text-center">
                  <p className="text-sm font-medium text-white/90">{title}</p>
                  <p className="text-xs text-white/60">
                    {career.careerSummary
                      ? "AI summarized from LinkedIn + GitHub"
                      : "AI-enhanced developer profile"}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { label: "Projects", value: data.projects?.length ?? 0 },
                    { label: "Skills", value: data.skills?.length ?? 0 },
                    { label: "Score", value: profileScore },
                  ].map((k) => (
                    <div
                      key={k.label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center backdrop-blur"
                    >
                      <div className="text-lg font-semibold text-white">
                        {k.value}
                      </div>
                      <div className="text-[11px] text-white/60">{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute -inset-x-10 -bottom-10 h-40 bg-gradient-to-r from-indigo-500/0 via-indigo-500/15 to-fuchsia-500/0 blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
