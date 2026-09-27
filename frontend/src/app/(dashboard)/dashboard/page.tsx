"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  FileDown,
  Loader2,
  Pencil,
  RefreshCw,
  Briefcase,
  BarChart3,
  Globe,
  Sparkles,
  ArrowRight,
  Zap,
  User,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingApi } from "@/lib/api/onboarding-api";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
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

  const greeting = user?.profile?.name
    ? `Welcome back, ${user.profile.name.split(" ")[0]}`
    : "Welcome back";

  const quickActions = [
    {
      label: "Job Matches",
      href: "/job-matches",
      icon: Briefcase,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      desc: "View matched jobs",
    },
    {
      label: "Insights",
      href: "/insights",
      icon: BarChart3,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      desc: "Profile analytics",
    },
    {
      label: "Portfolio",
      href: "/portfolio",
      icon: Globe,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      desc: "Edit portfolio",
    },
    {
      label: "Profile",
      href: "/profile",
      icon: User,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      desc: "Edit profile",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 pb-20">
      {/* ── Hero Header ────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-4 right-4 opacity-10">
          <Sparkles className="h-24 w-24 text-primary" />
        </div>
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {greeting} 👋
          </h1>
          <p className="text-muted-foreground mt-1 max-w-lg">
            Your AI-powered career hub. Manage your portfolio, resumes, and job matching from here.
          </p>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group rounded-xl border bg-card p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200"
          >
            <div className={`${action.bg} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
              <action.icon className={`h-5 w-5 ${action.color}`} />
            </div>
            <p className="font-medium text-sm group-hover:text-primary transition-colors">
              {action.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
          </Link>
        ))}
      </div>

      {/* ── Main Cards ─────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Live Portfolio */}
        <div className="rounded-xl border bg-card p-5 space-y-3 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Live Portfolio</p>
              <p className="text-sm text-muted-foreground truncate">
                {portfolioUrl ?? "Not generated yet"}
              </p>
            </div>
          </div>
          {portfolioUrl ? (
            <Button asChild className="w-full" size="sm">
              <a href={portfolioUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Portfolio
              </a>
            </Button>
          ) : (
            <Button disabled className="w-full" size="sm">
              Portfolio Unavailable
            </Button>
          )}
        </div>

        {/* Resume */}
        <div className="rounded-xl border bg-card p-5 space-y-3 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-2.5 rounded-lg">
              <FileDown className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Resume</p>
              <p className="text-sm text-muted-foreground">
                Preview, download, or generate tailored resumes.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="flex-1">
              <Link href="/resume/preview">
                <FileDown className="w-4 h-4 mr-2" />
                Preview
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="/resume">
                <Zap className="w-4 h-4 mr-2" />
                Studio
              </Link>
            </Button>
          </div>
        </div>

        {/* Edit Content */}
        <div className="rounded-xl border bg-card p-5 space-y-3 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/10 p-2.5 rounded-lg">
              <Pencil className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Edit Content</p>
              <p className="text-sm text-muted-foreground">
                Summary, bullets, skills, and templates.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/onboarding?edit=content">
              <Pencil className="w-4 h-4 mr-2" />
              Open Editor
            </Link>
          </Button>
        </div>

        {/* Re-run Analysis */}
        <div className="rounded-xl border bg-card p-5 space-y-3 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-2.5 rounded-lg">
              <RefreshCw className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Re-run Analysis</p>
              <p className="text-sm text-muted-foreground">
                Refresh repo insights and project bullets.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleRerun}
            disabled={reRunning}
          >
            {reRunning ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {reRunning ? "Running..." : "Run Analysis"}
          </Button>
          {message && (
            <p className="text-xs text-muted-foreground">{message}</p>
          )}
        </div>
      </div>

      {/* ── Settings Link ──────────────────────────────── */}
      <Link
        href="/settings"
        className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Settings</p>
            <p className="text-xs text-muted-foreground">
              Theme, account, logout
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}
