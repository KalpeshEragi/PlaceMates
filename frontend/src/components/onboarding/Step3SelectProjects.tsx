"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { onboardingApi, type ProjectDto } from "@/lib/api/onboarding-api";

const MIN = 5;
const MAX = 6;

export default function Step3SelectProjects({
  onNextAction,
}: {
  onNextAction: () => void;
}) {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [status, setStatus] = useState<string>("idle");

  useEffect(() => {
    async function load() {
      try {
        const { projects: list } = await onboardingApi.getProjectCandidates();
        const { analysisStatus } = await onboardingApi.getStatus();
        setProjects(list);
        setStatus(analysisStatus);
      } catch (err) {
        setError((err as Error).message || "Failed to load repositories");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX) next.add(id);
      return next;
    });
  };

  const valid = useMemo(
    () => selected.size >= MIN && selected.size <= MAX,
    [selected],
  );

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = projects.filter((p) => selected.has(p.id)).map((p) => p.id);
      await onboardingApi.selectPortfolioProjects(order);
      onNextAction();
    } catch (err) {
      setError((err as Error).message || "Failed to save selection");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading top repositories...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0 && status === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-red-500">No analyzed repositories yet.</p>
          <p className="text-muted-foreground text-sm">
            Finish GitHub analysis first, then return to onboarding.
          </p>
        </div>
      </div>
    );
  }

  // If projects.length === 0 but status is not success yet (although page routing should prevent this),
  // we can show a brief waiting state instead of erroring out.
  if (projects.length === 0 && status !== "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Waiting for analysis to complete...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative z-10 max-w-2xl w-full px-6 space-y-8">
        <div className="text-center">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Step 4 of 6</p>
          <h2 className="text-2xl font-semibold mt-1">Choose portfolio projects</h2>
          <p className="text-muted-foreground mt-2">
            Pick {MIN}–{MAX} repositories from your top {projects.length}. These power your
            portfolio bullets.
          </p>
        </div>

        <div className="feature-card p-6 space-y-4">
          <ul className="space-y-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-primary"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  disabled={!selected.has(p.id) && selected.size >= MAX}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.repoUrl}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.techStack.slice(0, 5).join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3 text-center">{error}</p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Selected: {selected.size} / {MAX}
            {!valid && selected.size > 0 && (
              <span className="block text-amber-600">
                {selected.size < MIN ? `Select at least ${MIN}` : ""}
              </span>
            )}
          </p>
          <Button onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue to project quiz"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
