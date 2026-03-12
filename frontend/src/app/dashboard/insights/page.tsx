'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    BarChart3,
    Code2,
    ExternalLink,
    Flame,
    Globe,
    Loader2,
    Sparkles,
    Star,
    TrendingUp,
    Zap,
    AlertCircle,
    GitBranch,
    Activity,
    Linkedin,
} from 'lucide-react';
import {
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import {
    githubApi,
    type InsightsResponse,
    type InsightProject,
    type InsightSkill,
    type InsightDomain,
    type InsightRepository,
    type GitHubActivityResponse,
} from '@/lib/api/github-api';
import { linkedinApi, type LinkedinInsightsResponse } from '@/lib/api/linkedin-api';
import LinkedinInsightsView, {
    LinkedinInsightsSkeleton,
    LinkedinEmptyState,
    LinkedinErrorState,
} from '@/components/linkedin-insights';

/* ── Helpers ────────────────────────────────────────────── */

function formatLoc(loc: number | null): string {
    if (loc == null) return '—';
    if (loc >= 1_000_000) return `${(loc / 1_000_000).toFixed(1)}M`;
    if (loc >= 1_000) return `${(loc / 1_000).toFixed(1)}K`;
    return loc.toLocaleString();
}

function formatScore(score: number | null): string {
    if (score == null) return '—';
    return score.toFixed(1);
}

function getScoreColor(score: number | null): string {
    if (score == null) return 'text-muted-foreground';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
}

function getComplexityLevel(score: number | null): string {
    if (score == null) return 'Unknown';
    if (score >= 80) return 'Advanced';
    if (score >= 60) return 'Intermediate';
    if (score >= 40) return 'Moderate';
    return 'Basic';
}

function getComplexityBadgeClass(score: number | null): string {
    if (score == null) return 'bg-muted text-muted-foreground';
    if (score >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (score >= 40) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
}

const domainColors = [
    'from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-300',
    'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300',
    'from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-300',
    'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300',
    'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-300',
];

/* ── Sub-components ─────────────────────────────────────── */

function ProjectCard({ project, index }: { project: InsightProject; index: number }) {
    return (
        <Card className="group relative overflow-hidden border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative p-5">
                {/* Rank badge */}
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-indigo-300 border border-indigo-500/20">
                    #{index + 1}
                </div>

                <div className="space-y-3">
                    {/* Repo name */}
                    <div className="flex items-center gap-2 pr-10">
                        <GitBranch className="w-4 h-4 text-primary shrink-0" />
                        <a
                            href={project.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                            {project.name}
                        </a>
                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Score</span>
                        <span className={`text-lg font-bold ${getScoreColor(project.finalScore)}`}>
                            {formatScore(project.finalScore)}
                        </span>
                        <span className="text-xs text-muted-foreground">/100</span>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Code2 className="w-3 h-3" />
                            <span>{formatLoc(project.totalLoc)} LOC</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400" />
                            <span>{project.stars}</span>
                        </div>
                    </div>

                    {/* Domain & Complexity */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        {project.detectedDomain && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                                <Globe className="w-3 h-3" />
                                {project.detectedDomain}
                            </span>
                        )}
                        <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${getComplexityBadgeClass(project.finalScore)}`}
                        >
                            {getComplexityLevel(project.finalScore)}
                        </span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function SkillBar({ skill, maxScore }: { skill: InsightSkill; maxScore: number }) {
    const percentage = maxScore > 0 ? Math.min((skill.strengthScore / maxScore) * 100, 100) : 0;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{skill.skillName}</span>
                <span className="text-xs text-muted-foreground">
                    {skill.strengthScore.toFixed(1)}
                </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/10">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function DomainTag({ domain, index }: { domain: InsightDomain; index: number }) {
    const colorClass = domainColors[index % domainColors.length];
    return (
        <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r border ${colorClass} transition-all duration-300 hover:scale-105`}
        >
            <Globe className="w-4 h-4" />
            <span className="font-medium text-sm">{domain.domain}</span>
            <span className="text-xs opacity-70">×{domain.count}</span>
        </div>
    );
}

/* ── Loading Skeleton ───────────────────────────────────── */

function InsightsSkeleton() {
    return (
        <div className="space-y-10">
            {/* Header skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-5 w-96" />
            </div>

            {/* Stats skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="border-0 bg-muted/30">
                        <CardContent className="p-5 space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-8 w-16" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Project cards skeleton */}
            <div>
                <Skeleton className="h-6 w-40 mb-4" />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="border-0 bg-muted/30 p-5 space-y-3">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-8 w-20" />
                            <div className="flex gap-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-12" />
                            </div>
                            <Skeleton className="h-5 w-24 rounded-full" />
                        </Card>
                    ))}
                </div>
            </div>

            {/* Skills skeleton */}
            <div>
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="space-y-1.5">
                            <div className="flex justify-between">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-10" />
                            </div>
                            <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── Empty State ────────────────────────────────────────── */

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center animate-pulse-glow">
                    <BarChart3 className="w-10 h-10 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                </div>
            </div>
            <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-semibold text-foreground">No Insights Yet</h3>
                <p className="text-muted-foreground">
                    Connect your GitHub account, sync your repositories, and run analysis to unlock
                    AI-powered insights about your projects.
                </p>
            </div>
            <Link href="/dashboard">
                <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                    <Zap className="mr-2 w-4 h-4" />
                    Analyze Repositories
                </Button>
            </Link>
        </div>
    );
}

