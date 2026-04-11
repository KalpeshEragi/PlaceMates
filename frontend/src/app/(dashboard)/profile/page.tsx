"use client";

/**
 * Profile Page
 *
 * Two-column layout:
 *   LEFT  — Editable profile data (scrollable)
 *   RIGHT — Computed insights (sticky on desktop)
 *
 * Fetches profile data + insights in parallel on mount.
 * Insights auto-refresh after any profile edit.
 */

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { profileApi } from "@/lib/api/profile-api";
import type {
  ProfileData,
  ProfileInsights,
  UpdateProfileBody,
} from "@/lib/api/profile-api";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { ProfileInsightsPanel } from "@/components/profile/ProfileInsightsPanel";
import styles from "@/components/profile/profile.module.css";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [insights, setInsights] = useState<ProfileInsights | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Fetch everything on mount ──
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [profileData, insightsData] = await Promise.all([
        profileApi.getData(),
        profileApi.getInsights(),
      ]);
      setProfile(profileData);
      setInsights(insightsData);
    } catch (err) {
      console.error("[Profile] fetch failed:", err);
      setError((err as Error).message ?? "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Save handler (passed to ProfileEditor) ──
  const handleSave = useCallback(
    async (body: UpdateProfileBody) => {
      try {
        setSaving(true);
        await profileApi.updateData(body);

        // Re-fetch both profile data and insights so everything stays in sync
        const [profileData, insightsData] = await Promise.all([
          profileApi.getData(),
          profileApi.getInsights(),
        ]);
        setProfile(profileData);
        setInsights(insightsData);
      } catch (err) {
        console.error("[Profile] save failed:", err);
        // Could add toast here
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2
          className="animate-spin"
          size={32}
          style={{ color: "var(--primary)" }}
        />
        <p className={styles.loadingText}>Loading your profile...</p>
      </div>
    );
  }

  // ── Error state ──
  if (error || !profile) {
    return (
      <div className={styles.loadingContainer}>
        <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>
          {error ?? "Something went wrong."}
        </p>
        <button className={styles.editBtn} onClick={fetchAll}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Page Header ──────────────────────── */}
      <div
        className={styles.profileLayout}
        style={{ paddingBottom: 0, gap: 0 }}
      >
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderGlow} />
          <div className={styles.pageHeaderGlowRight} />
          <h1 className={styles.pageTitle}>
            Your{" "}
            <span className="gradient-text">Profile</span>
          </h1>
          <p className={styles.pageSubtitle}>
            Manage your professional information and see how your data translates
            into actionable insights.
          </p>
        </div>
      </div>

      {/* ── Two-Column Layout ────────────────── */}
      <div className={styles.profileLayout}>
        {/* LEFT: Editable Profile */}
        <div>
          <ProfileEditor
            profile={profile}
            onSave={handleSave}
            saving={saving}
          />
        </div>

        {/* RIGHT: Insights Panel */}
        <ProfileInsightsPanel insights={insights} loading={loading} />
      </div>
    </div>
  );
}
