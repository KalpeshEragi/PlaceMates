'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Download, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { ResumeTemplate, type ResumeData, type TemplateId } from '@/components/resume/templates';
import AtsScorePanel from '@/components/resume/AtsScorePanel';
import { resumeApi, type AtsEvaluationResult } from '@/lib/api/resume-api';

function FullPageSpinner() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
}

export default function ResumePreviewPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    
    const [resumeData, setResumeData] = useState<ResumeData | null>(null);
    const [activeTemplate, setActiveTemplate] = useState<TemplateId>('modern');
    
    // ATS State
    const [atsEvaluation, setAtsEvaluation] = useState<AtsEvaluationResult | null>(null);
    const [atsLoading, setAtsLoading] = useState(true);

    const templates: { id: TemplateId, label: string }[] = [
        { id: 'modern', label: 'Modern' },
        { id: 'minimal', label: 'Minimal' },
        { id: 'technical', label: 'Technical' },
        { id: 'classic', label: 'Classic' }
    ];

    // Auth guard & local storage rehydration
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/Authentication');
            return;
        }
        
        if (user) {
            try {
                const stored = localStorage.getItem('resumeBuilderData');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setResumeData(parsed);
                    
                    // Trigger ATS Evaluation
                    setAtsLoading(true);
                    resumeApi.evaluateAtsScore(parsed)
                        .then(res => setAtsEvaluation(res))
                        .catch(err => console.error("Failed to fetch ATS score:", err))
                        .finally(() => setAtsLoading(false));
                } else {
                    // No data found -> go back to form
                    router.replace('/resume-builder/form');
                }
            } catch (err) {
                console.error("Failed to parse local storage resume data", err);
                router.replace('/resume-builder/form');
            }
        }
    }, [authLoading, user, router]);

    if (authLoading || !user || !resumeData) return <FullPageSpinner />;

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">

                {/* ── Top Nav ── */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/resume-builder/form"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Edit
                    </Link>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        Resume Builder · Step 3
                    </div>
                </div>

                {/* ── Header & Template Selector ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-extrabold tracking-tight">
                            Resume <span className="text-primary">Preview</span>
                        </h1>
                        <p className="text-muted-foreground leading-relaxed">
                            Review your final resume, switch templates, and check your ATS score.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-lg border border-border/50">
                            <LayoutTemplate className="w-4 h-4 text-muted-foreground ml-2" />
                            <div className="flex gap-1">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setActiveTemplate(t.id)}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                            activeTemplate === t.id 
                                            ? 'bg-background text-foreground shadow-sm border border-border/60' 
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Button
                            className="gap-2"
                            onClick={() => window.print()}
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </Button>
                    </div>
                </div>

                {/* ── ATS Score Panel & Preview Layout ── */}
                <div className="flex flex-col xl:flex-row gap-8 items-start">
                    
                    {/* Left side: ATS Insights (Sticky) */}
                    <aside className="w-full xl:w-[350px] shrink-0 sticky top-6">
                        <AtsScorePanel evaluation={atsEvaluation} isLoading={atsLoading} />
                    </aside>

                    {/* Right side: Resume Document Preview */}
                    <div className="flex-1 min-w-0 w-full overflow-x-auto pb-10 flex justify-center xl:justify-start">
                        <div className="bg-white shadow-2xl border border-neutral-200" style={{ width: '210mm', minHeight: '297mm' }}>
                            {/* We wrap it in a slightly customized container to ensure A4 proportions on screen */}
                            <ResumeTemplate 
                                templateId={activeTemplate} 
                                data={resumeData} 
                                className="w-full h-full"
                            />
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>
    );
}
