"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
    Github,
    Linkedin,
    Briefcase,
    ArrowLeft,
    CheckCircle2,
    ShieldCheck,
    Zap,
    FileText,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export default function AuthenticationPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!loading && user) router.replace("/dashboard");
    }, [user, loading, router]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    const benefits = [
        {
            icon: Github,
            title: "GitHub Analysis",
            desc: "Repos analysed, resume bullets auto-generated from your commits",
        },
        {
            icon: Linkedin,
            title: "LinkedIn Import",
            desc: "Experience, skills & education structured in seconds",
        },
        {
            icon: Briefcase,
            title: "Job Matching",
            desc: "Fresh roles matched to your profile every 6 hours",
        },
    ];

    return (
        <div className="min-h-screen bg-background overflow-hidden">
            {/* Dynamic cursor-following gradient */}
            <div
                className="fixed inset-0 pointer-events-none z-0 opacity-30"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.15), transparent 40%)`,
                }}
            />

            {/* Decorative blurred orbs */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />
            </div>

            {/* Navigation */}
            <nav className="relative z-50 bg-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
                    <Link href="/" className="flex items-center gap-3 group cursor-pointer">
                        <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            P
                            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            PlaceMate
                        </span>
                    </Link>
                    <Link
                        href="/"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </nav>

            {/* Main content */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-16 pb-20">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[calc(100vh-12rem)]">

                    {/* Left column */}
                    <div className="hidden lg:flex flex-col space-y-10">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                                <ShieldCheck className="w-4 h-4" />
                                Secure &amp; Private Authentication
                            </div>

                            <h1 className="text-5xl font-bold tracking-tight leading-[1.1]">
                                Your placement{" "}
                                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    companion
                                </span>{" "}
                                awaits.
                            </h1>

                            <p className="text-xl text-muted-foreground leading-relaxed max-w-md">
                                Connect GitHub and LinkedIn — PlaceMate builds your
                                profile, discovers fresh jobs, and tailors your resume
                                automatically. No manual data entry.
                            </p>
                        </div>

                        {/* Benefits list */}
                        <div className="space-y-5">
                            {benefits.map((b, i) => (
                                <div key={i} className="flex items-start gap-4 group">
                                    <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                        <b.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">{b.title}</p>
                                        <p className="text-sm text-muted-foreground">{b.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Social proof */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4">
                            <div className="flex -space-x-2">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-2 border-background"
                                    />
                                ))}
                            </div>
                            <p>Trusted by students across VJTI, SPIT &amp; more</p>
                        </div>
                    </div>

                    {/* Right column — auth card */}
                    <div className="w-full flex justify-center lg:justify-end">
                        <div className="w-full max-w-md">
                            <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-muted/30 backdrop-blur-xl shadow-2xl">
                                {/* Top accent bar */}
                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                                <div className="p-8 sm:p-10">
                                    {/* Header */}
                                    <div className="text-center mb-10">
                                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                                            <FileText className="h-8 w-8 text-white" />
                                        </div>
                                        <h2 className="text-2xl font-bold tracking-tight">
                                            Get Started
                                        </h2>
                                        <p className="text-muted-foreground mt-2">
                                            Sign in to your PlaceMate account
                                        </p>
                                    </div>

                                    {/* Google OAuth button */}
                                    <Button
                                        size="lg"
                                        className="w-full h-14 gap-3 rounded-full bg-foreground text-background hover:bg-foreground/90 text-base font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300"
                                        onClick={() => {
                                            window.location.href = `${API_BASE}/auth/google`;
                                        }}
                                    >
                                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Continue with Google
                                    </Button>

                                    {/* Divider */}
                                    <div className="relative my-8">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-border/60" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-muted/30 backdrop-blur-sm px-4 text-muted-foreground font-medium">
                                                What you get
                                            </span>
                                        </div>
                                    </div>

                                    {/* Value propositions */}
                                    <div className="space-y-3">
                                        {[
                                            "Profile built from real GitHub + LinkedIn data",
                                            "Fresh jobs matched to your skills every 6 hours",
                                            "Tailored resume generated per high-match role",
                                            "Clean portfolio website — one click to publish",
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Trust badge */}
                                    <div className="mt-8 pt-6 border-t border-border/40 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                        <span>
                                            Secured with Google OAuth 2.0 — we never see your password
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Terms */}
                            <p className="text-center text-xs text-muted-foreground mt-6 px-4">
                                By continuing, you agree to our{" "}
                                <Link href="/terms" className="text-primary hover:underline">
                                    Terms of Service
                                </Link>{" "}
                                and{" "}
                                <Link href="/privacy" className="text-primary hover:underline">
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Mobile bottom bar */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-background/80 backdrop-blur-xl border-t border-border/50 p-4">
                <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-primary" /> AI-Powered
                    </span>
                    <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure
                    </span>
                    <span className="flex items-center gap-1">
                        <Github className="w-3 h-3 text-primary" /> GitHub + LinkedIn
                    </span>
                </div>
            </div>
        </div>
    );
}