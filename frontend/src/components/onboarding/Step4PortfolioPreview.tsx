"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  onboardingApi,
  type PublicPortfolioData,
  type PublicPortfolioResponse,
} from "@/lib/api/onboarding-api";

function slugFromPortfolioUrl(portfolioUrl: string): string {
  try {
    const parsed = new URL(portfolioUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  } catch {
    const segments = portfolioUrl.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  }
}

export default function Step4PortfolioPreview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioUrl, setPortfolioUrl] = useState<string>("");
  const [payload, setPayload] = useState<PublicPortfolioResponse | null>(null);

  const safeData: PublicPortfolioData = useMemo(() => {
    return (
      payload?.data ?? {
        name: "Developer",
        role: "Software Developer",
        summary: "Portfolio summary is not available yet.",
        skills: [],
        projects: [],
        experience: [],
        education: [],
        awards: [],
      }
    );
  }, [payload]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const urlResponse = await onboardingApi.getPortfolioUrl();
      setPortfolioUrl(urlResponse.portfolioUrl);
      const slug = slugFromPortfolioUrl(urlResponse.portfolioUrl);
      if (!slug) throw new Error("Invalid portfolio URL.");
      const publicData = await onboardingApi.getPublicPortfolioBySlug(slug);
      setPayload(publicData);
    } catch (err) {
      setError((err as Error).message || "Failed to load preview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your portfolio preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden py-10 px-6">
      <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Step 6 of 6
            </p>
            <h1 className="text-3xl font-semibold">Portfolio Preview</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reload}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => portfolioUrl && window.open(portfolioUrl, "_blank")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Public Portfolio
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="feature-card p-6 space-y-6">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">
              {safeData.name} - {safeData.role}
            </h2>
            <p className="text-sm text-muted-foreground">
              {safeData.summary || "Summary is not available."}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Skills</h3>
            {safeData.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {safeData.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No skills available.</p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Top Projects (5)</h3>
            {safeData.projects.slice(0, 5).length > 0 ? (
              safeData.projects.slice(0, 5).map((project) => (
                <div key={project.name} className="border rounded-lg p-3 space-y-2">
                  <p className="font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.techStack?.join(" + ") || "No tech stack"}
                  </p>
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    {(project.finalBullets || []).slice(0, 4).map((bullet, index) => (
                      <li key={`${project.name}-${index}`}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No projects available.</p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Experience</h3>
            {safeData.experience.length > 0 ? (
              safeData.experience.map((item, index) => (
                <div key={`${item.company}-${index}`} className="border rounded-lg p-3 space-y-1">
                  <p className="font-medium">
                    {item.role} - {item.company}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.duration}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No experience available.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
