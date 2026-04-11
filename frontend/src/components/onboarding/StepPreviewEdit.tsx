"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  onboardingApi,
  type UserPreviewPayload,
} from "@/lib/api/onboarding-api";
import type { PortfolioData } from "@/components/templates/portfolio/Template1";
import type { ResumeData } from "@/components/templates/resume/Template1";
import {
  portfolioComponentForId,
  resumeComponentForId,
} from "@/lib/templates/template-registry";

type ProjectEdit = {
  id: string;
  name: string;
  techStack: string[];
  descriptionSeed: string;
  bulletsText: string;
  intent: string;
};

function buildPortfolioView(
  base: UserPreviewPayload["portfolioData"],
  summary: string,
  skills: string[],
  projects: ProjectEdit[],
  profileImageUrl?: string | null,
): PortfolioData {
  return {
    name: base.name,
    role: base.role,
    summary,
    profileImageUrl: profileImageUrl ?? undefined,
    skills,
    projects: projects.map((p) => {
      const lines = p.bulletsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return {
        name: p.name,
        description: lines[0] ?? p.descriptionSeed,
        techStack: p.techStack,
        finalBullets: lines,
      };
    }),
    experience: base.experience,
    education: base.education,
    awards: base.awards,
  };
}

function mergeResumeSkills(
  editedNames: string[],
  original: ResumeData["skills"],
): ResumeData["skills"] {
  const domainByName = new Map(original.map((s) => [s.name, s.domain]));
  return editedNames.map((name) => ({
    name,
    domain: domainByName.get(name),
  }));
}

export default function StepPreviewEdit({ onNextAction }: { onNextAction: () => void }) {
  const [base, setBase] = useState<UserPreviewPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [projects, setProjects] = useState<ProjectEdit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await onboardingApi.getPreviewData();
      setBase(data);
      setSummary(data.portfolioData.summary);
      setSkillsText(data.portfolioData.skills.join("\n"));
      setProjects(
        data.portfolioData.projects
          .filter((p): p is typeof p & { id: string } => Boolean(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            techStack: p.techStack ?? [],
            descriptionSeed: p.description,
            bulletsText: (p.finalBullets ?? []).join("\n"),
            intent: (p.projectIntent ?? "").trim(),
          })),
      );
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message || "Failed to load preview.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const portfolioData = useMemo(() => {
    if (!base) return null;
    const skillList = skillsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return buildPortfolioView(base.portfolioData, summary, skillList, projects, base.meta.profileImageUrl);
  }, [base, summary, skillsText, projects]);

  const resumeData = useMemo((): ResumeData | null => {
    if (!base) return null;
    const skillList = skillsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const skillsMerged = mergeResumeSkills(skillList, base.resumeData.skills);
    return {
      ...base.resumeData,
      summary,
      skills: skillsMerged,
      projects: projects.map((p) => {
        const finalBullets = p.bulletsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        return {
          name: p.name,
          techStack: p.techStack,
          finalBullets,
          description: finalBullets[0] ?? p.descriptionSeed,
        };
      }),
    };
  }, [base, summary, skillsText, projects]);

  const handleFinalize = async () => {
    if (!base) return;
    if (projects.length === 0) {
      setError("No projects to save. Complete project selection and quiz first.");
      return;
    }

    const pt = base.portfolioTemplateId ?? "p1";
    const rt = base.resumeTemplateId ?? "r1";

    setSubmitting(true);
    setError(null);

    const skillList = skillsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await onboardingApi.finalizeOutput({
        portfolioTemplate: pt,
        resumeTemplate: rt,
        summary: summary.trim(),
        skills: skillList,
        projects: projects.map((p) => ({
          id: p.id,
          finalBullets: p.bulletsText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          projectIntent: p.intent.trim() || null,
        })),
      });
      onNextAction();
    } catch (e) {
      setError((e as Error).message || "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button variant="outline" onClick={() => reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!base || !portfolioData || !resumeData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const PortfolioComponent = portfolioComponentForId(base.portfolioTemplateId);
  const ResumeComponent = resumeComponentForId(base.resumeTemplateId);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden py-10 px-4 md:px-8">
      <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative max-w-[1600px] mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Preview & edit</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Adjust your summary, skills, and project bullets. Changes stay on this page until you confirm.
          For advanced customization (images, template switching), visit Portfolio Studio from the dashboard.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <section className="space-y-2">
              <label className="text-sm font-medium">Professional summary</label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </section>

            <section className="space-y-2">
              <label className="text-sm font-medium">Skills (one per line)</label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="React&#10;Node.js"
              />
            </section>

            <section className="space-y-4">
              <p className="text-sm font-medium">Projects</p>
              {projects.map((p, idx) => (
                <div key={p.id} className="rounded-lg border p-4 space-y-3 bg-card">
                  <p className="font-medium text-sm">{p.name}</p>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Intent (optional)</label>
                    <input
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={p.intent}
                      onChange={(e) => {
                        const v = e.target.value;
                        setProjects((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, intent: v } : x)),
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Bullet points (one per line)</label>
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={p.bulletsText}
                      onChange={(e) => {
                        const v = e.target.value;
                        setProjects((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, bulletsText: v } : x)),
                        );
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>
          </div>

          <div className="space-y-6 lg:sticky lg:top-6 self-start max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div>
              <p className="text-sm font-semibold mb-2">Resume preview</p>
              <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
                <div className="scale-[0.5] origin-top-left w-[200%] min-h-[560px] pointer-events-none">
                  <ResumeComponent data={resumeData} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Portfolio preview</p>
              <div className="rounded-lg border overflow-hidden shadow-sm bg-[#282c33]">
                <div className="scale-[0.42] origin-top-left w-[238%] min-h-[520px] pointer-events-none">
                  <PortfolioComponent data={portfolioData} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
        )}

        <div className="flex flex-wrap gap-3 justify-end">
          <Button variant="outline" type="button" onClick={() => reload()} disabled={submitting}>
            Reset from saved data
          </Button>
          <Button type="button" onClick={handleFinalize} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Confirm & generate final output"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
