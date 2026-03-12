'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Briefcase,
    TrendingUp,
    Sparkles,
    Target,
    Shield,
    Loader2,
    AlertCircle,
    Zap,
    Star,
    BookOpen,
    Lightbulb,
    BarChart3,
    Award,
    RefreshCcw,
    MapPin,
    Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { LinkedinInsightsResponse, LinkedinSkill, LinkedinPosition } from '@/lib/api/linkedin-api';
import { useAuth } from '@/lib/auth-context';

const POLL_INTERVAL_MS = 5_000;   // retry every 5 s
const POLL_TIMEOUT_MS = 120_000; // give up after 2 min

export default function LinkedinInsightsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [data, setData] = useState<LinkedinInsightsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reanalyzing, setReanalyzing] = useState(false);

    // refs so interval/timer don't capture stale state
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasFetched = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    function stopPolling() {
        if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
        if (pollTimeout.current) { clearTimeout(pollTimeout.current); pollTimeout.current = null; }
        // Cancel any in-flight fetch
        abortRef.current?.abort();
        abortRef.current = null;
        setPolling(false);
    }

    async function doFetch(): Promise<LinkedinInsightsResponse> {
        // Each call gets its own AbortController; cancel previous if still running
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'}/api/linkedin/insights`,
            { credentials: 'include', signal: controller.signal }
        );
        if (!res.ok) throw new Error('Failed to fetch LinkedIn insights');
        return res.json();
    }

    async function fetchInsights() {
        stopPolling();
        setLoading(true);
        setError(null);
        try {
            const result = await doFetch();
            setData(result);

            // If analysis is still running (insight not ready yet) → start polling
            if (!result.insight) {
                setPolling(true);

                pollTimer.current = setInterval(async () => {
                    try {
                        const updated = await doFetch();
                        setData(updated);
                        if (updated.insight) {
                            // Got data — stop polling
                            stopPolling();
                        }
                    } catch {
                        // transient error — keep polling
                    }
                }, POLL_INTERVAL_MS);

                // Hard stop after POLL_TIMEOUT_MS
                pollTimeout.current = setTimeout(() => {
                    stopPolling();
                }, POLL_TIMEOUT_MS);
            }
        } catch (err) {
            // Aborted fetches (e.g. React StrictMode unmount) should be silent
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }

    async function handleReanalyze() {
        setReanalyzing(true);
        setError(null);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'}/api/linkedin/analyze`,
                { method: 'POST', credentials: 'include' }
            );
            if (!res.ok) throw new Error('Failed to start re-analysis');
            // Give the backend a moment then start polling for updated results
            await new Promise((r) => setTimeout(r, 2000));
            await fetchInsights();
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError((err as Error).message);
        } finally {
            setReanalyzing(false);
        }
    }

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/Authentication');
            return;
        }
        if (user && !hasFetched.current) {
            hasFetched.current = true;
            fetchInsights();
        }
        return () => {
            stopPolling();
            hasFetched.current = false; // allow re-mount to retry (StrictMode)
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user]);

    /* ── Auth / global loading ── */
    if (authLoading || !user) {
        return <FullPageSpinner />;
    }

    if (loading) {
        return <FullPageSpinner label="Loading your insights…" />;
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center flex-col gap-5 px-4">
                <div className="rounded-full bg-destructive/10 p-4">
                    <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <div className="text-center space-y-1">
                    <p className="font-semibold text-lg">Something went wrong</p>
                    <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
                </div>
                <Button onClick={fetchInsights} variant="outline" className="gap-2">
                    <RefreshCcw className="w-4 h-4" />
                    Try again
                </Button>
            </div>
        );
    }

    if (!data?.insight) {
        // Analysis is still running in the background → show processing state
        if (polling) {
            return (
                <div className="flex min-h-screen items-center justify-center flex-col gap-6 text-center px-4">
                    <div className="relative">
                        <div className="rounded-full bg-primary/10 p-6 ring-1 ring-primary/20 animate-pulse">
                            <Sparkles className="w-12 h-12 text-primary" />
                        </div>
                        <Loader2 className="w-5 h-5 animate-spin text-primary absolute -bottom-1 -right-1" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold">Analyzing your LinkedIn profile…</h2>
                        <p className="text-muted-foreground max-w-sm leading-relaxed">
                            This usually takes 15–30 seconds. Your career intelligence report will appear here automatically.
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Checking every 5 seconds…</p>
                </div>
            );
        }

        // No data and not polling → user hasn't uploaded/analyzed yet
        return (
            <div className="flex min-h-screen items-center justify-center flex-col gap-6 text-center px-4">
                <div className="rounded-full bg-primary/10 p-6 ring-1 ring-primary/20">
                    <Briefcase className="w-12 h-12 text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">No LinkedIn Insights Yet</h2>
                    <p className="text-muted-foreground max-w-sm leading-relaxed">
                        Upload your LinkedIn export ZIP and run the analysis from the dashboard to generate your career intelligence report.
                    </p>
                </div>
                <Link href="/dashboard">
                    <Button size="lg" className="gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Go to Dashboard
                    </Button>
                </Link>

            </div>
        );
    }

    const insight = data.insight;
    const skills = data.skills ?? [];
    const positions = data.positions ?? [];

    /* Group skills by cluster */
    const clusterMap = new Map<string, LinkedinSkill[]>();
    for (const sk of skills) {
        const key = sk.cluster ?? 'Other';
        if (!clusterMap.has(key)) clusterMap.set(key, []);
        clusterMap.get(key)!.push(sk);
    }
    const clusters = Array.from(clusterMap.entries()).slice(0, 6);

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

                {/* ── Back ── */}
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>

                {/* ── Header ── */}
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        Experience Intelligence · AI-powered
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight">
                        LinkedIn <span className="text-primary">Insights</span>
                    </h1>
                    <p className="text-muted-foreground">
                        A comprehensive analysis of your professional journey.
                    </p>
                </div>

                {/* ── Hero stat cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <HeroStat
                        label="Experience"
                        value={`${insight.totalExperienceYears ?? 0} yrs`}
                        icon={<Briefcase className="w-5 h-5" />}
                        color="blue"
                    />
                    <HeroStat
                        label="Career Growth"
                        value={
                            insight.careerGrowthSpeed != null
                                ? insight.careerGrowthSpeed.toFixed(2)
                                : '—'
                        }
                        icon={<TrendingUp className="w-5 h-5" />}
                        color="green"
                    />
                    <HeroStat
                        label="Leadership"
                        value={`${insight.leadershipScore ?? 0}`}
                        icon={<Shield className="w-5 h-5" />}
                        color="purple"
                    />
                    <HeroStat
                        label="Profile Score"
                        value={`${insight.profileScore ?? 0}/100`}
                        icon={<Target className="w-5 h-5" />}
                        color="orange"
                    />
                </div>

                {/* ── Domain Identity + Impact Scores ── */}
                <div className="grid md:grid-cols-2 gap-6">

                    {/* Domain Identity */}
                    <Card className="border-border/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <BarChart3 className="w-4 h-4 text-primary" />
                                Domain Identity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <DomainPill label="Primary" value={insight.primaryDomain ?? '—'} variant="primary" />
                            <DomainPill label="Secondary" value={insight.secondaryDomain ?? '—'} variant="secondary" />
                            <div className="pt-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Orientation</p>
                                <p className="text-sm font-medium">{insight.technicalOrientation ?? '—'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Impact Scores */}
                    <Card className="border-border/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Zap className="w-4 h-4 text-primary" />
                                Impact Intelligence
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-1">
                            <ScoreBar label="Impact" value={insight.impactScore ?? 0} color="blue" />
                            <ScoreBar label="Ownership" value={insight.ownershipScore ?? 0} color="purple" />
                            <ScoreBar label="Leadership" value={insight.leadershipScore ?? 0} color="green" />
                        </CardContent>
                    </Card>
                </div>

                {/* ── Career Summary ── */}
                {insight.careerSummary && (
                    <NarrativeCard
                        title="Career Summary"
                        icon={<BookOpen className="w-4 h-4 text-primary" />}
                        content={insight.careerSummary}
                    />
                )}

                {/* ── Strengths + Improvements ── */}
                <div className="grid md:grid-cols-2 gap-6">
                    {insight.strengthsSummary && (
                        <NarrativeCard
                            title="Strengths"
                            icon={<Star className="w-4 h-4 text-amber-500" />}
                            content={insight.strengthsSummary}
                            accent="amber"
                        />
                    )}
                    {insight.improvementSuggestions && (
                        <NarrativeCard
                            title="Improvement Suggestions"
                            icon={<Lightbulb className="w-4 h-4 text-sky-500" />}
                            content={insight.improvementSuggestions}
                            accent="sky"
                        />
                    )}
                </div>

                {/* ── Experience Timeline ── */}
                {positions.length > 0 && (
                    <ExperienceTimeline positions={positions} />
                )}

                {/* ── Skill Clusters ── */}
                {clusters.length > 0 && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold">Skill Clusters</h2>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clusters.map(([cluster, clusterSkills]) => (
                                <SkillClusterCard key={cluster} cluster={cluster} skills={clusterSkills} />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Footer actions ── */}
                <div className="flex justify-end gap-3 py-2">
                    <Button variant="ghost" size="sm" onClick={fetchInsights} className="gap-2 text-muted-foreground">
                        <RefreshCcw className="w-3.5 h-3.5" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReanalyze}
                        disabled={reanalyzing}
                        className="gap-2"
                    >
                        {reanalyzing ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Re-analyzing…
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-3.5 h-3.5" />
                                Re-analyze with AI
                            </>
                        )}
                    </Button>
                </div>

            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────── */
