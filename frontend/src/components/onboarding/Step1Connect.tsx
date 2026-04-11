"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { integrationsApi } from "@/lib/api/integrations-api";

interface Step1Props {
  onNext: () => void;
}

export default function Step1Connect({ onNext }: Step1Props) {
  const searchParams = useSearchParams();
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              Connect <span className="gradient-text">GitHub</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              This enables deterministic repository analysis and project ranking.
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
                disabled={githubLoading}
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
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={onNext} className="rounded-xl h-11" disabled={!githubConnected}>
            Continue to LinkedIn Upload
          </Button>
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