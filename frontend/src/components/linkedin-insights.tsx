'use client';

import {
    Award,
    BookOpen,
    Briefcase,
    Building2,
    GraduationCap,
    Loader2,
    MapPin,
    Sparkles,
    TrendingUp,
    User,
    Zap,
    AlertCircle,
    Clock,
    Shield,
    Target,
    Brain,
    BadgeCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type {
    LinkedinInsightsResponse,
    LinkedinExperience,
    LinkedinEducation,
    LinkedinSkillInsightData,
    LinkedinCertification,
} from '@/lib/api/linkedin-api';

/* ── Helpers ────────────────────────────────────────────── */

function formatDateRange(start?: string, end?: string): string {
    const s = start || 'Unknown';
    const e = end || 'Present';
    return `${s} — ${e}`;
}

function getScoreColor(score: number | null): string {
    if (score == null) return 'text-muted-foreground';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
}

/* ── Loading Skeleton ───────────────────────────────────── */

export function LinkedinInsightsSkeleton() {
    return (
        <div className="space-y-6">
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
            <div className="grid grid-cols-12 gap-4">
                <Card className="col-span-12 lg:col-span-5 border-0 bg-muted/30 p-5 space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-full" />
                        </div>
                    ))}
                </Card>
                <div className="col-span-12 lg:col-span-7 space-y-4">
                    <Card className="border-0 bg-muted/30 p-5">
                        <Skeleton className="h-6 w-36 mb-4" />
                        <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Skeleton key={i} className="h-8 w-24 rounded-full" />
                            ))}
                        </div>
                    </Card>
                    <Card className="border-0 bg-muted/30 p-5">
                        <Skeleton className="h-6 w-44 mb-4" />
                        <div className="grid grid-cols-2 gap-3">
                            {[1, 2].map((i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-4 w-28" />
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

/* ── Empty State ────────────────────────────────────────── */

export function LinkedinEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-3xl flex items-center justify-center animate-pulse">
                    <Briefcase className="w-10 h-10 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                </div>
            </div>
            <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-semibold text-foreground">No LinkedIn Insights Yet</h3>
                <p className="text-muted-foreground">
                    Upload your LinkedIn data export ZIP to unlock AI-powered career insights,
                    skill validation, and professional timeline analysis.
                </p>
            </div>
            <Link href="/dashboard">
                <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                    <Zap className="mr-2 w-4 h-4" />
                    Import LinkedIn Data
                </Button>
            </Link>
        </div>
    );
}

/* ── Error State ────────────────────────────────────────── */

export function LinkedinErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
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

/* ── Score Ring ──────────────────────────────────────────── */

function ScoreRing({ score, label, icon: Icon, gradientId }: { score: number | null; label: string; icon: React.ElementType; gradientId: string }) {
    const value = score ?? 0;
    const circumference = 2 * Math.PI * 36;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-[72px] h-[72px]">
                <svg className="w-[72px] h-[72px] -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="36" stroke="currentColor" className="text-muted/30" strokeWidth="6" fill="none" />
                    <circle
                        cx="40" cy="40" r="36"
                        stroke={`url(#${gradientId})`}
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#818cf8" />
                            <stop offset="100%" stopColor="#a78bfa" />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-base font-bold ${getScoreColor(score)}`}>
                        {score ?? '—'}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Icon className="w-3 h-3" />
                <span>{label}</span>
            </div>
        </div>
    );
}

/* ── Main LinkedIn Insights View ────────────────────────── */

export default function LinkedinInsightsView({ data }: { data: LinkedinInsightsResponse }) {
    const { insight, skills, parsedProfile } = data;

    const experienceCount = parsedProfile?.experience?.length ?? 0;
    const educationCount = parsedProfile?.education?.length ?? 0;
    const skillCount = skills?.length || parsedProfile?.skills?.length || 0;
    const certCount = parsedProfile?.certifications?.length ?? 0;

    const skillItems: LinkedinSkillInsightData[] = skills.length > 0
        ? skills
        : (parsedProfile?.skills ?? []).map((s) => ({ id: s.name, userId: '', skillName: s.name, frequency: 1, cluster: null }));

    const skillColors = [
        'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
        'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
        'bg-purple-500/15 text-purple-300 border-purple-500/25',
        'bg-blue-500/15 text-blue-300 border-blue-500/25',
        'bg-orange-500/15 text-orange-300 border-orange-500/25',
        'bg-pink-500/15 text-pink-300 border-pink-500/25',
    ];

    return (
        <div className="space-y-6">
            {/* ── Row 1: Overview Cards (4 columns) ────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Experience',
                        value: insight?.totalExperienceYears != null
                            ? `${insight.totalExperienceYears} yrs`
                            : `${experienceCount} roles`,
                        icon: Briefcase,
                        color: 'from-blue-500/20 to-cyan-500/20',
                    },
                    {
                        label: 'Profile Score',
                        value: insight?.profileScore != null ? `${insight.profileScore}%` : '—',
                        icon: Target,
                        color: 'from-emerald-500/20 to-teal-500/20',
                    },
                    {
                        label: 'Skills',
                        value: skillCount.toString(),
                        icon: Sparkles,
                        color: 'from-purple-500/20 to-pink-500/20',
                    },
                    {
                        label: 'Domain',
                        value: insight?.primaryDomain || 'N/A',
                        icon: Building2,
                        color: 'from-orange-500/20 to-red-500/20',
                    },
                ].map((stat) => (
                    <Card
                        key={stat.label}
                        className="group border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden relative"
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                        <CardContent className="relative p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-background/80 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 shrink-0">
                                    <stat.icon className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                                    <p className="text-xl font-bold text-foreground break-words leading-tight">{stat.value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── Row 2: Bento Grid — Career Timeline + Skills ── */}
            <div className="grid grid-cols-12 gap-4">
                {/* Career Timeline — left, tall */}
                {experienceCount > 0 && (
                    <Card className="col-span-12 lg:col-span-5 border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <CardContent className="relative p-5">
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                    <Clock className="w-3.5 h-3.5" />
                                </div>
                                <h3 className="text-base font-bold tracking-tight">Career Timeline</h3>
                                <Badge variant="secondary" className="ml-auto text-[11px]">{experienceCount} roles</Badge>
                            </div>
                            <div className="relative">
                                <div className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-gradient-to-b from-indigo-500/40 via-purple-500/20 to-transparent" />
                                <div className="space-y-4">
                                    {parsedProfile!.experience.map((exp: LinkedinExperience, i: number) => (
                                        <div key={i} className="relative pl-8">
                                            <div className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 ring-[3px] ring-background" />
                                            <div>
                                                <h4 className="text-sm font-semibold text-foreground leading-snug">{exp.title}</h4>
                                                <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                                                    <Building2 className="w-3 h-3" />
                                                    {exp.companyName}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {formatDateRange(exp.startDate, exp.endDate)}
                                                </p>
                                                {exp.location && (
                                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-2.5 h-2.5" /> {exp.location}
                                                    </p>
                                                )}
                                                {exp.description && (
                                                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{exp.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Right column — Skills + Education stacked */}
                <div className={`col-span-12 ${experienceCount > 0 ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
                    {/* Skill Validation */}
                    {skillCount > 0 && (
                        <Card className="border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <CardContent className="relative p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                        <BadgeCheck className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-base font-bold tracking-tight">Skill Validation</h3>
                                    <Badge variant="secondary" className="ml-auto text-[11px]">{skillCount} skills</Badge>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {skillItems.map((skill, i) => (
                                        <span
                                            key={skill.id || skill.skillName}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 cursor-default hover:scale-105 ${skillColors[i % skillColors.length]}`}
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            {skill.skillName}
                                            {skill.frequency > 1 && (
                                                <span className="opacity-70">×{skill.frequency}</span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                                {skills.some((s) => s.cluster) && (
                                    <div className="mt-4 pt-3 border-t border-border/30">
                                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Skill Clusters</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[...new Set(skills.filter((s) => s.cluster).map((s) => s.cluster))].map((cluster) => (
                                                <span key={cluster} className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] bg-primary/10 text-primary border border-primary/20">
                                                    {cluster}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Education Insights */}
                    {educationCount > 0 && (
                        <Card className="border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <CardContent className="relative p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                        <GraduationCap className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-base font-bold tracking-tight">Education Insights</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {parsedProfile!.education.map((edu: LinkedinEducation, i: number) => (
                                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background/40 border border-border/20">
                                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center shrink-0">
                                                <GraduationCap className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-semibold text-foreground leading-snug">{edu.schoolName}</h4>
                                                {edu.degree && <p className="text-xs text-primary">{edu.degree}</p>}
                                                {edu.fieldOfStudy && <p className="text-[11px] text-muted-foreground">{edu.fieldOfStudy}</p>}
                                                <p className="text-[11px] text-muted-foreground mt-0.5">{formatDateRange(edu.startDate, edu.endDate)}</p>
                                                {edu.activities && <p className="text-[11px] text-muted-foreground/70 mt-1">{edu.activities}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* ── Row 3: Bento Grid — Industry Exposure + AI Summary ── */}
            <div className="grid grid-cols-12 gap-4">
                {/* Industry Exposure — left */}
                {(insight?.primaryDomain || insight?.secondaryDomain || certCount > 0) && (
                    <Card className={`col-span-12 ${(insight?.careerSummary || insight?.strengthsSummary || insight?.leadershipScore != null) ? 'lg:col-span-5' : 'lg:col-span-12'} border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden relative group`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <CardContent className="relative p-5">
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                    <Building2 className="w-3.5 h-3.5" />
                                </div>
                                <h3 className="text-base font-bold tracking-tight">Industry Exposure</h3>
                            </div>

                            {/* Domains */}
                            {(insight?.primaryDomain || insight?.secondaryDomain) && (
                                <div className="mb-4">
                                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-3">Industry Domains</p>
                                    <div className="space-y-2.5">
                                        {insight?.primaryDomain && (
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{insight.primaryDomain}</p>
                                                    <p className="text-[11px] text-muted-foreground">Primary Domain</p>
                                                </div>
                                            </div>
                                        )}
                                        {insight?.secondaryDomain && (
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{insight.secondaryDomain}</p>
                                                    <p className="text-[11px] text-muted-foreground">Secondary Domain</p>
                                                </div>
                                            </div>
                                        )}
                                        {insight?.technicalOrientation && (
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{insight.technicalOrientation}</p>
                                                    <p className="text-[11px] text-muted-foreground">Technical Orientation</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Certifications */}
                            {certCount > 0 && (
                                <div className={`${(insight?.primaryDomain || insight?.secondaryDomain) ? 'pt-4 border-t border-border/30' : ''}`}>
                                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-3">Certifications</p>
                                    <div className="space-y-2">
                                        {parsedProfile!.certifications.map((cert: LinkedinCertification, i: number) => (
                                            <div key={i} className="flex items-start gap-2.5">
                                                <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground">{cert.name}</p>
                                                    {cert.authority && <p className="text-[11px] text-muted-foreground">{cert.authority}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* AI Summary — right */}
                {(insight?.careerSummary || insight?.strengthsSummary || insight?.improvementSuggestions ||
                    insight?.leadershipScore != null || insight?.impactScore != null || insight?.ownershipScore != null) && (
                    <div className={`col-span-12 ${(insight?.primaryDomain || insight?.secondaryDomain || certCount > 0) ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
                        {/* Scores card */}
                        {(insight?.leadershipScore != null || insight?.impactScore != null || insight?.ownershipScore != null) && (
                            <Card className="border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden relative group">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <CardContent className="relative p-5">
                                    <div className="flex items-center gap-2 mb-5">
                                        <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                            <Brain className="w-3.5 h-3.5" />
                                        </div>
                                        <h3 className="text-base font-bold tracking-tight">AI Summary</h3>
                                    </div>
                                    <div className="flex justify-around mb-4">
                                        <ScoreRing score={insight?.leadershipScore ?? null} label="Leadership" icon={Shield} gradientId="scoreGrad1" />
                                        <ScoreRing score={insight?.impactScore ?? null} label="Impact" icon={TrendingUp} gradientId="scoreGrad2" />
                                        <ScoreRing score={insight?.ownershipScore ?? null} label="Ownership" icon={Target} gradientId="scoreGrad3" />
                                    </div>
                                    {insight?.careerGrowthSpeed != null && (
                                        <div className="pt-3 border-t border-border/30 flex items-center justify-center gap-2">
                                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-xs text-muted-foreground">Career Growth Speed:</span>
                                            <span className="text-xs font-bold text-emerald-400">{insight.careerGrowthSpeed}x</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Text summaries */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {insight?.careerSummary && (
                                <Card className="border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden sm:col-span-2">
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Briefcase className="w-3.5 h-3.5 text-primary" />
                                            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Career Summary</h4>
                                        </div>
                                        <p className="text-sm text-foreground/80 leading-relaxed">{insight.careerSummary}</p>
                                    </CardContent>
                                </Card>
                            )}
                            {insight?.strengthsSummary && (
                                <Card className="border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden">
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Zap className="w-3.5 h-3.5 text-emerald-400" />
                                            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Key Strengths</h4>
                                        </div>
                                        <p className="text-sm text-foreground/80 leading-relaxed">{insight.strengthsSummary}</p>
                                    </CardContent>
                                </Card>
                            )}
                            {insight?.improvementSuggestions && (
                                <Card className="border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500 overflow-hidden">
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                                            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Areas to Improve</h4>
                                        </div>
                                        <p className="text-sm text-foreground/80 leading-relaxed">{insight.improvementSuggestions}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
