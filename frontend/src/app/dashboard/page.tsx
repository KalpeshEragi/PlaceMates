"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Github, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth-context";
import { integrationsApi, type IntegrationStatus } from "@/lib/api/integrations-api";
import { githubApi } from "@/lib/api/github-api";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<IntegrationStatus>({
    github_connected: false,
    linkedin_uploaded: false,
  });
  const [statusLoading, setStatusLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [isAnalyzingGithub, setIsAnalyzingGithub] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/Authentication");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const github = searchParams.get("github");
    const error = searchParams.get("error");

    if (github === "connected") {
      toast({
        title: "GitHub connected",
        description: "Your GitHub account is now connected.",
      });
    }

    if (error) {
      toast({
        title: "Integration error",
        description: error,
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    async function loadStatus() {
      setStatusLoading(true);
      try {
        const data = await integrationsApi.getStatus();
        if (active) {
          setStatus(data);
        }
      } catch (error) {
        if (active) {
          toast({
            title: "Failed to load status",
            description: (error as Error).message,
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setStatusLoading(false);
        }
      }
    }

    loadStatus();
    return () => {
      active = false;
    };
  }, [user, toast]);

  async function handleLinkedinUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a ZIP file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      await integrationsApi.uploadLinkedinZip(file);
      const updated = await integrationsApi.getStatus();
      setStatus(updated);
      toast({
        title: "Upload complete",
        description: "LinkedIn ZIP Uploaded",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function handleGithubConnect() {
    try {
      integrationsApi.redirectToGithubConnect();
    } catch (error) {
      toast({
        title: "Authentication required",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  }

  async function handleGithubSync() {
    setIsSyncingGithub(true);
    try {
      const { syncedCount } = await githubApi.syncRepos();

      toast({
        title: "GitHub synced",
        description: `Successfully synced ${syncedCount} repositories from GitHub.`,
      });

      // Refresh integration status so UI reflects any connection changes.
      try {
        const updated = await integrationsApi.getStatus();
        setStatus(updated);
      } catch {
        // Ignore status refresh errors; primary action already succeeded.
      }
    } catch (error) {
      toast({
        title: "GitHub sync failed",
        description: (error as Error).message,
        variant: "destructive",
      });

      // If token expired, the backend sets github_connected = false.
      // Refresh status to reflect that in the UI.
      try {
        const updated = await integrationsApi.getStatus();
        setStatus(updated);
      } catch {
        // best-effort
      }
    } finally {
      setIsSyncingGithub(false);
    }
  }

  async function handleGithubAnalyze() {
    // #region agent log
    fetch("http://127.0.0.1:7372/ingest/e3b54500-4740-42e0-928d-c8b2cad6f3e9", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ce8545",
      },
      body: JSON.stringify({
        sessionId: "ce8545",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "frontend/dashboard/page.tsx:handleGithubAnalyze",
        message: "handleGithubAnalyze invoked",
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    setIsAnalyzingGithub(true);
    try {
      await githubApi.analyzeRepos();
      // #region agent log
      fetch("http://127.0.0.1:7372/ingest/e3b54500-4740-42e0-928d-c8b2cad6f3e9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "ce8545",
        },
        body: JSON.stringify({
          sessionId: "ce8545",
          runId: "pre-fix",
          hypothesisId: "H2",
          location: "frontend/dashboard/page.tsx:handleGithubAnalyze",
          message: "githubApi.analyzeRepos success",
          data: {},
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log

      toast({
        title: "Analysis started",
        description: "Repository analysis has been queued. This may take a few minutes.",
      });
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7372/ingest/e3b54500-4740-42e0-928d-c8b2cad6f3e9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "ce8545",
        },
        body: JSON.stringify({
          sessionId: "ce8545",
          runId: "pre-fix",
          hypothesisId: "H3",
          location: "frontend/dashboard/page.tsx:handleGithubAnalyze",
          message: "githubApi.analyzeRepos error",
          data: {
            message: (error as Error).message,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log

      toast({
        title: "Analysis failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingGithub(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Connect GitHub and upload your LinkedIn export ZIP to finish integrations.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>GitHub OAuth</CardTitle>
              <CardDescription>Connect your GitHub account using GitHub OAuth.</CardDescription>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : status.github_connected ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>GitHub Connected</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={handleGithubSync}
                      disabled={isSyncingGithub || isAnalyzingGithub}
                      className="w-full sm:w-fit"
                    >
                      {isSyncingGithub ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing GitHub Repositories...
                        </>
                      ) : (
                        <>
                          <Github className="mr-2 h-4 w-4" />
                          Sync GitHub Repositories
                        </>
                      )}
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleGithubAnalyze}
                      disabled={isAnalyzingGithub || isSyncingGithub}
                      className="w-full sm:w-fit"
                    >
                      {isAnalyzingGithub ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing Repositories…
                        </>
                      ) : (
                        <>
                          <Loader2 className="mr-2 h-4 w-4" />
                          Analyze Repositories
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={handleGithubConnect}>
                  <Github className="mr-2 h-4 w-4" />
                  Connect GitHub
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>LinkedIn ZIP Upload</CardTitle>
              <CardDescription>Upload your LinkedIn data export ZIP file.</CardDescription>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : status.linkedin_uploaded ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>LinkedIn ZIP Uploaded</span>
                </div>
              ) : (
                <div className="relative w-full">
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    onChange={handleLinkedinUpload}
                    disabled={isUploading}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <Button variant="outline" disabled={isUploading} className="w-full">
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload LinkedIn ZIP
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