/* ── Error State ────────────────────────────────────────── */

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-semibold text-foreground">Something Went Wrong</h3>
                <p className="text-muted-foreground">{message}</p>
            </div>
            <Button
                onClick={onRetry}
                variant="outline"
                className="rounded-full px-6 border-2 hover:bg-muted/50 transition-all duration-300"
            >
                Try Again
            </Button>
        </div>
    );
}

/* ── Main Page ──────────────────────────────────────────── */

export default function InsightsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // ── Tab state ──
    const [activeTab, setActiveTab] = useState<'github' | 'linkedin'>('github');

    // ── GitHub state ──
    const [data, setData] = useState<InsightsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Activity data for radar + pie charts
    const [activityData, setActivityData] = useState<GitHubActivityResponse | null>(null);
    const [activityLoading, setActivityLoading] = useState(true);

    // ── LinkedIn state ──
    const [linkedinData, setLinkedinData] = useState<LinkedinInsightsResponse | null>(null);
    const [linkedinLoading, setLinkedinLoading] = useState(false);
    const [linkedinError, setLinkedinError] = useState<string | null>(null);
    const [linkedinFetched, setLinkedinFetched] = useState(false);

    async function fetchInsights() {
        setLoading(true);
        setError(null);
        try {
            const result = await githubApi.getInsights();
            setData(result);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }

    async function fetchActivity() {
        setActivityLoading(true);
        try {
            const result = await githubApi.getActivity();
            setActivityData(result);
        } catch (err) {
            console.error('Activity fetch failed:', err);
        } finally {
            setActivityLoading(false);
        }
    }

    async function fetchLinkedinInsights() {
        if (linkedinFetched) return;
        setLinkedinLoading(true);
        setLinkedinError(null);
        try {
            const result = await linkedinApi.getInsights();
            setLinkedinData(result);
            setLinkedinFetched(true);
        } catch (err) {
            setLinkedinError((err as Error).message);
        } finally {
            setLinkedinLoading(false);
        }
    }

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/Authentication');
            return;
        }
        if (user) {
            fetchInsights();
            fetchActivity();
        }
    }, [authLoading, user, router]);

    // Lazy-load LinkedIn data when tab switches
    useEffect(() => {
        if (activeTab === 'linkedin' && user && !linkedinFetched) {
            fetchLinkedinInsights();
        }
    }, [activeTab, user, linkedinFetched]);

    // Auth loading gate
    if (authLoading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const isEmpty =
        data &&
        data.topProjects.length === 0 &&
        data.repositories.length === 0;

    const maxSkillScore =
        data?.topSkills?.length
            ? Math.max(...data.topSkills.map((s) => s.strengthScore))
            : 1;

    const processedRepos = data?.repositories.filter((r) => r.processedAt) ?? [];
    const totalLoc = processedRepos.reduce((sum, r) => sum + (r.totalLoc ?? 0), 0);
    const avgScore =
        processedRepos.length > 0
            ? processedRepos.reduce((sum, r) => sum + (r.finalScore ?? 0), 0) /
            processedRepos.length
            : 0;

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {/* Decorative background blurs — matching landing page */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
                {/* Navigation breadcrumb */}
                <div className="mb-8">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                </div>

                {/* Page header */}
                <div className="mb-10 space-y-2">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20 mb-4">
                        <TrendingUp className="w-4 h-4" />
                        {activeTab === 'github' ? 'Repository Intelligence' : 'Professional Intelligence'}
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                        Your{' '}
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Insights
                        </span>
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        {activeTab === 'github'
                            ? 'AI-powered analysis of your GitHub repositories — skills, scores, and domain intelligence at a glance.'
                            : 'AI-powered analysis of your LinkedIn profile — career timeline, skill validation, and professional intelligence.'}
                    </p>

                    {/* ── GitHub / LinkedIn Toggle ──────────── */}
                    <div className="pt-4 relative z-20">
                        <div className="inline-flex items-center rounded-full bg-muted/50 p-1 border border-border/50">
                            <button
                                onClick={() => setActiveTab('github')}
                                className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                                    activeTab === 'github'
                                        ? 'bg-foreground text-background shadow-lg'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <GitBranch className="w-4 h-4" />
                                GitHub
                            </button>
                            <button
                                onClick={() => setActiveTab('linkedin')}
                                className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                                    activeTab === 'linkedin'
                                        ? 'bg-foreground text-background shadow-lg'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Linkedin className="w-4 h-4" />
                                LinkedIn
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content States */}
                {activeTab === 'github' ? (
                    <>
                {loading ? (
                    <InsightsSkeleton />
                ) : error ? (
                    <ErrorState message={error} onRetry={fetchInsights} />
                ) : isEmpty ? (
                    <EmptyState />
                ) : (
                    <div className="space-y-12">
                        {/* ── Summary Stats ──────────────────────────── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                {
                                    label: 'Repositories',
                                    value: data!.repositories.length.toString(),
                                    icon: GitBranch,
                                    color: 'from-indigo-500/20 to-purple-500/20',
                                },
                                {
                                    label: 'Total LOC',
                                    value: formatLoc(totalLoc),
                                    icon: Code2,
                                    color: 'from-emerald-500/20 to-teal-500/20',
                                },
                                {
                                    label: 'Avg Score',
                                    value: avgScore.toFixed(1),
                                    icon: Flame,
                                    color: 'from-orange-500/20 to-red-500/20',
                                },
                                {
                                    label: 'Skills Found',
                                    value: data!.topSkills.length.toString(),
                                    icon: Sparkles,
                                    color: 'from-blue-500/20 to-cyan-500/20',
                                },
                            ].map((stat) => (
                                <Card
                                    key={stat.label}
                                    className="group border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden relative"
                                >
                                    <div
                                        className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                                    />
                                    <CardContent className="relative p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-background/80 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                                <stat.icon className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground font-medium">
                                                    {stat.label}
                                                </p>
                                                <p className="text-2xl font-bold text-foreground">
                                                    {stat.value}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* ── GitHub Activity Section (Radar + Pie) ──── */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                    <Activity className="w-4 h-4" />
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight">GitHub Activity</h2>
                                {activityData && (
                                    <Badge variant="secondary" className="ml-auto">
                                        {activityData.stats.totalEvents} events · {activityData.stats.activeDays} active days
                                    </Badge>
                                )}
                            </div>

                            {activityLoading ? (
                                <div className="grid md:grid-cols-2 gap-6">
                                    <Card className="border-0 bg-muted/30 p-6">
                                        <Skeleton className="h-6 w-40 mb-4" />
                                        <Skeleton className="h-[300px] w-full rounded-xl" />
                                    </Card>
                                    <Card className="border-0 bg-muted/30 p-6">
                                        <Skeleton className="h-6 w-40 mb-4" />
                                        <Skeleton className="h-[300px] w-full rounded-xl" />
                                    </Card>
                                </div>
                            ) : activityData ? (
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Radar Chart — AI-Scored Dimensions */}
                                    <Card className="border-0 bg-muted/30 overflow-hidden group hover:bg-muted/50 transition-all duration-500">
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <CardContent className="relative p-6">
                                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Developer Profile</h3>
                                            <ResponsiveContainer width="100%" height={320}>
                                                <RadarChart data={activityData.radarData} cx="50%" cy="50%" outerRadius="70%">
                                                    <PolarGrid stroke="rgba(81, 82, 146, 0.15)" />
                                                    <PolarAngleAxis
                                                        dataKey="category"
                                                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                                                    />
                                                    <PolarRadiusAxis
                                                        angle={30}
                                                        domain={[0, 100]}
                                                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }}
                                                        axisLine={false}
                                                    />
                                                    <Radar
                                                        name="Score"
                                                        dataKey="value"
                                                        stroke="#818cf8"
                                                        fill="url(#radarGradient)"
                                                        fillOpacity={0.5}
                                                        strokeWidth={2}
                                                    />
                                                    <defs>
                                                        <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.8} />
                                                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.3} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: 'hsl(var(--background))',
                                                            border: '1px solid hsl(var(--border))',
                                                            borderRadius: '12px',
                                                            padding: '8px 12px',
                                                            fontSize: '13px',
                                                        }}
                                                        formatter={(value: any) => [`${value}/100`, 'Score']}
                                                    />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                            {/* Score pills below radar */}
                                            <div className="flex flex-wrap gap-2 mt-4 justify-center">
                                                {activityData.radarData.map((d) => (
                                                    <span
                                                        key={d.category}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                                                    >
                                                        {d.category}: <strong>{d.value}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Pie Chart — Activity Breakdown */}
                                    <Card className="border-0 bg-muted/30 overflow-hidden group hover:bg-muted/50 transition-all duration-500">
                                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <CardContent className="relative p-6">
                                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Activity Breakdown</h3>
                                            {activityData.pieData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <PieChart>
                                                        <Pie
                                                            data={activityData.pieData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={110}
                                                            paddingAngle={3}
                                                            dataKey="value"
                                                            strokeWidth={0}
                                                        >
                                                            {activityData.pieData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: 'hsl(var(--background))',
                                                                border: '1px solid hsl(var(--border))',
                                                                borderRadius: '12px',
                                                                padding: '8px 12px',
                                                                fontSize: '13px',
                                                            }}
                                                        />
                                                        <Legend
                                                            verticalAlign="bottom"
                                                            iconType="circle"
                                                            iconSize={8}
                                                            formatter={(value: string) => (
                                                                <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>{value}</span>
                                                            )}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                                                    No activity events found
                                                </div>
                                            )}
                                            {/* Top collaborated repos */}
                                            {activityData.stats.topCollaboratedRepos.length > 0 && (
                                                <div className="mt-4 space-y-1.5">
                                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Top Collaborated Repos</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {activityData.stats.topCollaboratedRepos.map((repo) => (
                                                            <span
                                                                key={repo}
                                                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                            >
                                                                {repo}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <Card className="border-0 bg-muted/30">
                                    <CardContent className="p-6 text-center text-muted-foreground">
                                        Unable to load activity data. Make sure GitHub is connected.
                                    </CardContent>
                                </Card>
                            )}
                        </section>

                        {/* ── SECTION A: Top Projects ────────────────── */}
                        {data!.topProjects.length > 0 && (
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                        <Star className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight">Top Projects</h2>
                                    <Badge variant="secondary" className="ml-auto">
                                        Top {data!.topProjects.length}
                                    </Badge>
                                </div>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {data!.topProjects.map((project, i) => (
                                        <ProjectCard key={project.id} project={project} index={i} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── SECTION B: Top Skills ──────────────────── */}
                        {data!.topSkills.length > 0 && (
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight">Top Skills</h2>
                                </div>
                                <Card className="border-0 bg-muted/30">
                                    <CardContent className="p-6">
                                        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
                                            {data!.topSkills.map((skill) => (
                                                <SkillBar
                                                    key={skill.skillName}
                                                    skill={skill}
                                                    maxScore={maxSkillScore}
                                                />
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>
                        )}

                        {/* ── SECTION C: Top Domains ─────────────────── */}
                        {data!.topDomains.length > 0 && (
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                        <Globe className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight">Top Domains</h2>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {data!.topDomains.map((domain, i) => (
                                        <DomainTag key={domain.domain} domain={domain} index={i} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── SECTION D: Top Repositories Table ──────── */}
                        {data!.repositories.length > 0 && (
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                        <BarChart3 className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight">
                                        Top Repositories
                                    </h2>
                                    <Badge variant="secondary" className="ml-auto">
                                        {data!.repositories.length} repos
                                    </Badge>
                                </div>
                                <Card className="border-0 bg-muted/30 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent border-border/50">
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="text-right">LOC</TableHead>
                                                    <TableHead>Domain</TableHead>
                                                    <TableHead className="text-right">Final Score</TableHead>
                                                    <TableHead className="text-right">Stars</TableHead>
                                                    <TableHead className="text-right">Impact</TableHead>
                                                    <TableHead className="text-right">Resume</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data!.repositories.map((repo) => (
                                                    <TableRow
                                                        key={repo.id}
                                                        className="border-border/30 hover:bg-muted/30 transition-colors"
                                                    >
                                                        <TableCell>
                                                            <a
                                                                href={repo.repoUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                                                            >
                                                                {repo.name}
                                                                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                                            </a>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm">
                                                            {formatLoc(repo.totalLoc)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {repo.detectedDomain ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                                                                    {repo.detectedDomain}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span
                                                                className={`font-bold ${getScoreColor(repo.finalScore)}`}
                                                            >
                                                                {formatScore(repo.finalScore)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="inline-flex items-center gap-1">
                                                                <Star className="w-3 h-3 text-yellow-400" />
                                                                <span>{repo.stars}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span
                                                                className={`font-medium ${getScoreColor(repo.impactScore)}`}
                                                            >
                                                                {formatScore(repo.impactScore)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span
                                                                className={`font-medium ${getScoreColor(repo.resumeScore)}`}
                                                            >
                                                                {formatScore(repo.resumeScore)}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </Card>
                            </section>
                        )}
                    </div>
                )}
                    </>
                ) : (
                    /* ── LinkedIn Insights Tab ── */
                    linkedinLoading ? (
                        <LinkedinInsightsSkeleton />
                    ) : linkedinError ? (
                        <LinkedinErrorState message={linkedinError} onRetry={() => { setLinkedinFetched(false); fetchLinkedinInsights(); }} />
                    ) : !linkedinData?.linkedinImported || !linkedinData?.parsedProfile ? (
                        <LinkedinEmptyState />
                    ) : (
                        <LinkedinInsightsView data={linkedinData} />
                    )
                )}
            </div>
        </div>
    );
}
