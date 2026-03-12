import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Lightbulb, TrendingUp, Sparkles, AlertTriangle } from 'lucide-react';
import type { AtsEvaluationResult } from '@/lib/api/resume-api';

interface AtsScorePanelProps {
    evaluation: AtsEvaluationResult | null;
    isLoading: boolean;
}

export default function AtsScorePanel({ evaluation, isLoading }: AtsScorePanelProps) {
    if (isLoading) {
        return (
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-lg animate-pulse w-full max-w-sm shrink-0">
                <CardHeader className="pb-4 border-b border-border/40">
                    <div className="h-6 w-3/4 bg-muted animate-pulse rounded"></div>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                    <div className="h-10 w-full bg-muted animate-pulse rounded-lg"></div>
                    <div className="space-y-2">
                        <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
                        <div className="h-4 w-5/6 bg-muted animate-pulse rounded"></div>
                        <div className="h-4 w-4/6 bg-muted animate-pulse rounded"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!evaluation) {
        return (
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-lg w-full max-w-sm shrink-0">
                <CardHeader className="pb-4 border-b border-border/40">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
                        <AlertCircle className="w-4 h-4" />
                        ATS Score Unavailable
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">We couldn't generate an ATS score. Ensure you analyzed a Job Description in Step 1.</p>
                </CardContent>
            </Card>
        );
    }

    const { atsScore, keywordMatch, missingSkills, suggestions } = evaluation;

    const getColorScore = (score: number) => {
        if (score >= 80) return 'text-emerald-500';
        if (score >= 60) return 'text-amber-500';
        return 'text-destructive';
    };

    const getBgColorScore = (score: number) => {
        if (score >= 80) return 'bg-emerald-500';
        if (score >= 60) return 'bg-amber-500';
        return 'bg-destructive';
    };

    return (
        <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-lg w-full max-w-sm shrink-0 sticky top-6">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                    <div className="flex items-center gap-2 text-foreground">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        ATS Insights
                    </div>
                    {atsScore >= 80 && (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Excellent Fit
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

                {/* Score Header */}
                <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Match Score</span>
                        <span className={`text-4xl font-extrabold tracking-tight ${getColorScore(atsScore)}`}>
                            {atsScore}<span className="text-xl text-muted-foreground">/100</span>
                        </span>
                    </div>
                    {/* Visual Bar */}
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div 
                            className={`h-full ${getBgColorScore(atsScore)} transition-all duration-1000 ease-out`} 
                            style={{ width: `${atsScore}%` }}
                        />
                    </div>
                </div>

                {/* Keyword Match */}
                {keywordMatch.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> Core Keywords
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {keywordMatch.map((match, idx) => (
                                <span 
                                    key={idx} 
                                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                                        match.matched 
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
                                            : 'bg-destructive/10 text-destructive border-destructive/20'
                                    }`}
                                >
                                    {match.keyword}
                                    {match.matched ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Missing Skills */}
                {missingSkills.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-destructive uppercase tracking-widest flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Missing Requirements
                        </h4>
                        <div className="flex flex-col gap-1.5">
                            {missingSkills.map((skill, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm text-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                                    <span>{skill}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                    <div className="space-y-3">
                        <div className="h-px bg-border/40 w-full my-1"></div>
                        <h4 className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 pt-2">
                            <Lightbulb className="w-3.5 h-3.5" /> Recommendations
                        </h4>
                        <ul className="space-y-3">
                            {suggestions.map((suggestion, idx) => (
                                <li key={idx} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                                    <span className="flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5 border border-primary/20">
                                        {idx + 1}
                                    </span>
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
