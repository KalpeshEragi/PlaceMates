"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api/auth-api";
import { Suspense } from "react";

function AuthSuccessHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { login } = useAuth();

    useEffect(() => {
        async function handleAuth() {
            const token = searchParams.get("token");

            if (!token) {
                router.replace("/Authentication?error=no_token");
                return;
            }

            try {
                // 1. Save token
                login(token);

                // 2. Verify token by fetching profile
                await authApi.getMe();

                // 3. Always enter deterministic onboarding flow
                router.replace("/onboarding");

            } catch (err) {
                console.error(err);
                router.replace("/Authentication?error=failed");
            }
        }

        handleAuth();
    }, [searchParams, login, router]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Setting up your account…</p>
            </div>
        </div>
    );
}

export default function AuthSuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            }
        >
            <AuthSuccessHandler />
        </Suspense>
    );
}