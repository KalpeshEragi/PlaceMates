import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Hero } from "@/components/portfolio/Hero";
import { Projects } from "@/components/portfolio/Projects";
import { Experience } from "@/components/portfolio/Experience";
import { Evolution } from "@/components/portfolio/Evolution";
import { Skills } from "@/components/portfolio/Skills";
import { Intelligence } from "@/components/portfolio/Intelligence";
import { Domains } from "@/components/portfolio/Domains";
import { Achievements } from "@/components/portfolio/Achievements";
import { Contact } from "@/components/portfolio/Contact";
import type { PortfolioResponse } from "@/components/portfolio/types";
import { slugToDisplayName } from "@/components/portfolio/portfolio-utils";

export const dynamic = "force-dynamic";

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return raw.replace(/\/api\/?$/i, "");
}

async function getPortfolio(slug: string): Promise<PortfolioResponse> {
  const res = await fetch(`${apiBase()}/api/portfolio/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    throw new Error(`Failed to load portfolio (${res.status})`);
  }

  return (await res.json()) as PortfolioResponse;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = slugToDisplayName(slug);
  return {
    title: `${name} • Developer Portfolio`,
    description: `Developer portfolio for ${name} — projects, skills, experience, and intelligence insights.`,
  };
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPortfolio(slug);

  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      {/* Global background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(99,102,241,0.18),transparent_45%),radial-gradient(900px_circle_at_90%_30%,rgba(236,72,153,0.14),transparent_40%),radial-gradient(800px_circle_at_50%_110%,rgba(34,211,238,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent" />
      </div>

      <Hero slug={slug} data={data} />

      <div className="space-y-16 pb-2">
        <Projects projects={data.projects} />
        <Experience experience={data.experience} />
        <Evolution stages={data.evolution} career={data.career} projects={data.projects} skills={data.skills} />
        <Skills skills={data.skills} githubSkills={data.githubSkills} repoLanguages={data.repoLanguages} />
        <Intelligence stats={data.stats} />
        <Domains career={data.career} domains={data.domains} />
        <Achievements achievements={data.achievements} />
        <Contact profile={data.profile} />
      </div>
    </div>
  );
}