/* Sub-components                                                   */
/* ─────────────────────────────────────────────────────────────── */

function FullPageSpinner({ label }: { label?: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center flex-col gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            {label && <p className="text-sm text-muted-foreground">{label}</p>}
        </div>
    );
}

type Color = 'blue' | 'green' | 'purple' | 'orange' | 'amber' | 'sky';

const colorMap: Record<Color, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

const progressColorMap: Record<Color, string> = {
    blue: '[&>div]:bg-blue-500',
    green: '[&>div]:bg-emerald-500',
    purple: '[&>div]:bg-violet-500',
    orange: '[&>div]:bg-orange-500',
    amber: '[&>div]:bg-amber-500',
    sky: '[&>div]:bg-sky-500',
};

function HeroStat({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
    color: Color;
}) {
    return (
        <Card className="border-border/60 transition-shadow hover:shadow-md">
            <CardContent className="p-5 space-y-3">
                <div className={`w-fit rounded-lg p-2 ${colorMap[color]}`}>{icon}</div>
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold mt-0.5">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function DomainPill({
    label,
    value,
    variant,
}: {
    label: string;
    value: string;
    variant: 'primary' | 'secondary';
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider shrink-0">{label}</p>
            <Badge
                variant={variant === 'primary' ? 'default' : 'outline'}
                className="text-xs font-medium truncate max-w-[180px]"
            >
                {value}
            </Badge>
        </div>
    );
}

