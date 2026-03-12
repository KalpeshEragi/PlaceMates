"use client";

import { useAuth } from "@/lib/auth-context";
import { connectApi } from "@/lib/api/connect-api";
import { githubApi } from "@/lib/api/github-api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Github,
    Linkedin,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ArrowRight,
    Upload,
    Link2,
    ShieldCheck,
    ChevronDown,
    ExternalLink,
    FileArchive,
    ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type CardState = "idle" | "loading" | "success" | "error";

export default function ConnectAccountsPage() {
    const { user, loading, refreshUser } = useAuth();
    const router = useRouter();

    // ── Card expansion state ───────────────────────────────
    const [expandedCard, setExpandedCard] = useState<"github" | "linkedin" | null>(null);

    // ── GitHub state ────────────────────────────────────────
    const [githubUrl, setGithubUrl] = useState("");
    const [githubState, setGithubState] = useState<CardState>("idle");
    const [githubError, setGithubError] = useState("");

    // ── GitHub Sync & Analyze state ─────────────────────────
    const [isSyncingGithub, setIsSyncingGithub] = useState(false);
    const [isAnalyzingGithub, setIsAnalyzingGithub] = useState(false);
    const [hasSynced, setHasSynced] = useState(false);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);

    // ── LinkedIn state ──────────────────────────────────────
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [linkedinState, setLinkedinState] = useState<CardState>("idle");
    const [linkedinError, setLinkedinError] = useState("");
    const [showZipUpload, setShowZipUpload] = useState(false);
    const [zipFile, setZipFile] = useState<File | null>(null);
    const [zipState, setZipState] = useState<CardState>("idle");
    const [zipError, setZipError] = useState("");

    // ── Mouse position for dynamic gradient ─────────────────
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!loading && !user) router.replace("/Authentication");
    }, [user, loading, router]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // ── Derive connection status from state to force re-login per session ──
    const [githubConnected, setGithubConnected] = useState(false);
    const [linkedinConnected, setLinkedinConnected] = useState(false);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.get("github") === "connected") {
            setGithubConnected(true);
        }
    }, []);

    // Continue is enabled only when GitHub connected + synced + analyzed + LinkedIn connected
    const canContinue = githubConnected && hasSynced && hasAnalyzed && linkedinConnected;

    // ── GitHub URL connect handler ──────────────────────────
    function handleGitHubConnect() {
        if (!githubUrl.trim()) return;

        // Validate GitHub URL
        const ghRegex = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/;
        if (!ghRegex.test(githubUrl.trim())) {
            setGithubState("error");
            setGithubError("Invalid GitHub URL. Expected format: https://github.com/username");
            return;
        }

        setGithubState("loading");
        setGithubError("");

        // Redirect to OAuth flow — the GitHub OAuth will link the account
        const token = localStorage.getItem("token");
        window.location.href = `${API_BASE}/auth/github?token=${token}`;
    }

    // ── GitHub Sync handler ─────────────────────────────────
    async function handleGithubSync() {
        setIsSyncingGithub(true);
        try {
            const { syncedCount } = await githubApi.syncRepos();
            setHasSynced(true);

            // Show a brief visual confirmation (optional: could add toast here)
            console.log(`Synced ${syncedCount} repositories`);
        } catch (error) {
            console.error("GitHub sync failed:", (error as Error).message);
        } finally {
            setIsSyncingGithub(false);
        }
    }

    // ── GitHub Analyze handler ──────────────────────────────
    async function handleGithubAnalyze() {
        setIsAnalyzingGithub(true);
        try {
            await githubApi.analyzeRepos();
            setHasAnalyzed(true);
        } catch (error) {
            console.error("Analysis failed:", (error as Error).message);
        } finally {
            setIsAnalyzingGithub(false);
        }
    }

    // ── LinkedIn URL submit handler ─────────────────────────
    // NOTE: Apify API limit is exhausted, so we always redirect to ZIP upload
    function handleLinkedInUrl() {
        if (!linkedinUrl.trim()) return;

        // Validate LinkedIn URL format
        const liRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/;
        if (!liRegex.test(linkedinUrl.trim())) {
            setLinkedinState("error");
            setLinkedinError("Invalid LinkedIn URL. Expected format: https://www.linkedin.com/in/your-username");
            return;
        }

        // API scraper is temporarily disabled — redirect to ZIP upload
        setLinkedinState("error");
        setLinkedinError("LinkedIn API scraping is temporarily unavailable. Please upload your LinkedIn data ZIP instead.");
        setShowZipUpload(true);
    }

    // ── LinkedIn ZIP upload handler ─────────────────────────
    async function handleZipUpload() {
        if (!zipFile) return;

        setZipState("loading");
        setZipError("");

        const result = await connectApi.uploadLinkedInZip(zipFile);

        if (result.success) {
            setZipState("success");
            setLinkedinState("success");
            setShowZipUpload(false);
            setLinkedinConnected(true);
            await refreshUser();
        } else {
            setZipState("error");
            setZipError(result.error || "Failed to process ZIP file");
        }
    }

    // ── Loading / unauthenticated ───────────────────────────
    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background overflow-hidden">
            {/* Dynamic cursor gradient */}
            <div
                className="fixed inset-0 pointer-events-none z-0 opacity-30"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.15), transparent 40%)`,
                }}
            />

            {/* Decorative orbs */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />
            </div>

            {/* Navigation */}
            <nav className="relative z-50 bg-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
                    <Link
                        href="/"
                        className="flex items-center gap-3 group cursor-pointer"
                    >
                        <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            P
                            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            PlaceMate
                        </span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                </div>
            </nav>

            {/* Main content */}
            <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
                {/* Header */}
                <div className="text-center mb-12 space-y-4">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                        Connect Your{" "}
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Accounts
                        </span>
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                        Link your GitHub and LinkedIn to unlock AI-powered profile building,
                        resume generation, and interview prep.
                    </p>
                </div>

                {/* Cards — side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* ─── GitHub Card ─── */}
                    <div
                        className={`relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer ${githubConnected
                            ? "border-emerald-500/50 bg-emerald-500/5"
                            : expandedCard === "github"
                                ? "border-border/80 bg-muted/40 backdrop-blur-xl shadow-2xl"
                                : "border-border/50 bg-muted/20 backdrop-blur-xl hover:bg-muted/30 hover:border-border/70"
                            }`}
                        onClick={() => {
                            if (expandedCard !== "github") {
                                setExpandedCard("github");
                            } else {
                                setExpandedCard(null);
                            }
                        }}
                    >
                        {/* Top accent */}
                        <div className={`absolute top-0 inset-x-0 h-0.5 ${githubConnected
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-gray-500 to-gray-700"
                            }`} />

                        <div className="p-6">
                            {/* Header row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 ${githubConnected
                                        ? "bg-emerald-500/20"
                                        : "bg-[#24292e]"
                                        }`}>
                                        {githubConnected ? (
                                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                        ) : (
                                            <Github className="w-6 h-6 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold">GitHub</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {githubConnected
                                                ? "Connected successfully"
                                                : "Import your repos & activity"}
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown
                                    className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${expandedCard === "github" ? "rotate-180" : ""
                                        }`}
                                />
                            </div>

                            <div
                                className={`overflow-hidden transition-all duration-500 ease-in-out ${expandedCard === "github"
                                    ? "max-h-[600px] opacity-100 mt-6"
                                    : "max-h-0 opacity-0"
                                    }`}
                            >
                                <div
                                    className={`pt-6 border-t space-y-4 ${githubConnected ? "border-emerald-500/20" : "border-border/40"
                                        }`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {!githubConnected ? (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                                    <Link2 className="w-4 h-4 text-muted-foreground" />
                                                    GitHub Profile URL
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="url"
                                                        value={githubUrl}
                                                        onChange={(e) => setGithubUrl(e.target.value)}
                                                        placeholder="https://github.com/your-username"
                                                        className="flex-1 h-12 px-4 rounded-xl border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm"
                                                        disabled={githubState === "loading"}
                                                    />
                                                    <Button
                                                        className="h-12 px-5 rounded-xl bg-[#24292e] text-white hover:bg-[#333] font-semibold shadow-lg transition-all"
                                                        onClick={handleGitHubConnect}
                                                        disabled={githubState === "loading" || !githubUrl.trim()}
                                                    >
                                                        {githubState === "loading" ? (
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                        ) : (
                                                            "Connect"
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Error */}
                                            {githubState === "error" && (
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                                                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                                                    <p className="text-sm text-destructive font-medium">
                                                        {githubError}
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-3">
                                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                                    Required Steps
                                                </p>
                                                <div className="flex flex-col gap-3 sm:flex-row">
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleGithubSync}
                                                        disabled={isSyncingGithub || isAnalyzingGithub}
                                                        className={`flex-1 h-12 rounded-xl font-medium shadow-sm transition-all ${hasSynced
                                                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                                            : "bg-[#24292e] text-white border-transparent hover:bg-[#333]"
                                                            }`}
                                                    >
                                                        {isSyncingGithub ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Syncing Accounts…
                                                            </>
                                                        ) : hasSynced ? (
                                                            <>
                                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                Repos Synced
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Github className="mr-2 h-4 w-4" />
                                                                Sync GitHub Repositories
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleGithubAnalyze}
                                                        disabled={isAnalyzingGithub || isSyncingGithub || !hasSynced}
                                                        className={`flex-1 h-12 rounded-xl font-medium shadow-sm transition-all ${hasAnalyzed
                                                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                                            : hasSynced && !hasAnalyzed
                                                                ? "bg-indigo-600 text-white border-transparent hover:bg-indigo-700"
                                                                : "bg-muted text-muted-foreground border-border/40"
                                                            }`}
                                                    >
                                                        {isAnalyzingGithub ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Analyzing Details…
                                                            </>
                                                        ) : hasAnalyzed ? (
                                                            <>
                                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                Analysis Complete
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                Analyze Repositories
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                                {!hasSynced && (
                                                    <p className="text-xs text-amber-400/80">
                                                        ⚠ You must sync and analyze your repositories before continuing.
                                                    </p>
                                                )}
                                                {hasSynced && !hasAnalyzed && (
                                                    <p className="text-xs text-amber-400/80">
                                                        ⚠ Now analyze your repositories to continue.
                                                    </p>
                                                )}
                                                {hasSynced && hasAnalyzed && (
                                                    <p className="text-xs text-emerald-400">
                                                        ✓ GitHub setup complete!
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── LinkedIn Card ─── */}
                    <div
                        className={`relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer ${linkedinConnected
                            ? "border-emerald-500/50 bg-emerald-500/5"
                            : expandedCard === "linkedin"
                                ? "border-border/80 bg-muted/40 backdrop-blur-xl shadow-2xl"
                                : "border-border/50 bg-muted/20 backdrop-blur-xl hover:bg-muted/30 hover:border-border/70"
                            }`}
                        onClick={() => {
                            if (expandedCard !== "linkedin") {
                                setExpandedCard("linkedin");
                            } else {
                                setExpandedCard(null);
                            }
                        }}
                    >
                        {/* Top accent */}
                        <div className={`absolute top-0 inset-x-0 h-0.5 ${linkedinConnected
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-[#0077B5] to-[#00A0DC]"
                            }`} />

                        <div className="p-6">
                            {/* Header row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 ${linkedinConnected
                                        ? "bg-emerald-500/20"
                                        : "bg-[#0077B5]"
                                        }`}>
                                        {linkedinConnected ? (
                                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                        ) : (
                                            <Linkedin className="w-6 h-6 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold">LinkedIn</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {linkedinConnected
                                                ? "Connected successfully"
                                                : "Import your professional profile"}
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown
                                    className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${expandedCard === "linkedin" ? "rotate-180" : ""
                                        }`}
                                />
                            </div>

                            {/* Expanded content */}
                            <div
                                className={`overflow-hidden transition-all duration-500 ease-in-out ${expandedCard === "linkedin"
                                    ? "max-h-[600px] opacity-100 mt-6"
                                    : "max-h-0 opacity-0"
                                    }`}
                            >
                                <div
                                    className="pt-6 border-t border-border/40 space-y-5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* URL Input Section — kept visible but API disabled */}
                                    {!showZipUpload && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                                    <Link2 className="w-4 h-4 text-[#0077B5]" />
                                                    LinkedIn Profile URL
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="url"
                                                        value={linkedinUrl}
                                                        onChange={(e) => setLinkedinUrl(e.target.value)}
                                                        placeholder="https://www.linkedin.com/in/your-username"
                                                        className="flex-1 h-12 px-4 rounded-xl border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm"
                                                        disabled={linkedinState === "loading"}
                                                    />
                                                    <Button
                                                        className="h-12 px-5 rounded-xl bg-[#0077B5] text-white hover:bg-[#005f8e] font-semibold shadow-lg transition-all"
                                                        onClick={handleLinkedInUrl}
                                                        disabled={linkedinState === "loading" || !linkedinUrl.trim()}
                                                    >
                                                        {linkedinState === "loading" ? (
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                        ) : (
                                                            "Connect"
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Error message — will show API disabled message */}
                                            {linkedinState === "error" && (
                                                <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                                                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                                    <div className="space-y-1">
                                                        <p className="text-sm text-destructive font-medium">
                                                            {linkedinError}
                                                        </p>
                                                        <button
                                                            className="text-sm text-primary hover:underline font-medium flex items-center gap-1"
                                                            onClick={() => setShowZipUpload(true)}
                                                        >
                                                            Upload LinkedIn ZIP instead
                                                            <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Success */}
                                            {linkedinState === "success" && (
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                        LinkedIn profile imported successfully!
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* ZIP Upload Section */}
                                    {showZipUpload && (
                                        <div className="space-y-4">
                                            <button
                                                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                                onClick={() => {
                                                    setShowZipUpload(false);
                                                    setZipError("");
                                                    setLinkedinState("idle");
                                                    setLinkedinError("");
                                                }}
                                            >
                                                <ArrowLeft className="w-3 h-3" />
                                                Back to URL import
                                            </button>

                                            {/* Instructions */}
                                            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-2">
                                                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                    <FileArchive className="w-4 h-4 text-[#0077B5]" />
                                                    How to download your LinkedIn data
                                                </h4>
                                                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                                                    <li>Go to LinkedIn → <strong>Settings &amp; Privacy</strong></li>
                                                    <li>Click <strong>Data Privacy</strong> → <strong>Get a copy of your data</strong></li>
                                                    <li>Select <strong>&quot;Want something in particular?&quot;</strong> and check all boxes</li>
                                                    <li>Click <strong>Request archive</strong> — you&apos;ll receive an email</li>
                                                    <li>Download the ZIP file and upload it below</li>
                                                </ol>
                                                <a
                                                    href="https://www.linkedin.com/mypreferences/d/download-my-data"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    Open LinkedIn Data Export page
                                                </a>
                                            </div>

                                            {/* File upload */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                                    <Upload className="w-4 h-4 text-[#0077B5]" />
                                                    Upload LinkedIn ZIP
                                                </label>
                                                <div className="flex gap-2">
                                                    <label className="flex-1 h-12 flex items-center px-4 rounded-xl border border-dashed border-border/60 bg-background/50 text-sm text-muted-foreground hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer">
                                                        <FileArchive className="w-4 h-4 mr-2 shrink-0" />
                                                        <span className="truncate">
                                                            {zipFile ? zipFile.name : "Choose .zip file…"}
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept=".zip"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const f = e.target.files?.[0];
                                                                if (f) setZipFile(f);
                                                            }}
                                                        />
                                                    </label>
                                                    <Button
                                                        className="h-12 px-5 rounded-xl bg-[#0077B5] text-white hover:bg-[#005f8e] font-semibold shadow-lg transition-all"
                                                        onClick={handleZipUpload}
                                                        disabled={zipState === "loading" || !zipFile}
                                                    >
                                                        {zipState === "loading" ? (
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                        ) : (
                                                            "Upload"
                                                        )}
                                                    </Button>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground/60 italic pl-1">
                                                    Note: Large ZIP files may take a moment to upload.
                                                </p>
                                            </div>

                                            {/* ZIP errors */}
                                            {zipState === "error" && (
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                                                    <AlertCircle className="w-4 h-4 text-destructive" />
                                                    <p className="text-sm text-destructive font-medium">
                                                        {zipError}
                                                    </p>
                                                </div>
                                            )}

                                            {/* ZIP success */}
                                            {zipState === "success" && (
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                        LinkedIn data imported from ZIP successfully!
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Continue to Dashboard → now goes to Insights */}
                <div className="mt-10 text-center space-y-4">
                    <Button
                        size="lg"
                        className={`px-10 h-14 rounded-full text-lg font-semibold shadow-xl transition-all duration-300 group ${canContinue
                            ? "bg-foreground text-background hover:bg-foreground/90 hover:-translate-y-1 hover:shadow-2xl"
                            : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                            }`}
                        disabled={!canContinue}
                        onClick={() => router.push("/dashboard/insights")}
                    >
                        Continue to Dashboard
                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    {!canContinue && (
                        <p className="text-xs text-muted-foreground">
                            {!githubConnected
                                ? "Connect your GitHub account to continue"
                                : !hasSynced || !hasAnalyzed
                                    ? "Sync and analyze your GitHub repositories to continue"
                                    : "Connect your LinkedIn account to continue"}
                        </p>
                    )}
                </div>

                {/* Trust footer */}
                <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Your data is securely encrypted and never shared with third parties</span>
                </div>
            </main>
        </div>
    );
}
