"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2, Github, ArrowLeft, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { githubApi, type GithubRepo } from "@/lib/api/github-api";
import { useToast } from "@/components/ui/use-toast";

export default function GithubReposPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [fetching, setFetching] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.replace("/Authentication");
    return null;
  }

  async function handleFetchRepos() {
    setFetching(true);
    try {
      const data = await githubApi.listRepos();
      setRepos(data);
      toast({
        title: "Repositories loaded",
        description: `Fetched ${data.length} repositories from GitHub.`,
      });
    } catch (error) {
      toast({
        title: "Failed to fetch repos",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold flex items-center gap-2">
              <Github className="h-7 w-7" />
              GitHub Repositories (Test)
            </h1>
            <p className="text-muted-foreground">
              This page tests the GitHub OAuth integration by fetching your repositories
              from the backend using your stored access token.
            </p>
          </div>
          <Button
            variant="ghost"
            className="flex items-center gap-1"
            asChild
          >
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Fetch your repositories</CardTitle>
              <CardDescription>
                Make sure GitHub is connected on the dashboard, then click the button
                below to fetch your repos via the backend.
              </CardDescription>
            </div>
            <Button onClick={handleFetchRepos} disabled={fetching}>
              {fetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Github className="mr-2 h-4 w-4" />
                  Fetch Repos
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {repos === null ? (
              <p className="text-sm text-muted-foreground">
                No repositories loaded yet. Click &quot;Fetch Repos&quot; to load data
                from GitHub.
              </p>
            ) : repos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No repositories found for your GitHub account.
              </p>
            ) : (
              <div className="space-y-3">
                {repos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-start justify-between rounded-md border bg-card px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{repo.full_name}</span>
                        {repo.private && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                            Private
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {repo.language && (
                          <span>Language: {repo.language}</span>
                        )}
                        <span>⭐ {repo.stargazers_count}</span>
                        <span>🍴 {repo.forks_count}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      asChild
                    >
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${repo.full_name} on GitHub`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

