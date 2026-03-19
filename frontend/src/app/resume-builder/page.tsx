'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    FileText,
    Upload,
    X,
    ClipboardPaste,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    FileSearch,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const ACCEPTED_MIME = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
];

function FullPageSpinner() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
}

export default function ResumeBuilderPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // ── State ──────────────────────────────────────────────────────
    const [file, setFile] = useState<File | null>(null);
    const [jdText, setJdText] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [inputError, setInputError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Auth guard ─────────────────────────────────────────────────
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/Authentication');
        }
    }, [authLoading, user, router]);

    if (authLoading || !user) return <FullPageSpinner />;

    // ── File helpers ───────────────────────────────────────────────
    function validateFile(f: File): string | null {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_MIME.includes(f.type)) {
            return 'Only PDF, DOCX, and TXT files are allowed.';
        }
        if (f.size > 10 * 1024 * 1024) {
            return 'File must be smaller than 10 MB.';
        }
        return null;
    }

    function handleFileSelect(f: File) {
        const err = validateFile(f);
        if (err) {
            setInputError(err);
            return;
        }
        setFile(f);
        setInputError(null);
        setResult(null);
        setError(null);
    }

    function removeFile() {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // ── Drag & drop ────────────────────────────────────────────────
    function onDragOver(e: React.DragEvent) {
        e.preventDefault();
        setIsDragging(true);
    }
    function onDragLeave() {
        setIsDragging(false);
    }
    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFileSelect(dropped);
    }

    // ── Submit ─────────────────────────────────────────────────────
    async function handleSubmit() {
        setInputError(null);
        setResult(null);
        setError(null);

        const hasFile = Boolean(file);
        const hasText = jdText.trim().length > 0;

        if (!hasFile && !hasText) {
            setInputError('Please upload a file or paste a job description before analyzing.');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (file) formData.append('file', file);
            if (hasText) formData.append('jobDescriptionText', jdText.trim());

            const res = await fetch(`${API_URL}/api/resume/analyze-jd`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? 'Something went wrong. Please try again.');
            } else {
                setResult({ success: true, message: data.message });
                // Redirect to Step 2 (Resume Information Form) after successful analysis
                router.push('/resume-builder/form');
            }
        } catch {
            setError('Failed to connect to the server. Please check your connection.');
        } finally {
            setSubmitting(false);
        }
    }

    // ── Render ─────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">

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
                        Resume Builder · Step 1
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight">
                        Job <span className="text-primary">Description</span>
                    </h1>
                    <p className="text-muted-foreground leading-relaxed max-w-xl">
                        Provide the job description you want to tailor your resume for. You can upload a document or paste the text directly.
                    </p>
                </div>

                {/* ── Upload Card ── */}
                <Card className="border-border/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Upload className="w-4 h-4 text-primary" />
                            Upload Job Description
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Drop zone */}
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label="Upload job description file"
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            onClick={() => fileInputRef.current?.click()}
                            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                            className={`
                                relative flex flex-col items-center justify-center gap-3
                                rounded-xl border-2 border-dashed p-10
                                cursor-pointer select-none transition-colors duration-200
                                ${isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'
                                }
                            `}
                        >
                            <div className={`rounded-full p-3 transition-colors ${isDragging ? 'bg-primary/20' : 'bg-muted'}`}>
                                <FileSearch className="w-6 h-6 text-primary" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-sm font-medium">
                                    {isDragging ? 'Drop your file here' : 'Drag & drop or click to browse'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Supports <span className="font-semibold">PDF</span>, <span className="font-semibold">DOCX</span>, <span className="font-semibold">TXT</span> · Max 10 MB
                                </p>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                id="jd-file-upload"
                                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                                className="sr-only"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFileSelect(f);
                                }}
                            />
                        </div>

                        {/* Selected file pill */}
                        {file && (
                            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                                <FileText className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                                <Badge variant="outline" className="text-xs shrink-0">
                                    {(file.size / 1024).toFixed(0)} KB
                                </Badge>
                                <button
                                    type="button"
                                    aria-label="Remove file"
                                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Divider ── */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-border/60" />
                </div>

                {/* ── Text Paste Card ── */}
                <Card className="border-border/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ClipboardPaste className="w-4 h-4 text-primary" />
                            Paste Job Description
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            id="jd-text-input"
                            value={jdText}
                            onChange={(e) => {
                                setJdText(e.target.value);
                                setInputError(null);
                                setResult(null);
                                setError(null);
                            }}
                            placeholder="Paste the full job description here…"
                            rows={12}
                            className="
                                w-full resize-y rounded-lg border border-border/60 bg-background
                                px-4 py-3 text-sm leading-relaxed text-foreground
                                placeholder:text-muted-foreground
                                focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
                                transition-colors
                            "
                        />
                        <p className="mt-2 text-xs text-muted-foreground text-right">
                            {jdText.length.toLocaleString()} characters
                        </p>
                    </CardContent>
                </Card>

                {/* ── Inline validation error ── */}
                {inputError && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">{inputError}</p>
                    </div>
                )}

                {/* ── API error ── */}
                {error && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                )}

                {/* ── Success banner ── */}
                {result?.success && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{result.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">AI analysis will be available in the next step.</p>
                        </div>
                    </div>
                )}

                {/* ── Submit ── */}
                <div className="flex justify-end">
                    <Button
                        id="analyze-jd-btn"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="gap-2 min-w-[200px]"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting…
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Analyze Job Description
                            </>
                        )}
                    </Button>
                </div>

            </div>
        </div>
    );
}
