"use client";

import { useEffect, useState } from "react";
import { JobPreferencesForm } from "./job-preferences-form";
import { JobPreferencesSummary } from "./job-preferences-summary";
import type { JobPreferences } from "./job-preferences-types";
import { jobPreferencesApi } from "@/lib/api/job-preferences-api";
import { Loader2, AlertCircle } from "lucide-react";

export default function JobPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<JobPreferences | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const data = await jobPreferencesApi.get();
        setPreferences(data); // null if not set yet — that's fine
      } catch (error) {
        console.error("Error fetching preferences:", error);
        setFetchError("Failed to load your preferences. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const handleSave = async (data: JobPreferences) => {
    const saved = await jobPreferencesApi.save(data);
    setPreferences(saved);
    setIsEditing(false);
  };

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-muted-foreground animate-pulse text-sm">
          Loading your preferences...
        </p>
      </div>
    );
  }

  // ── Fetch error state ──────────────────────────────────────
  if (fetchError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 space-y-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-muted-foreground text-sm">{fetchError}</p>
      </div>
    );
  }

  const showForm = !preferences || isEditing;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Job{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-teal-500 text-transparent bg-clip-text">
              Preferences
            </span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {showForm
              ? "Tell us what you're looking for so we can tailor your job matches and portfolio visibility."
              : "Review your active preferences. We'll use these exact criteria to find your next great opportunity."}
          </p>
        </div>
      </div>

      {/* Form / Summary */}
      <div className="rounded-2xl border bg-card/50 text-card-foreground shadow-sm p-6 md:p-10 backdrop-blur-sm relative z-10">
        {showForm ? (
          <JobPreferencesForm
            initialData={preferences || undefined}
            onSave={handleSave}
            onCancel={preferences ? () => setIsEditing(false) : undefined}
          />
        ) : (
          <JobPreferencesSummary
            preferences={preferences}
            onEdit={() => setIsEditing(true)}
          />
        )}
      </div>

    </div>
  );
}