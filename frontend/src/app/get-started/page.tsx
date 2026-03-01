"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sparkles, ArrowRight, LogOut, Loader2 } from "lucide-react";

export default function GetStartedPage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) router.replace("/Authentication");
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0F172A]">
                <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0F172A] relative overflow-hidden">
            <header className="relative z-10 flex items-center justify-between border-b border-[#334155]/50 bg-[#0F172A]/80 px-6 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-white">PlaceMates</h1>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-[#94A3B8]">{user.email}</span>
                    <button
                        onClick={() => {
                            logout();
                            router.replace("/Authentication");
                        }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[#64748B] hover:text-[#94A3B8] hover:bg-[#1E293B] transition-colors"
                    >
                        <LogOut className="h-3 w-3" />
                        Logout
                    </button>
                </div>
            </header>

            <main className="relative z-10 mx-auto max-w-4xl px-6 py-16 text-center">
                <h2 className="text-4xl font-bold text-white sm:text-5xl mb-6">
                    Welcome to PlaceMates
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-[#94A3B8] mb-12">
                    You have successfully authenticated. Redesign phase ongoing!
                </p>
                <button
                    onClick={() => router.replace("/")}
                    className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-8 py-4 text-lg font-semibold text-white transition-all hover:-translate-y-0.5"
                >
                    Go back to Landing Page
                    <ArrowRight className="h-5 w-5 transition-transform" />
                </button>
            </main>
        </div>
    );
}
