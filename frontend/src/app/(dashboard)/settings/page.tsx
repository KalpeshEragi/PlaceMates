"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  LogOut,
  Sun,
  Moon,
  Monitor,
  User,
  Mail,
  Github,
  Linkedin,
  FileText,
  Shield,
  Palette,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logout();
    router.push("/Authentication");
  };

  const themeOptions: { value: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, appearance, and preferences.
        </p>
      </div>

      {/* ── Account Section ───────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h2>
        <div className="rounded-xl border bg-card shadow-sm divide-y">
          {/* Profile Info */}
          <div className="p-4 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {user?.profile?.name || "User"}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user?.email || "—"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/profile")}
              className="shrink-0"
            >
              Edit
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Connections */}
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Connected Accounts</p>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 text-sm">
                <Github className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">GitHub</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user?.githubConnected
                      ? "bg-accent/15 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {user?.githubConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">LinkedIn</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user?.linkedinImported
                      ? "bg-accent/15 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {user?.linkedinImported ? "Imported" : "Not imported"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Resume</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user?.resumeUploaded
                      ? "bg-accent/15 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {user?.resumeUploaded ? "Uploaded" : "Not uploaded"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Appearance Section ─────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Appearance
        </h2>
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <p className="text-sm font-medium mb-3">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all border ${
                  theme === opt.value
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Data & Privacy Section ─────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Data & Privacy
        </h2>
        <div className="rounded-xl border bg-card shadow-sm divide-y">
          <div className="p-4">
            <p className="text-sm font-medium">Onboarding Stage</p>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">
              {user?.onboardingStage || "—"}
            </p>
          </div>
          <div className="p-4">
            <p className="text-sm font-medium">Account ID</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
              {user?.id || "—"}
            </p>
          </div>
        </div>
      </section>

      {/* ── Danger Zone ────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive/70">
          Session
        </h2>
        <div className="rounded-xl border border-destructive/20 bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Log out</p>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
