"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { onboardingApi, type UserPreviewPayload } from "@/lib/api/onboarding-api";
import type { PortfolioData } from "@/components/templates/portfolio/Template1";
import { PORTFOLIO_TEMPLATES, RESUME_TEMPLATES } from "@/lib/templates/template-registry";

function toPortfolioData(payload: UserPreviewPayload): PortfolioData {
  const d = payload.portfolioData;
  return {
    name: d.name,
    role: d.role,
    summary: d.summary,
    skills: d.skills,
    projects: d.projects.map((p) => ({
      name: p.name,
      description: p.description,
      techStack: p.techStack,
    })),
    experience: d.experience,
    education: d.education,
    awards: d.awards,
  };
}

export default function Step4Templates({ onNextAction }: { onNextAction: () => void }) {
  const [payload, setPayload] = useState<UserPreviewPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await onboardingApi.getPreviewData();
        if (cancelled) return;
        setPayload(data);
        setSelectedPortfolio(data.portfolioTemplateId ?? "p1");
        setSelectedResume(data.resumeTemplateId ?? "arjun_mehta");
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message || "Failed to load your data.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const portfolioData = useMemo(
    () => (payload ? toPortfolioData(payload) : null),
    [payload],
  );

  const handleContinue = async () => {
    if (!selectedPortfolio || !selectedResume) return;

    setSaving(true);
    setError(null);

    try {
      await onboardingApi.saveTemplate(selectedPortfolio, selectedResume);
      onNextAction();
    } catch (err) {
      setError((err as Error).message || "Failed to save template preference");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    );
  }

  if (!payload || !portfolioData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden px-6 py-16">
      <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative max-w-7xl mx-auto space-y-14">
        <div className="text-center">
          <h2 className="text-3xl font-semibold">Choose your templates</h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            Previews use your real profile data. Pick one resume layout and one portfolio layout.
          </p>
        </div>

        <section className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2">Resume templates</h3>
          <div className="grid md:grid-cols-2 gap-8">
            {RESUME_TEMPLATES.map((temp) => {
              const selected = selectedResume === temp.id;
              const R = temp.component;
              return (
                <div
                  key={temp.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedResume(temp.id)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedResume(temp.id)}
                  className={`relative border rounded-xl cursor-pointer transition overflow-hidden bg-white ${
                    selected ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border hover:shadow-md"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                      Selected
                    </div>
                  )}
                  {/* Container set to height of unscaled version scaled down. 1000px * 0.45 = 450px roughly. */}
                  <div className="relative h-[380px] overflow-hidden bg-gray-50 flex items-start justify-center">
                    <div className="w-[800px] h-[1000px] scale-[0.45] origin-top pointer-events-none mt-2 shadow-sm rounded-sm overflow-hidden">
                      <R data={payload.resumeData} />
                    </div>
                  </div>
                  <div className="p-3 text-center text-sm font-medium border-t bg-muted/30">
                    {temp.label}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2">Portfolio templates</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {PORTFOLIO_TEMPLATES.map((temp) => {
              const selected = selectedPortfolio === temp.id;
              const P = temp.component;
              return (
                <div
                  key={temp.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPortfolio(temp.id)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedPortfolio(temp.id)}
                  className={`relative rounded-2xl overflow-hidden border cursor-pointer transition ${
                    selected ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border hover:shadow-md"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                      Selected
                    </div>
                  )}
                  <div className="relative h-[320px] sm:h-[400px] overflow-hidden bg-[#282c33] flex items-start justify-center">
                    <div className="w-[1000px] h-[1200px] scale-[0.35] sm:scale-[0.4] origin-top pointer-events-none overflow-hidden">
                      <P data={portfolioData} />
                    </div>
                  </div>
                  <div className="p-3 text-center text-sm font-medium border-t bg-muted/30">
                    {temp.label}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3 text-center">{error}</p>
        )}

        <div className="flex justify-end">
          <Button onClick={handleContinue} disabled={!selectedPortfolio || !selectedResume || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue to preview & edit"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
