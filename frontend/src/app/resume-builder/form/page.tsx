'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    ArrowRight,
    Loader2,
    Sparkles,
    User,
    Briefcase,
    FolderGit2,
    GraduationCap,
    Award,
    Wrench,
    BookOpen,
    Trophy,
    BookMarked,
    ChevronDown,
    Plus,
    Trash2,
    Check,
    AlertCircle,
    Github,
    Linkedin,
    Wand2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { githubApi, type InsightRepository, type InsightSkill } from '@/lib/api/github-api';
import { linkedinApi, type LinkedinPosition, type LinkedinSkill } from '@/lib/api/linkedin-api';
import { resumeApi, type ComparisonScores, type UserResumeData } from '@/lib/api/resume-api';

// ── Types ───────────────────────────────────────────────────────────────────

interface ContactData {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
    githubUrl: string;
    portfolioUrl: string;
    website: string;
}

interface ExperienceEntry {
    id: string;
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
}

interface ProjectEntry {
    id: string;
    name: string;
    repoUrl: string;
    description: string;
    techStack: string;
    stars: number | null;
    forks: number | null;
}

interface EducationEntry {
    id: string;
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    gpa: string;
    description: string;
}

interface CertificationEntry {
    id: string;
    name: string;
    issuer: string;
    date: string;
    url: string;
}

interface CourseworkEntry {
    id: string;
    name: string;
}

interface AwardEntry {
    id: string;
    title: string;
    issuer: string;
    date: string;
    description: string;
}

interface PublicationEntry {
    id: string;
    title: string;
    authors: string;
    journal: string;
    year: string;
    url: string;
}

interface FormData {
    contact: ContactData;
    experience: ExperienceEntry[];
    projects: ProjectEntry[];
    education: EducationEntry[];
    certifications: CertificationEntry[];
    skills: string[];
    coursework: CourseworkEntry[];
    awards: AwardEntry[];
    publications: PublicationEntry[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
    return Math.random().toString(36).slice(2, 9);
}

function emptyExperience(): ExperienceEntry {
    return { id: uid(), title: '', company: '', location: '', startDate: '', endDate: '', current: false, description: '' };
}
function emptyProject(): ProjectEntry {
    return { id: uid(), name: '', repoUrl: '', description: '', techStack: '', stars: null, forks: null };
}
function emptyEducation(): EducationEntry {
    return { id: uid(), institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', description: '' };
}
function emptyCertification(): CertificationEntry {
    return { id: uid(), name: '', issuer: '', date: '', url: '' };
}
function emptyCoursework(): CourseworkEntry {
    return { id: uid(), name: '' };
}
function emptyAward(): AwardEntry {
    return { id: uid(), title: '', issuer: '', date: '', description: '' };
}
function emptyPublication(): PublicationEntry {
    return { id: uid(), title: '', authors: '', journal: '', year: '', url: '' };
}

const SECTION_LIST = [
    { id: 'contact', label: 'Contact', icon: User },
    { id: 'experience', label: 'Experience', icon: Briefcase },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'certifications', label: 'Certifications', icon: Award },
    { id: 'skills', label: 'Skills', icon: Wrench },
    { id: 'coursework', label: 'Coursework', icon: BookOpen },
    { id: 'awards', label: 'Awards', icon: Trophy },
    { id: 'publications', label: 'Publications', icon: BookMarked },
] as const;

type SectionId = typeof SECTION_LIST[number]['id'];

// ── Spinner ──────────────────────────────────────────────────────────────────

function FullPageSpinner() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
}

// ── Field Components ─────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    id: string;
}
function Field({ label, id, ...props }: InputProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
            </label>
            <input
                id={id}
                {...props}
                className={`
                    w-full rounded-lg border border-border/60 bg-background
                    px-3 py-2.5 text-sm text-foreground
                    placeholder:text-muted-foreground/50
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
                    transition-colors
                    ${props.className ?? ''}
                `}
            />
        </div>
    );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    id: string;
}
function TextAreaField({ label, id, ...props }: TextAreaProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
            </label>
            <textarea
                id={id}
                rows={4}
                {...props}
                className={`
                    w-full resize-y rounded-lg border border-border/60 bg-background
                    px-3 py-2.5 text-sm text-foreground leading-relaxed
                    placeholder:text-muted-foreground/50
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
                    transition-colors
                    ${props.className ?? ''}
                `}
            />
        </div>
    );
}

// ── Dropdown Autofill ────────────────────────────────────────────────────────

interface DropdownOption {
    label: string;
    value: string;
}

interface AutofillDropdownProps {
    options: DropdownOption[];
    placeholder: string;
    onSelect: (value: string) => void;
    sourceLabel: string;
    sourceIcon: React.ReactNode;
    noDataMessage: string;
}

