"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, ExternalLink, FileDown, Loader2, Pencil } from "lucide-react";
import { onboardingApi } from "@/lib/api/onboarding-api";

export default function Step5Done() {
  const [copied, setCopied] = useState(false);
  const [portfolioUrl, setPortfolioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const data = await onboardingApi.getPortfolioUrl();
        setPortfolioUrl(data.portfolioUrl);
      } catch (err) {
        console.error("[Step5] Failed to fetch portfolio:", err);
        setError((err as Error).message || "Failed to load portfolio URL");
        // Fallback URL
        setPortfolioUrl("#");
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio();
  }, []);

  const handleCopy = async () => {
    if (!portfolioUrl) return;
    await navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Setting up your portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-6">
      {/* 🌈 Glow */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative max-w-xl w-full text-center space-y-10">
        {/* ✅ ICON */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-600 w-10 h-10" />
          </div>
        </div>

        {/* 🎉 TITLE */}
        <div>
          <h1 className="text-3xl font-semibold">
            Your profile is ready 🚀
          </h1>
          <p className="text-muted-foreground mt-2">
            Your portfolio and resume are generated successfully
          </p>
        </div>

        {/* 🔗 LINK BOX */}
        {portfolioUrl && portfolioUrl !== "#" && (
          <div className="feature-card p-4 flex items-center justify-between gap-3">
            <span className="text-sm truncate">{portfolioUrl}</span>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-primary text-sm"
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Button
            className="rounded-xl h-11 flex items-center gap-2"
            onClick={() =>
              portfolioUrl && window.open(portfolioUrl, "_blank")
            }
            disabled={!portfolioUrl || portfolioUrl === "#"}
          >
            <ExternalLink className="w-4 h-4" />
            View live portfolio
          </Button>

          <Button
            variant="secondary"
            className="rounded-xl h-11 flex items-center gap-2"
            onClick={() => {
              window.location.href = "/resume/preview";
            }}
          >
            <FileDown className="w-4 h-4" />
            Resume (print / PDF)
          </Button>

          <Button
            variant="outline"
            className="rounded-xl h-11 flex items-center gap-2"
            onClick={() => {
              window.location.href = "/onboarding?edit=content";
            }}
          >
            <Pencil className="w-4 h-4" />
            Edit content
          </Button>

          <Button
            variant="outline"
            className="rounded-xl h-11"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
          >
            Dashboard
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Use your browser&apos;s print dialog on the resume page to save a PDF.
        </p>
      </div>
    </div>
  );
}