function ScoreBar({
    label,
    value,
    color,
}: {
    label: string;
    value: number;
    color: Color;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground tabular-nums">{value}/100</span>
            </div>
            <Progress value={value} className={`h-2 ${progressColorMap[color]}`} />
        </div>
    );
}

function NarrativeCard({
    title,
    icon,
    content,
    accent,
}: {
    title: string;
    icon: React.ReactNode;
    content: string;
    accent?: Color;
}) {
    return (
        <Card className={`border-border/60 ${accent ? `border-l-2 border-l-${accent}-500/50` : ''}`}>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    {icon}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
            </CardContent>
        </Card>
    );
}

function SkillClusterCard({
    cluster,
    skills,
}: {
    cluster: string;
    skills: LinkedinSkill[];
}) {
    const sorted = [...skills].sort((a, b) => b.frequency - a.frequency).slice(0, 8);
    const max = sorted[0]?.frequency ?? 1;

    return (
        <Card className="border-border/60 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold truncate">{cluster}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
                {sorted.map((sk) => (
                    <div key={sk.skillName} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[160px] font-medium">{sk.skillName}</span>
                            <span className="text-muted-foreground shrink-0 ml-2">×{sk.frequency}</span>
                        </div>
                        <Progress
                            value={(sk.frequency / max) * 100}
                            className="h-1 [&>div]:bg-primary/60"
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

/* ─────────────────────────────────────────────────────────────── */
/* Experience Timeline                                              */
/* ─────────────────────────────────────────────────────────────── */

function ExperienceTimeline({ positions }: { positions: LinkedinPosition[] }) {
    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Experience Timeline</h2>
            </div>

            <div className="relative pl-6 border-l-2 border-primary/20 space-y-0">
                {positions.map((pos, i) => (
                    <TimelineEntry key={`${pos.company}-${pos.title}-${i}`} position={pos} isLast={i === positions.length - 1} />
                ))}
            </div>
        </section>
    );
}

function TimelineEntry({
    position,
    isLast,
}: {
    position: LinkedinPosition;
    isLast: boolean;
}) {
    const dateRange = [
        position.start || 'Unknown',
        position.end || 'Present',
    ].join(' — ');

    const truncatedDesc =
        position.description && position.description.length > 150
            ? position.description.slice(0, 147) + '…'
            : position.description;

    return (
        <div className={`relative ${isLast ? 'pb-0' : 'pb-8'}`}>
            {/* Dot on the timeline */}
            <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />

            <Card className="border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-2">
                    {/* Date range */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{dateRange}</span>
                    </div>

                    {/* Title */}
                    <p className="text-base font-semibold leading-tight">{position.title || 'Untitled Role'}</p>

                    {/* Company */}
                    <p className="text-sm text-foreground/80 font-medium">{position.company || 'Unknown Company'}</p>

                    {/* Location */}
                    {position.location && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>{position.location}</span>
                        </div>
                    )}

                    {/* Description */}
                    {truncatedDesc && (
                        <p className="text-sm text-muted-foreground leading-relaxed pt-1">{truncatedDesc}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
