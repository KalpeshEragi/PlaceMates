"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Github, CheckCircle2, AlertCircle } from "lucide-react";

function GitHubSuccessHandler() {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [status, setStatus] = useState<"syncing" | "success" | "error">("syncing");

    useEffect(() => {
        let mounted = true;

        async function syncAndRedirect() {
            try {
                // Refresh user data so the dashboard sees GitHub as connected
                await refreshUser();
                if (!mounted) return;
                setStatus("success");

                // Short delay so user sees the success state
                setTimeout(() => {
                    if (mounted) router.replace("/");
                }, 1200);
            } catch {
                if (!mounted) return;
                setStatus("error");

                // Redirect anyway after a moment
                setTimeout(() => {
                    if (mounted) router.replace("/");
                }, 2000);
            }
        }

        syncAndRedirect();
        return () => { mounted = false; };
    }, [refreshUser, router]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center space-y-4">
                {/* GitHub icon */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#24292e]">
                    <Github className="h-8 w-8 text-white" />
                </div>

                {status === "syncing" && (
                    <>
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-muted-foreground">
                            Syncing your GitHub account…
                        </p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
                        <p className="text-green-400 font-medium">
                            GitHub connected successfully!
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Redirecting to dashboard…
                        </p>
                    </>
                )}

                {status === "error" && (
                    <>
                        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                        <p className="text-destructive font-medium">
                            Something went wrong
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Redirecting to dashboard…
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function GitHubSuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            }
        >
            <GitHubSuccessHandler />
        </Suspense>
    );
}
