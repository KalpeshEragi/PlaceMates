import { notFound } from "next/navigation";
import Template1 from "@/components/templates/portfolio/Template1";
import Template2 from "@/components/templates/portfolio/Template2";
import Template3 from "@/components/templates/portfolio/Template3";
import type { PortfolioData } from "@/components/templates/portfolio/Template1";
import type { Metadata } from "next";

// ─── Types ────────────────────────────────────────────────────

type PortfolioAPIResponse = {
  templateId: string;
  data: {
    name: string;
    role: string;
    summary: string;
    skills: string[];
    profileImageUrl?: string | null;
    projects: {
      name: string;
      description: string;
      techStack?: string[];
      finalBullets?: string[];
      imageUrl?: string | null;
      repoUrl?: string;
    }[];
    experience: {
      role: string;
      company: string;
      duration: string;
      description: string;
    }[];
    education?: {
      institution: string;
      degree: string;
      duration: string;
    }[];
    awards?: {
      title: string;
      description?: string;
    }[];
  };
  meta: {
    githubUrl: string | null;
    linkedinUrl: string | null;
    email: string | null;
    profileImageUrl?: string | null;
  };
};

// ─── Template map ─────────────────────────────────────────────

const TEMPLATES: Record<string, React.ComponentType<{ data: PortfolioData }>> = {
  p1: Template1,
  p2: Template2,
  p3: Template3,
};

// ─── Data fetching ────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function fetchPortfolio(slug: string): Promise<PortfolioAPIResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/portfolio/${slug}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;
    const raw = (await res.json()) as Partial<PortfolioAPIResponse>;
    const projects = (raw.data?.projects || []).slice(0, 6).map((project) => ({
      name: project.name || "Untitled Project",
      description: project.description || "Project details are not available.",
      techStack: project.techStack || [],
      finalBullets: project.finalBullets || [],
      imageUrl: project.imageUrl ?? null,
      repoUrl: project.repoUrl ?? undefined,
    }));

    return {
      templateId: raw.templateId || "p1",
      data: {
        name: raw.data?.name || "Developer",
        role: raw.data?.role || "Software Developer",
        summary: raw.data?.summary || "Professional summary is not available.",
        skills: raw.data?.skills || [],
        profileImageUrl: raw.data?.profileImageUrl ?? raw.meta?.profileImageUrl ?? null,
        projects,
        experience: raw.data?.experience || [],
        education: raw.data?.education || [],
        awards: raw.data?.awards || [],
      },
      meta: {
        githubUrl: raw.meta?.githubUrl || null,
        linkedinUrl: raw.meta?.linkedinUrl || null,
        email: raw.meta?.email || null,
        profileImageUrl: raw.meta?.profileImageUrl ?? null,
      },
    };
  } catch {
    return null;
  }
}

// ─── Dynamic metadata ─────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = await fetchPortfolio(slug);

  if (!portfolio) {
    return { title: "Portfolio Not Found" };
  }

  return {
    title: `${portfolio.data.name} — ${portfolio.data.role}`,
    description: portfolio.data.summary.slice(0, 160),
    openGraph: {
      title: `${portfolio.data.name} — ${portfolio.data.role}`,
      description: portfolio.data.summary.slice(0, 160),
      type: "profile",
    },
  };
}

// ─── Page component ───────────────────────────────────────────

export default async function PortfolioPage({ params }: PageProps) {
  const { slug } = await params;
  const portfolio = await fetchPortfolio(slug);

  if (!portfolio) {
    notFound();
  }

  const TemplateComponent = TEMPLATES[portfolio.templateId] ?? Template1;

  return <TemplateComponent data={portfolio.data} />;
}
