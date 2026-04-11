"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Star, GitFork, Users, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import {
  onboardingApi,
  type ProjectDto,
} from "@/lib/api/onboarding-api";

/* ── Domain color mapping ────────────────────────────────── */

const DOMAIN_COLORS: Record<string, string> = {
  Frontend: "hsl(230 75% 52%)",
  Backend: "hsl(160 60% 42%)",
  "Full Stack": "hsl(200 80% 45%)",
  "ML / AI": "hsl(280 60% 55%)",
  DevOps: "hsl(30 80% 50%)",
  Mobile: "hsl(340 65% 50%)",
  Other: "hsl(210 15% 55%)",
};

function getDomainColor(domain: string | null): string {
  return DOMAIN_COLORS[domain ?? "Other"] ?? DOMAIN_COLORS.Other;
}

/* ── Main Component ──────────────────────────────────────── */

export default function Step3ProjectQuiz({ onNextAction }: { onNextAction: () => void }) {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Intent state: projectId → intent string
  const [intents, setIntents] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      try {
        const { projects: list } = await onboardingApi.getSelectedProjects();
        setProjects(list);
        // Initialize intents from existing data
        const initial: Record<string, string> = {};
        for (const p of list) {
          initial[p.id] = p.projectIntent ?? "";
        }
        setIntents(initial);
      } catch (err) {
        setError((err as Error).message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const updateIntent = (id: string, value: string) => {
    setIntents((prev) => ({ ...prev, [id]: value }));
  };

  // Validate: every project needs 2+ words
  const allValid = projects.every((p) => {
    const words = (intents[p.id] ?? "").trim().split(/\s+/).filter(Boolean);
    return words.length >= 2;
  });

  const filledCount = projects.filter((p) => {
    const words = (intents[p.id] ?? "").trim().split(/\s+/).filter(Boolean);
    return words.length >= 2;
  }).length;

  const handleSubmit = async () => {
    if (!allValid) {
      setError("Please describe each project in at least 2 words.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onboardingApi.batchFinalize(
        projects.map((p) => ({
          projectId: p.id,
          intent: (intents[p.id] ?? "").trim(),
        })),
      );
      setSuccess(true);
      // Brief success state before navigating
      setTimeout(() => onNextAction(), 1200);
    } catch (err) {
      setError((err as Error).message || "Failed to finalize projects");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your projects...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md space-y-2">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-red-500 font-medium">No projects selected.</p>
          <p className="text-sm text-muted-foreground">Go back and select 5–6 repositories.</p>
        </div>
      </div>
    );
  }

  /* ── Success ───────────────────────────────────────────── */

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold">Projects analyzed!</h2>
          <p className="text-muted-foreground">AI has enriched your project descriptions.</p>
        </div>
      </div>
    );
  }

  /* ── Main UI ───────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative z-10 max-w-3xl w-full mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Step 5 of 6</p>
          <h2 className="text-2xl font-semibold">Tell us about your projects</h2>
          <p className="text-muted-foreground">
            Write a one-liner for each — AI generates the rest ✨
          </p>
        </div>

        {/* Project Cards */}
        <div className="space-y-4">
          {projects.map((project, idx) => {
            const intent = intents[project.id] ?? "";
            const words = intent.trim().split(/\s+/).filter(Boolean);
            const isValid = words.length >= 2;
            const domainColor = getDomainColor(project.domain);

            return (
              <div
                key={project.id}
                className="feature-card p-5 transition-all duration-200"
                style={{
                  borderLeft: `3px solid ${domainColor}`,
                }}
              >
                {/* Project header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold truncate">
                        {project.name}
                      </h3>
                      {project.domain && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${domainColor}15`,
                            color: domainColor,
                          }}
                        >
                          {project.domain}
                        </span>
                      )}
                    </div>

                    {/* Tech stack */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {project.techStack.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium"
                        >
                          {tech}
                        </span>
                      ))}
                      {project.techStack.length > 4 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          +{project.techStack.length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Completion indicator */}
                  <div className="ml-3 flex-shrink-0">
                    {isValid ? (
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  {(project.stars ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" /> {project.stars}
                    </span>
                  )}
                  {(project.forks ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <GitFork className="w-3 h-3" /> {project.forks}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {project.projectType === "collaborative"
                      ? `Team (${project.collaborators})`
                      : "Solo"}
                  </span>
                </div>

                {/* AI description preview (if available) */}
                {project.aiDescription && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3 border border-border/50">
                    <span className="font-medium text-primary">AI Preview:</span>{" "}
                    {project.aiDescription}
                  </div>
                )}

                {/* Intent input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    What does this project do?
                  </label>
                  <Input
                    value={intent}
                    onChange={(e) => updateIntent(project.id, e.target.value)}
                    placeholder="e.g. Real-time chat application, ML sentiment analyzer"
                    className={`transition-all ${
                      intent.length > 0 && !isValid
                        ? "border-amber-400 focus:border-amber-500"
                        : ""
                    }`}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {words.length}/2 words minimum
                    {words.length >= 2 && words.length <= 8 && " ✓"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI info box */}
        <div className="feature-card p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">AI will generate for each project:</p>
              <ul className="mt-1 text-muted-foreground space-y-0.5 text-xs">
                <li>• Professional project descriptions</li>
                <li>• Resume-ready bullet points</li>
                <li>• Skills & complexity analysis</li>
                <li>• What makes each project unique</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3 text-center">{error}</p>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filledCount}/{projects.length} projects described
          </p>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !allValid}
            className="min-w-[200px]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 w-4 h-4" />
                Generate & Continue
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
