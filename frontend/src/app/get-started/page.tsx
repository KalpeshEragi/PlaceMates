"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, Github, Upload, CheckCircle2, Loader2, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

export default function GetStartedPage() {
    const { user, loading, refreshUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!loading && !user) router.replace("/Authentication");
    }, [user, loading, router]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleGithubConnect = () => {
        const token = localStorage.getItem("token");
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
        window.location.href = `${apiBase}/auth/github?token=${token}`;
    };

    const handleLinkedinUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.zip')) {
            toast({
                title: "Invalid file",
                description: "Please upload a ZIP file containing your LinkedIn data.",
                variant: "destructive",
            });
            return;
        }

        setIsUploading(true);
        try {
            const token = localStorage.getItem("token");
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(`${apiBase}/linkedin/upload`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to upload file");
            }

            await refreshUser();

            toast({
                title: "Success",
                description: "LinkedIn data uploaded successfully! We are processing it.",
            });

        } catch (error: any) {
            toast({
                title: "Upload Failed",
                description: error.message || "Something went wrong during upload.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
            e.target.value = ''; // Reset file input
        }
    };

    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const allConnected = user.githubConnected && user.linkedinImported;

    return (
        <div className="min-h-screen bg-background overflow-x-hidden relative">
            {/* Dynamic Background matching landing page */}
            <div
                className="fixed inset-0 pointer-events-none z-0 opacity-30"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.15), transparent 40%)`
                }}
            />

            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                            P
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            PlaceMate
                        </span>
                    </div>
                </div>
            </nav>

            <main className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-32 pb-20">
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
                        Complete your{' '}
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Profile
                        </span>
                    </h1>
                    <p className="text-xl text-muted-foreground mx-auto max-w-2xl">
                        Connect your professional accounts to help us match you with the best opportunities and build your AI resume.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* GitHub Card */}
                    <Card className="group relative overflow-hidden border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-500/10 to-slate-800/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <CardHeader>
                            <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center shadow-lg mb-4">
                                <Github className="w-6 h-6 text-foreground" />
                            </div>
                            <CardTitle className="text-2xl">Connect GitHub</CardTitle>
                            <CardDescription className="text-base text-muted-foreground">
                                Link your GitHub account so we can automatically analyze your repositories, commits, and languages.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {user.githubConnected ? (
                                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400 p-3 rounded-lg border border-green-200 dark:border-green-500/20">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="font-medium">Connected successfully</span>
                                </div>
                            ) : (
                                <Button
                                    onClick={handleGithubConnect}
                                    className="w-full bg-foreground text-background hover:bg-foreground/90 shadow-lg hover:shadow-xl transition-all duration-300"
                                >
                                    <Github className="w-4 h-4 mr-2" />
                                    Connect GitHub
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* LinkedIn Card */}
                    <Card className="group relative overflow-hidden border-0 bg-muted/30 hover:bg-muted/50 transition-all duration-500">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <CardHeader>
                            <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center shadow-lg mb-4">
                                <svg
                                    className="w-6 h-6 text-[#0A66C2]"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                            </div>
                            <CardTitle className="text-2xl">Upload LinkedIn</CardTitle>
                            <CardDescription className="text-base text-muted-foreground">
                                Upload your LinkedIn data archive (ZIP format) to instantly import your work history and education.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {user.linkedinImported ? (
                                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400 p-3 rounded-lg border border-green-200 dark:border-green-500/20">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="font-medium">Uploaded successfully</span>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".zip"
                                        onChange={handleLinkedinUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        disabled={isUploading}
                                    />
                                    <Button
                                        variant="outline"
                                        className="w-full relative z-0 shadow-sm border-2 hover:bg-muted/50 transition-all"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" />
                                                Choose ZIP File
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                        Need help exporting? <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer" className="text-primary hover:underline">Click here</a>
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {allConnected && (
                    <div className="mt-16 flex justify-center animate-in fade-in zoom-in duration-500">
                        <Link href="/dashboard">
                            <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full px-8 h-14 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
                                Go to Dashboard
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </div>
                )}
                {!allConnected && (
                    <div className="mt-16 flex justify-center text-center">
                        <Link href="/dashboard">
                            <Button variant="ghost" className="text-muted-foreground hover:text-foreground group">
                                Skip for now
                                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
