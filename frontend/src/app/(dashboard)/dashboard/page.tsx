"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, FileDown, Loader2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingApi } from "@/lib/api/onboarding-api";

export default function DashboardPage() {
  const router = useRouter();
  const [portfolioUrl, setPortfolioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reRunning, setReRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/Authentication");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { portfolioUrl: url } = await onboardingApi.getPortfolioUrl();
        if (!cancelled) setPortfolioUrl(url);
      } catch {
        if (!cancelled) setPortfolioUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleRerun = async () => {
    setReRunning(true);
    setMessage(null);
    try {
      const res = await onboardingApi.triggerGithubAnalysis();
      setMessage(res.message || "Analysis started.");
    } catch (e) {
      setMessage((e as Error).message || "Could not start analysis.");
    } finally {
      setReRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Access your public portfolio, resume, and editing tools.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium">Live portfolio</p>
              <p className="text-sm text-muted-foreground truncate max-w-md">
                {portfolioUrl ?? "Portfolio URL not available yet."}
              </p>
            </div>
            {portfolioUrl ? (
              <Button asChild>
                <a href={portfolioUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open
                </a>
              </Button>
            ) : (
              <Button disabled>Open</Button>
            )}
          </div>

          <div className="rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium">Resume</p>
              <p className="text-sm text-muted-foreground">Print or save as PDF from the preview page.</p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/resume/preview">
                <FileDown className="w-4 h-4 mr-2" />
                Resume preview
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium">Edit content</p>
              <p className="text-sm text-muted-foreground">Summary, bullets, skills, and templates.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/onboarding?edit=content">
                <Pencil className="w-4 h-4 mr-2" />
                Open editor
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium">Re-run GitHub analysis</p>
              <p className="text-sm text-muted-foreground">Refresh repo insights and project bullets.</p>
            </div>
            <Button variant="outline" onClick={handleRerun} disabled={reRunning}>
              {reRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run analysis
                </>
              )}
            </Button>
          </div>
        </div>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
