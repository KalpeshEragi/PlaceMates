"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2, FileText, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { integrationsApi } from "@/lib/api/integrations-api";
import { resumeApi } from "@/lib/api/resume-api";

interface Step1Props {
  onNext: () => void;
}

export default function Step1Connect({ onNext }: Step1Props) {
  const searchParams = useSearchParams();
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await integrationsApi.getStatus();
        setGithubConnected(status.githubConnected);
      } catch (err) {
        console.error("[Step1] Failed to fetch status:", err);
        setError("Unable to load GitHub status.");
      }
    }

    checkStatus();
  }, [searchParams]);

  const handleGithubConnect = () => {
    setGithubLoading(true);
    setError(null);
    integrationsApi.redirectToGithubConnect();
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF resumes are supported at this time.");
      return;
    }

    setResumeLoading(true);
    setError(null);

    try {
      // 1. Upload PDF
      await resumeApi.uploadResume(file);
      // 2. Trigger analysis
      await resumeApi.analyzeResume();
      // 3. Reload to let OnboardingFlow fetch status and route to Step2Processing
      window.location.reload();
    } catch (err) {
      console.error("[Step1] Resume upload failed:", err);
      setError(err instanceof Error ? err.message : "Failed to upload resume");
      setResumeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-3xl" />
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Step 1 of 6
            </p>
            <h1 className="text-4xl font-bold">
              Choose your <span className="gradient-text">Data Source</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Connect your GitHub to import repositories, or upload an existing resume.
            </p>
          </div>

          <div className="feature-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Image src="/images/github.png" alt="GitHub" width={24} height={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">GitHub integration</h3>
                <p className="text-sm text-muted-foreground">
                  Fetch repos, tech stack, and contribution patterns.
                </p>
              </div>
            </div>

            {githubConnected ? (
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                GitHub connected
              </div>
            ) : (
              <Button
                className="w-full rounded-xl h-12"
                onClick={handleGithubConnect}
                disabled={githubLoading || resumeLoading}
              >
                {githubLoading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  "Connect GitHub"
                )}
              </Button>
            )}
            {githubConnected && (
              <Button onClick={onNext} className="w-full rounded-xl h-11">
                Continue to LinkedIn Upload
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-border flex-1" />
            <span className="text-muted-foreground text-sm font-medium uppercase">Or alternative flow</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <div className="feature-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Upload Resume</h3>
                <p className="text-sm text-muted-foreground">
                  Skip GitHub and LinkedIn. We'll parse your existing PDF resume directly.
                </p>
              </div>
            </div>

            <input 
              type="file" 
              accept=".pdf,application/pdf"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleResumeUpload}
            />

            <Button
              variant="outline"
              className="w-full rounded-xl h-12 border-teal-200 hover:bg-teal-50 hover:text-teal-900"
              onClick={() => fileInputRef.current?.click()}
              disabled={githubLoading || resumeLoading}
            >
              {resumeLoading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 w-4 h-4" />
                  Upload PDF Resume
                </>
              )}
            </Button>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
        </div>

        <div className="relative hidden lg:flex justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-teal-500/20 rounded-3xl blur-2xl" />
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/50">
            <Image
              src="/images/onboarding-illustration.png"
              alt="Onboarding"
              width={500}
              height={400}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}