function AutofillDropdown({ options, placeholder, onSelect, sourceLabel, sourceIcon, noDataMessage }: AutofillDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="
                    w-full flex items-center justify-between gap-2
                    rounded-lg border border-primary/30 bg-primary/5
                    px-3 py-2.5 text-sm text-primary
                    hover:bg-primary/10 hover:border-primary/50
                    transition-all duration-200
                "
            >
                <span className="flex items-center gap-2">
                    {sourceIcon}
                    <span className="font-medium">{placeholder}</span>
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="
                    absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto
                    rounded-xl border border-border/60 bg-card shadow-xl
                ">
                    {options.length === 0 ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{noDataMessage}</span>
                        </div>
                    ) : (
                        <>
                            <div className="px-3 py-2 border-b border-border/40">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                                    {sourceLabel}
                                </span>
                            </div>
                            {options.map((opt, idx) => (
                                <button
                                    key={`${opt.value}-${idx}`}
                                    type="button"
                                    onClick={() => {
                                        onSelect(opt.value);
                                        setOpen(false);
                                    }}
                                    className="
                                        w-full text-left px-4 py-2.5 text-sm
                                        hover:bg-primary/10 hover:text-primary
                                        transition-colors duration-150
                                        border-b border-border/20 last:border-0
                                    "
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Section Wrapper ──────────────────────────────────────────────────────────

function SectionCard({ id, title, icon: Icon, children }: {
    id: string;
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
}) {
    return (
        <div id={id} className="scroll-mt-6">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg">
                <CardHeader className="pb-4 border-b border-border/40">
                    <CardTitle className="flex items-center gap-3 text-base font-semibold">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 text-primary">
                            <Icon className="w-4 h-4" />
                        </span>
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                    {children}
                </CardContent>
            </Card>
        </div>
    );
}

// ── Add/Remove Row button ────────────────────────────────────────────────────

function AddEntryButton({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="
                flex items-center gap-2 text-sm text-primary font-medium
                hover:text-primary/80 transition-colors
                border border-dashed border-primary/30 hover:border-primary/60
                rounded-lg px-4 py-2.5 w-full justify-center
                hover:bg-primary/5 transition-all duration-200
            "
        >
            <Plus className="w-4 h-4" />
            {label}
        </button>
    );
}

function ImproveWithAiButton({ text, context, onImproved }: {
    text: string;
    context: string;
    onImproved: (newText: string) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
        if (!text.trim()) {
            setError('Write some text first, then click to improve.');
            setTimeout(() => setError(null), 3000);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await resumeApi.improveText(text, context);
            onImproved(result.improvedText);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to improve text');
            setTimeout(() => setError(null), 4000);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={handleClick}
                disabled={loading}
                className="
                    inline-flex items-center gap-2 self-start
                    rounded-lg border border-primary/30 bg-primary/5
                    px-3 py-2 text-sm font-medium text-primary
                    hover:bg-primary/10 hover:border-primary/50
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                "
            >
                {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                )}
                {loading ? 'Improving…' : 'Improve with AI'}
            </button>
            {error && (
                <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                </span>
            )}
        </div>
    );
}

function EntryDivider() {
    return <div className="h-px bg-border/40 my-2" />;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ResumeFormPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // ── Source data ──────────────────────────────────────────────────────────
    const [githubRepos, setGithubRepos] = useState<InsightRepository[]>([]);
    const [githubSkills, setGithubSkills] = useState<InsightSkill[]>([]);
    const [linkedinPositions, setLinkedinPositions] = useState<LinkedinPosition[]>([]);
    const [linkedinSkills, setLinkedinSkills] = useState<LinkedinSkill[]>([]);
    const [comparisonScores, setComparisonScores] = useState<ComparisonScores | null>(null);
    const [dataLoading, setDataLoading] = useState(true);

    // ── Active sidebar section (highlight) ───────────────────────────────────
    const [activeSection, setActiveSection] = useState<SectionId>('contact');

    // ── Form state ───────────────────────────────────────────────────────────
    const [formData, setFormData] = useState<FormData>({
        contact: {
            name: '', email: '', phone: '', location: '',
            linkedinUrl: '', githubUrl: '', portfolioUrl: '', website: '',
        },
        experience: [emptyExperience()],
        projects: [emptyProject()],
        education: [emptyEducation()],
        certifications: [emptyCertification()],
        skills: [],
        coursework: [emptyCoursework()],
        awards: [emptyAward()],
        publications: [emptyPublication()],
    });

    // ── Auth guard ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/Authentication');
        }
    }, [authLoading, user, router]);

    // ── Fetch GitHub & LinkedIn data ─────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        let active = true;

        async function loadData() {
            setDataLoading(true);
            const [ghResult, liResult, scoresResult, userDataResult] = await Promise.allSettled([
                githubApi.getInsights(),
                linkedinApi.getInsights(),
                resumeApi.getComparisonScores().catch(() => null),
                resumeApi.getUserData().catch(() => null),
            ]);

            if (!active) return;

            if (ghResult.status === 'fulfilled') {
                setGithubRepos(ghResult.value.repositories ?? []);
                setGithubSkills(ghResult.value.topSkills ?? []);
            }
            if (liResult.status === 'fulfilled') {
                setLinkedinPositions(liResult.value.positions ?? []);
                setLinkedinSkills(liResult.value.skills ?? []);
            }
            if (scoresResult.status === 'fulfilled' && scoresResult.value) {
                setComparisonScores(scoresResult.value);
            }

            // ── Auto-populate form sections from LinkedIn data ──────────────
            if (userDataResult.status === 'fulfilled' && userDataResult.value) {
                const ud = userDataResult.value as UserResumeData;
                setFormData((prev) => {
                    const next = { ...prev };

                    // Experience — from positions
                    if (ud.positions.length > 0) {
                        next.experience = ud.positions.map((p) => ({
                            id: uid(),
                            title: p.title,
                            company: p.company,
                            location: p.location,
                            startDate: p.start,
                            endDate: p.end,
                            current: p.end === '' || p.end.toLowerCase() === 'present',
                            description: p.description,
                        }));
                    }

                    // Education
                    if (ud.education.length > 0) {
                        next.education = ud.education.map((e) => ({
                            id: uid(),
                            institution: e.institution,
                            degree: e.degree,
                            field: e.field,
                            startDate: e.startDate,
                            endDate: e.endDate,
                            gpa: '',
                            description: e.activities,
                        }));
                    }

                    // Certifications
                    if (ud.certifications.length > 0) {
                        next.certifications = ud.certifications.map((c) => ({
                            id: uid(),
                            name: c.name,
                            issuer: c.authority,
                            date: c.startDate,
                            url: c.url,
                        }));
                    }

                    // Awards / Honors
                    if (ud.honors.length > 0) {
                        next.awards = ud.honors.map((h) => ({
                            id: uid(),
                            title: h.title,
                            issuer: h.issuer,
                            date: h.date,
                            description: h.description,
                        }));
                    }

                    // Coursework
                    if (ud.courses.length > 0) {
                        next.coursework = ud.courses.map((c) => ({
                            id: uid(),
                            name: c.number ? `${c.name} (${c.number})` : c.name,
                        }));
                    }

                    return next;
                });
            }

            setDataLoading(false);
        }

        loadData();
        return () => { active = false; };
    }, [user]);

    // ── Merged skills list (deduped) ─────────────────────────────────────────
    const allAvailableSkills = Array.from(new Set([
        ...githubSkills.map((s) => s.skillName),
        ...linkedinSkills.map((s) => s.skillName),
    ])).sort();

    // ── Form helpers ─────────────────────────────────────────────────────────

    function updateContact(field: keyof ContactData, value: string) {
        setFormData((prev) => ({ ...prev, contact: { ...prev.contact, [field]: value } }));
    }

    function updateEntry<
        K extends 'experience' | 'projects' | 'education' | 'certifications' | 'coursework' | 'awards' | 'publications'
    >(section: K, id: string, field: string, value: string | boolean | number | null) {
        setFormData((prev) => ({
            ...prev,
            [section]: (prev[section] as unknown as Array<{ id: string } & Record<string, unknown>>).map((e) =>
                e.id === id ? { ...e, [field]: value } : e
            ),
        }));
    }

    function addEntry<K extends 'experience' | 'projects' | 'education' | 'certifications' | 'coursework' | 'awards' | 'publications'>(
        section: K,
        factory: () => FormData[K][number]
    ) {
        setFormData((prev) => ({
            ...prev,
            [section]: [...(prev[section] as Array<unknown>), factory()],
        }));
    }

    function removeEntry<K extends 'experience' | 'projects' | 'education' | 'certifications' | 'coursework' | 'awards' | 'publications'>(
        section: K,
        id: string
    ) {
        setFormData((prev) => ({
            ...prev,
            [section]: (prev[section] as Array<{ id: string }>).filter((e) => e.id !== id),
        }));
    }

    function toggleSkill(skill: string) {
        setFormData((prev) => ({
            ...prev,
            skills: prev.skills.includes(skill)
                ? prev.skills.filter((s) => s !== skill)
                : [...prev.skills, skill],
        }));
    }

    // ── Autofill from LinkedIn position ─────────────────────────────────────
    function autofillExperience(entryId: string, positionLabel: string) {
        const pos = linkedinPositions.find((p) => `${p.title} – ${p.company}` === positionLabel);
        if (!pos) return;
        setFormData((prev) => ({
            ...prev,
            experience: (prev.experience as ExperienceEntry[]).map((e) =>
                e.id === entryId
                    ? {
                        ...e,
                        title: pos.title,
                        company: pos.company,
                        location: pos.location,
                        startDate: pos.start,
                        endDate: pos.end,
                        current: pos.end === '' || pos.end.toLowerCase() === 'present',
                        description: pos.description,
                    }
                    : e
            ),
        }));
    }

    // ── Autofill from GitHub repo ────────────────────────────────────────────
    function autofillProject(entryId: string, repoName: string) {
        const repo = githubRepos.find((r) => r.name === repoName);
        if (!repo) return;
        setFormData((prev) => ({
            ...prev,
            projects: (prev.projects as ProjectEntry[]).map((p) =>
                p.id === entryId
                    ? {
                        ...p,
                        name: repo.name,
                        repoUrl: repo.repoUrl,
                        description: repo.description ?? '',
                        techStack: repo.language ?? '',
                        stars: repo.stars,
                        forks: repo.forks,
                    }
                    : p
            ),
        }));
    }

    // ── Scroll to section ────────────────────────────────────────────────────
    const scrollToSection = useCallback((id: SectionId) => {
        setActiveSection(id);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    // ── Intersection observer for active section highlight ───────────────────
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id as SectionId);
                    }
                }
            },
            { rootMargin: '-30% 0px -60% 0px' }
        );
        SECTION_LIST.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    // ── Guards ───────────────────────────────────────────────────────────────
    if (authLoading || !user) return <FullPageSpinner />;

    // ── Prepare and sort dropdown options ──────────────────────────────────
    
    // Sort LinkedIn positions by experience relevance score
    const experienceDropdownOptions = [...linkedinPositions]
        .map((p) => {
            const roleStr = `${p.title} – ${p.company}`;
            let score = 0;
            if (comparisonScores?.experienceMatch) {
                const match = comparisonScores.experienceMatch.find((m) => m.role === roleStr);
                if (match) score = match.score;
            }
            return {
                label: score > 0 ? `${roleStr} (${score.toFixed(2)})` : roleStr,
                value: roleStr,
                score,
            };
        })
        .sort((a, b) => b.score - a.score) // Sort descending by score
        .map(({ label, value }) => ({ label, value }));

    // Sort GitHub repos by project relevance score
    const projectDropdownOptions = [...githubRepos]
        .map((r) => {
            let score = 0;
            if (comparisonScores?.projectMatch) {
                const match = comparisonScores.projectMatch.find((m) => m.project === r.name);
                if (match) score = match.score;
            }
            return {
                label: score > 0 ? `${r.name} (${score.toFixed(2)})` : r.name,
                value: r.name,
                score,
            };
        })
        .sort((a, b) => b.score - a.score) // Sort descending by score
        .map(({ label, value }) => ({ label, value }));

    const canProceed = formData.contact.name.trim().length > 0 && formData.contact.email.trim().length > 0;

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

                {/* ── Top nav ── */}
                <div className="mb-8 flex items-center justify-between">
                    <Link
                        href="/resume-builder"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Link>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        Resume Builder · Step 2
                    </div>
                </div>

                {/* ── Header ── */}
                <div className="mb-10 space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight">
                        Resume <span className="text-primary">Information</span>
                    </h1>
                    <p className="text-muted-foreground leading-relaxed max-w-xl">
                        Fill in your details below. Use the dropdowns to autofill from your GitHub repositories and LinkedIn experience.
                    </p>
                    {/* Source chips */}
                    {!dataLoading && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border/50 bg-muted/30 text-muted-foreground">
                                <Github className="w-3 h-3" />
                                {githubRepos.length > 0 ? `${githubRepos.length} GitHub repos` : 'No GitHub data'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border/50 bg-muted/30 text-muted-foreground">
                                <Linkedin className="w-3 h-3" />
                                {linkedinPositions.length > 0 ? `${linkedinPositions.length} LinkedIn positions` : 'No LinkedIn data'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border/50 bg-muted/30 text-muted-foreground">
                                <Wrench className="w-3 h-3" />
                                {allAvailableSkills.length > 0 ? `${allAvailableSkills.length} skills available` : 'No skill data'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex gap-8 items-start">

                    {/* ── Sidebar ── */}
                    <aside className="hidden lg:flex flex-col gap-1 w-48 shrink-0 sticky top-6">
                        {SECTION_LIST.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => scrollToSection(id)}
                                className={`
                                    flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
                                    transition-all duration-200 text-left w-full
                                    ${activeSection === id
                                        ? 'bg-primary/15 text-primary border border-primary/25'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                {label}
                            </button>
                        ))}
                    </aside>

                    {/* ── Sections ── */}
                    <div className="flex-1 min-w-0 space-y-8">

                        {/* Loading overlay */}
                        {dataLoading && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 text-primary text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading your GitHub and LinkedIn data for autofill…
                            </div>
                        )}

                        {/* ─────────── CONTACT ─────────── */}
                        <SectionCard id="contact" title="Contact Information" icon={User}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field
                                    label="Full Name *"
                                    id="contact-name"
                                    value={formData.contact.name}
                                    onChange={(e) => updateContact('name', e.target.value)}
                                    placeholder="Jane Smith"
                                />
                                <Field
                                    label="Email *"
                                    id="contact-email"
                                    type="email"
                                    value={formData.contact.email}
                                    onChange={(e) => updateContact('email', e.target.value)}
                                    placeholder="jane@example.com"
                                />
                                <Field
                                    label="Phone"
                                    id="contact-phone"
                                    type="tel"
                                    value={formData.contact.phone}
                                    onChange={(e) => updateContact('phone', e.target.value)}
                                    placeholder="+1 (555) 000-0000"
                                />
                                <Field
                                    label="Location"
                                    id="contact-location"
                                    value={formData.contact.location}
                                    onChange={(e) => updateContact('location', e.target.value)}
                                    placeholder="San Francisco, CA"
                                />
                                <Field
                                    label="LinkedIn URL"
                                    id="contact-linkedin"
                                    value={formData.contact.linkedinUrl}
                                    onChange={(e) => updateContact('linkedinUrl', e.target.value)}
                                    placeholder="https://linkedin.com/in/janesmith"
                                />
                                <Field
                                    label="GitHub URL"
                                    id="contact-github"
                                    value={formData.contact.githubUrl}
                                    onChange={(e) => updateContact('githubUrl', e.target.value)}
                                    placeholder="https://github.com/janesmith"
                                />
                                <Field
                                    label="Portfolio URL"
                                    id="contact-portfolio"
                                    value={formData.contact.portfolioUrl}
                                    onChange={(e) => updateContact('portfolioUrl', e.target.value)}
                                    placeholder="https://janesmith.dev"
                                />
                                <Field
                                    label="Personal Website"
                                    id="contact-website"
                                    value={formData.contact.website}
                                    onChange={(e) => updateContact('website', e.target.value)}
                                    placeholder="https://blog.janesmith.dev"
                                />
                            </div>
                        </SectionCard>

                        {/* ─────────── EXPERIENCE ─────────── */}
                        <SectionCard id="experience" title="Work Experience" icon={Briefcase}>
                            {formData.experience.map((exp, idx) => (
                                <div key={exp.id} className="space-y-4">
                                    {idx > 0 && <EntryDivider />}

                                    {/* Header row */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Position {idx + 1}
                                        </span>
                                        {formData.experience.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEntry('experience', exp.id)}
                                                className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    {/* Autofill dropdown */}
                                    <AutofillDropdown
                                        options={experienceDropdownOptions}
                                        placeholder="Autofill from LinkedIn"
                                        sourceLabel="LinkedIn Positions"
                                        sourceIcon={<Linkedin className="w-3.5 h-3.5" />}
                                        noDataMessage="No LinkedIn positions found. Connect LinkedIn to enable autofill."
                                        onSelect={(v) => autofillExperience(exp.id, v)}
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field
                                            label="Job Title"
                                            id={`exp-title-${exp.id}`}
                                            value={exp.title}
                                            onChange={(e) => updateEntry('experience', exp.id, 'title', e.target.value)}
                                            placeholder="Software Engineer"
                                        />
                                        <Field
                                            label="Company"
                                            id={`exp-company-${exp.id}`}
                                            value={exp.company}
                                            onChange={(e) => updateEntry('experience', exp.id, 'company', e.target.value)}
                                            placeholder="Acme Corp"
                                        />
                                        <Field
                                            label="Location"
                                            id={`exp-location-${exp.id}`}
                                            value={exp.location}
                                            onChange={(e) => updateEntry('experience', exp.id, 'location', e.target.value)}
                                            placeholder="New York, NY"
                                        />
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                Currently Working Here
                                            </label>
                                            <label className="flex items-center gap-2.5 cursor-pointer py-2">
                                                <button
                                                    type="button"
                                                    role="checkbox"
                                                    aria-checked={exp.current}
                                                    onClick={() => updateEntry('experience', exp.id, 'current', !exp.current)}
                                                    className={`
                                                        w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                                                        ${exp.current ? 'bg-primary border-primary' : 'border-border/60 bg-background'}
                                                    `}
                                                >
                                                    {exp.current && <Check className="w-3 h-3 text-white" />}
                                                </button>
                                                <span className="text-sm text-muted-foreground">Yes, I currently work here</span>
                                            </label>
                                        </div>
                                        <Field
                                            label="Start Date"
                                            id={`exp-start-${exp.id}`}
                                            value={exp.startDate}
                                            onChange={(e) => updateEntry('experience', exp.id, 'startDate', e.target.value)}
                                            placeholder="Jan 2022"
                                        />
                                        <Field
                                            label="End Date"
                                            id={`exp-end-${exp.id}`}
                                            value={exp.current ? 'Present' : exp.endDate}
                                            onChange={(e) => updateEntry('experience', exp.id, 'endDate', e.target.value)}
                                            placeholder="Dec 2023"
                                            disabled={exp.current}
                                        />
                                    </div>
                                    <TextAreaField
                                        label="Description"
                                        id={`exp-desc-${exp.id}`}
                                        value={exp.description}
                                        onChange={(e) => updateEntry('experience', exp.id, 'description', e.target.value)}
                                        placeholder="Describe your responsibilities, achievements, and impact…"
                                    />
                                    <ImproveWithAiButton
                                        text={exp.description}
                                        context="experience"
                                        onImproved={(t) => updateEntry('experience', exp.id, 'description', t)}
                                    />
                                </div>
                            ))}
                            <AddEntryButton
                                onClick={() => addEntry('experience', emptyExperience)}
                                label="Add Another Position"
                            />
                        </SectionCard>

                        {/* ─────────── PROJECTS ─────────── */}
                        <SectionCard id="projects" title="Projects" icon={FolderGit2}>
                            {formData.projects.map((proj, idx) => (
                                <div key={proj.id} className="space-y-4">
                                    {idx > 0 && <EntryDivider />}

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Project {idx + 1}
                                        </span>
                                        {formData.projects.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEntry('projects', proj.id)}
                                                className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    {/* Autofill dropdown */}
                                    <AutofillDropdown
                                        options={projectDropdownOptions}
                                        placeholder="Autofill from GitHub"
                                        sourceLabel="GitHub Repositories"
                                        sourceIcon={<Github className="w-3.5 h-3.5" />}
                                        noDataMessage="No GitHub repositories found. Sync GitHub to enable autofill."
                                        onSelect={(v) => autofillProject(proj.id, v)}
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field
                                            label="Project Name"
                                            id={`proj-name-${proj.id}`}
                                            value={proj.name}
                                            onChange={(e) => updateEntry('projects', proj.id, 'name', e.target.value)}
                                            placeholder="My Awesome Project"
                                        />
                                        <Field
                                            label="Repository URL"
                                            id={`proj-url-${proj.id}`}
                                            value={proj.repoUrl}
                                            onChange={(e) => updateEntry('projects', proj.id, 'repoUrl', e.target.value)}
                                            placeholder="https://github.com/user/repo"
                                        />
                                        <Field
                                            label="Tech Stack"
                                            id={`proj-stack-${proj.id}`}
                                            value={proj.techStack}
                                            onChange={(e) => updateEntry('projects', proj.id, 'techStack', e.target.value)}
                                            placeholder="React, Node.js, PostgreSQL"
                                        />
                                        <div className="flex gap-3">
                                            {proj.stars !== null && (
                                                <Badge variant="outline" className="text-xs self-end mb-1">
                                                    ⭐ {proj.stars}
                                                </Badge>
                                            )}
                                            {proj.forks !== null && (
                                                <Badge variant="outline" className="text-xs self-end mb-1">
                                                    🍴 {proj.forks}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <TextAreaField
                                        label="Description"
                                        id={`proj-desc-${proj.id}`}
                                        value={proj.description}
                                        onChange={(e) => updateEntry('projects', proj.id, 'description', e.target.value)}
                                        placeholder="What does this project do? What problem does it solve?"
                                    />
                                    <ImproveWithAiButton
                                        text={proj.description}
                                        context="project"
                                        onImproved={(t) => updateEntry('projects', proj.id, 'description', t)}
                                    />
                                </div>
                            ))}
                            <AddEntryButton
                                onClick={() => addEntry('projects', emptyProject)}
                                label="Add Another Project"
                            />
                        </SectionCard>

                        {/* ─────────── EDUCATION ─────────── */}
                        <SectionCard id="education" title="Education" icon={GraduationCap}>
                            {formData.education.map((edu, idx) => (
                                <div key={edu.id} className="space-y-4">
                                    {idx > 0 && <EntryDivider />}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Degree {idx + 1}
                                        </span>
                                        {formData.education.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEntry('education', edu.id)}
                                                className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field
                                            label="Institution"
                                            id={`edu-inst-${edu.id}`}
                                            value={edu.institution}
                                            onChange={(e) => updateEntry('education', edu.id, 'institution', e.target.value)}
                                            placeholder="Institution name"
                                        />
                                        <Field
                                            label="Degree"
                                            id={`edu-degree-${edu.id}`}
                                            value={edu.degree}
                                            onChange={(e) => updateEntry('education', edu.id, 'degree', e.target.value)}
                                            placeholder="Bachelor of Science"
                                        />
                                        <Field
                                            label="Field of Study"
                                            id={`edu-field-${edu.id}`}
                                            value={edu.field}
                                            onChange={(e) => updateEntry('education', edu.id, 'field', e.target.value)}
                                            placeholder="Computer Science"
                                        />
                                        <Field
                                            label="GPA"
                                            id={`edu-gpa-${edu.id}`}
                                            value={edu.gpa}
                                            onChange={(e) => updateEntry('education', edu.id, 'gpa', e.target.value)}
                                            placeholder="3.9 / 4.0"
                                        />
                                        <Field
                                            label="Start Date"
                                            id={`edu-start-${edu.id}`}
                                            value={edu.startDate}
                                            onChange={(e) => updateEntry('education', edu.id, 'startDate', e.target.value)}
                                            placeholder="Sep 2018"
                                        />
                                        <Field
                                            label="End Date"
                                            id={`edu-end-${edu.id}`}
                                            value={edu.endDate}
                                            onChange={(e) => updateEntry('education', edu.id, 'endDate', e.target.value)}
                                            placeholder="May 2022"
                                        />
                                    </div>
                                    <TextAreaField
                                        label="Additional Info"
                                        id={`edu-desc-${edu.id}`}
                                        value={edu.description}
                                        onChange={(e) => updateEntry('education', edu.id, 'description', e.target.value)}
                                        placeholder="Relevant coursework, honors, activities…"
                                        rows={3}
                                    />
                                    <ImproveWithAiButton
                                        text={edu.description}
                                        context="education"
                                        onImproved={(t) => updateEntry('education', edu.id, 'description', t)}
                                    />
                                </div>
                            ))}
                            <AddEntryButton
                                onClick={() => addEntry('education', emptyEducation)}
                                label="Add Another Degree"
                            />
                        </SectionCard>

                        {/* ─────────── CERTIFICATIONS ─────────── */}
                        <SectionCard id="certifications" title="Certifications" icon={Award}>
                            {formData.certifications.map((cert, idx) => (
                                <div key={cert.id} className="space-y-4">
                                    {idx > 0 && <EntryDivider />}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Certification {idx + 1}
                                        </span>
                                        {formData.certifications.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEntry('certifications', cert.id)}
                                                className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field
                                            label="Certification Name"
                                            id={`cert-name-${cert.id}`}
                                            value={cert.name}
                                            onChange={(e) => updateEntry('certifications', cert.id, 'name', e.target.value)}
                                            placeholder="Certification name"
                                        />
                                        <Field
                                            label="Issuing Organization"
                                            id={`cert-issuer-${cert.id}`}
                                            value={cert.issuer}
                                            onChange={(e) => updateEntry('certifications', cert.id, 'issuer', e.target.value)}
                                            placeholder="Amazon Web Services"
                                        />
                                        <Field
                                            label="Date Issued"
                                            id={`cert-date-${cert.id}`}
                                            value={cert.date}
                                            onChange={(e) => updateEntry('certifications', cert.id, 'date', e.target.value)}
                                            placeholder="Mar 2023"
                                        />
                                        <Field
                                            label="Credential URL"
                                            id={`cert-url-${cert.id}`}
                                            value={cert.url}
                                            onChange={(e) => updateEntry('certifications', cert.id, 'url', e.target.value)}
                                            placeholder="https://credly.com/..."
                                        />
                                    </div>
                                </div>
                            ))}
                            <AddEntryButton
                                onClick={() => addEntry('certifications', emptyCertification)}
                                label="Add Another Certification"
                            />
                        </SectionCard>

                        {/* ─────────── SKILLS ─────────── */}
                        <SectionCard id="skills" title="Skills" icon={Wrench}>
                            {allAvailableSkills.length > 0 ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Select the skills you want to include in your resume. Sourced from your GitHub and LinkedIn data.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {allAvailableSkills.map((skill) => {
                                            const selected = formData.skills.includes(skill);
                                            return (
                                                <button
                                                    key={skill}
                                                    type="button"
                                                    onClick={() => toggleSkill(skill)}
                                                    className={`
                                                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                                        text-sm font-medium border transition-all duration-200
                                                        ${selected
                                                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                            : 'bg-muted/30 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground'
                                                        }
                                                    `}
                                                >
                                                    {selected && <Check className="w-3 h-3" />}
                                                    {skill}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {formData.skills.length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            {formData.skills.length} skill{formData.skills.length !== 1 ? 's' : ''} selected
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        No skill data from GitHub or LinkedIn. Enter skills manually below.
                                    </div>
                                </div>
                            )}

                            {/* Manual skill input */}
                            <div className="pt-2 border-t border-border/40">
                                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                                    Add custom skills
                                </p>
                                <ManualSkillInput
                                    onAdd={(skill) => {
                                        if (!formData.skills.includes(skill)) {
                                            setFormData((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
                                        }
                                    }}
                                />
                                {formData.skills.filter((s) => !allAvailableSkills.includes(s)).length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {formData.skills
                                            .filter((s) => !allAvailableSkills.includes(s))
                                            .map((skill) => (
                                                <span
                                                    key={skill}
                                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-primary/15 text-primary border border-primary/25"
                                                >
                                                    {skill}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSkill(skill)}
                                                        className="hover:text-destructive ml-0.5"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </SectionCard>

                        {/* ─────────── COURSEWORK ─────────── */}
                        <SectionCard id="coursework" title="Relevant Coursework" icon={BookOpen}>
                            <p className="text-sm text-muted-foreground -mt-2">
                                List relevant courses that demonstrate knowledge in your target field.
                            </p>
                            <div className="space-y-3">
                                {formData.coursework.map((cw, idx) => (
                                    <div key={cw.id} className="flex items-center gap-3">
                                        <Field
                                            label=""
                                            id={`cw-name-${cw.id}`}
                                            value={cw.name}
                                            onChange={(e) => updateEntry('coursework', cw.id, 'name', e.target.value)}
                                            placeholder={`Course ${idx + 1} — e.g. Algorithms & Data Structures`}
                                            className="flex-1"
                                        />
                                        {formData.coursework.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEntry('coursework', cw.id)}
                                                className="mt-0.5 text-destructive/60 hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <AddEntryButton
                                onClick={() => addEntry('coursework', emptyCoursework)}
                                label="Add Course"
                            />
                        </SectionCard>

                        {/* ─────────── AWARDS ─────────── */}
                        <SectionCard id="awards" title="Honors & Awards" icon={Trophy}>
                            {formData.awards.map((award, idx) => (
                                <div key={award.id} className="space-y-4">
                                    {idx > 0 && <EntryDivider />}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Award {idx + 1}
                                        </span>
                                        {formData.awards.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEntry('awards', award.id)}
                                                className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field
                                            label="Award Title"
                                            id={`award-title-${award.id}`}
                                            value={award.title}
                                            onChange={(e) => updateEntry('awards', award.id, 'title', e.target.value)}
                                            placeholder="Award or honor title"
                                        />
                                        <Field
                                            label="Issuing Body"
                                            id={`award-issuer-${award.id}`}
                                            value={award.issuer}
                                            onChange={(e) => updateEntry('awards', award.id, 'issuer', e.target.value)}
                                            placeholder="Issuing organization"
                                        />
                                        <Field
                                            label="Date"
                                            id={`award-date-${award.id}`}
                                            value={award.date}
                                            onChange={(e) => updateEntry('awards', award.id, 'date', e.target.value)}
                                            placeholder="May 2022"
                                        />
                                    </div>
                                    <TextAreaField
                                        label="Description"
                                        id={`award-desc-${award.id}`}
                                        value={award.description}
                                        onChange={(e) => updateEntry('awards', award.id, 'description', e.target.value)}
                                        placeholder="Briefly describe the award, selection criteria, or significance…"
                                        rows={2}
                                    />
                                    <ImproveWithAiButton
                                        text={award.description}
                                        context="award"
                                        onImproved={(t) => updateEntry('awards', award.id, 'description', t)}
                                    />
                                </div>
                            ))}
                            <AddEntryButton
                                onClick={() => addEntry('awards', emptyAward)}
                                label="Add Another Award"
                            />
                        </SectionCard>

                        {/* ─────────── PUBLICATIONS ─────────── */}
                        <SectionCard id="publications" title="Publications" icon={BookMarked}>
                            {formData.publications.map((pub, idx) => (
                                <div key={pub.id} className="space-y-4">
                                    {idx > 0 && <EntryDivider />}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Publication {idx + 1}
                                        </span>
                                        {formData.publications.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEntry('publications', pub.id)}
                                                className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field
                                            label="Title"
                                            id={`pub-title-${pub.id}`}
                                            value={pub.title}
                                            onChange={(e) => updateEntry('publications', pub.id, 'title', e.target.value)}
                                            placeholder="Publication title"
                                            className="sm:col-span-2"
                                        />
                                        <Field
                                            label="Authors"
                                            id={`pub-authors-${pub.id}`}
                                            value={pub.authors}
                                            onChange={(e) => updateEntry('publications', pub.id, 'authors', e.target.value)}
                                            placeholder="Jane Smith, John Doe"
                                        />
                                        <Field
                                            label="Journal / Conference"
                                            id={`pub-journal-${pub.id}`}
                                            value={pub.journal}
                                            onChange={(e) => updateEntry('publications', pub.id, 'journal', e.target.value)}
                                            placeholder="NeurIPS 2023"
                                        />
                                        <Field
                                            label="Year"
                                            id={`pub-year-${pub.id}`}
                                            value={pub.year}
                                            onChange={(e) => updateEntry('publications', pub.id, 'year', e.target.value)}
                                            placeholder="2023"
                                        />
                                        <Field
                                            label="URL / DOI"
                                            id={`pub-url-${pub.id}`}
                                            value={pub.url}
                                            onChange={(e) => updateEntry('publications', pub.id, 'url', e.target.value)}
                                            placeholder="https://arxiv.org/abs/..."
                                        />
                                    </div>
                                </div>
                            ))}
                            <AddEntryButton
                                onClick={() => addEntry('publications', emptyPublication)}
                                label="Add Another Publication"
                            />
                        </SectionCard>

                        {/* ─────────── Actions ─────────── */}
                        <div className="flex items-center justify-between pt-2 pb-10">
                            <Link
                                href="/resume-builder"
                                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Step 1
                            </Link>
                            <Button
                                id="resume-form-next-btn"
                                size="lg"
                                disabled={!canProceed}
                                onClick={() => {
                                    localStorage.setItem('resumeBuilderData', JSON.stringify(formData));
                                    router.push('/resume-builder/preview');
                                }}
                                className="gap-2 min-w-[180px]"
                                title={!canProceed ? 'Please fill in at least your name and email.' : ''}
                            >
                                <Sparkles className="w-4 h-4" />
                                Continue
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Manual Skill Input ────────────────────────────────────────────────────────

function ManualSkillInput({ onAdd }: { onAdd: (skill: string) => void }) {
    const [value, setValue] = useState('');

    function submit() {
        const trimmed = value.trim();
        if (!trimmed) return;
        onAdd(trimmed);
        setValue('');
    }

    return (
        <div className="flex gap-2">
            <input
                type="text"
                id="manual-skill-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                placeholder="Type a skill and press Enter…"
                className="
                    flex-1 rounded-lg border border-border/60 bg-background
                    px-3 py-2 text-sm text-foreground
                    placeholder:text-muted-foreground/50
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
                    transition-colors
                "
            />
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={submit}
                className="shrink-0"
            >
                <Plus className="w-4 h-4" />
                Add
            </Button>
        </div>
    );
}
