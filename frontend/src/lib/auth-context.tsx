"use client";
/* ──────────────────────────────────────────────────────────
 * Auth Context — provides user state across the app
 * ────────────────────────────────────────────────────────── */

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { authApi } from "@/lib/api/auth-api";
export interface User {
    id: string;
    email: string;
    githubConnected: boolean;
    linkedinImported: boolean;
    onboardingStage: string;
    profile?: {
        name?: string | null;
        avatarUrl?: string | null;
    } | null;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (token: string) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = useCallback(async () => {
        try {
            const token =
                typeof window !== "undefined" ? localStorage.getItem("token") : null;
            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            }
            const data = await authApi.getMe();
            setUser(data);
        } catch (err) {
            console.warn("[Auth] Failed to fetch user profile:", (err as Error).message);
            setUser(null);
            if (typeof window !== "undefined") {
                localStorage.removeItem("token");
                document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = useCallback(
        (token: string) => {
            localStorage.setItem("token", token);
            document.cookie = `token=${token}; path=/; max-age=86400`;
            fetchUser();
        },
        [fetchUser]
    );

    const logout = useCallback(() => {
        localStorage.removeItem("token");
        document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, loading, login, logout, refreshUser: fetchUser }),
        [user, loading, login, logout, fetchUser]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
