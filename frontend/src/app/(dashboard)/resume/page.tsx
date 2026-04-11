"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil } from "lucide-react";
import { onboardingApi } from "@/lib/api/onboarding-api";
import type { UserPreviewPayload } from "@/lib/api/onboarding-api";
import type { ResumeData } from "@/components/templates/resume/Template1";
import type { ResumeTemplateId } from "@/lib/templates/template-registry";
import { ResumePreviewPanel } from "@/components/resume-studio/ResumePreviewPanel";
import { ResumeEditingPanel } from "@/components/resume-studio/ResumeEditingPanel";
import { ActionBar } from "@/components/resume-studio/ActionBar";
import type { SaveStatus } from "@/components/resume-studio/ActionBar";
import "./resume-studio.css";

/* ── Deep equality check (JSON-based — fine for our data shapes) ── */
function deepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ResumeStudioPage() {
  const router = useRouter();

  /* ── Core state ─────────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewPayload, setPreviewPayload] = useState<UserPreviewPayload | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [originalData, setOriginalData] = useState<ResumeData | null>(null);
  const [templateId, setTemplateId] = useState<ResumeTemplateId>("r1");
  const [originalTemplateId, setOriginalTemplateId] = useState<ResumeTemplateId>("r1");

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [mobileTab, setMobileTab] = useState<"preview" | "edit">("preview");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch data ─────────────────────────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/Authentication");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const payload = await onboardingApi.getPreviewData();
        if (cancelled) return;

        setPreviewPayload(payload);

        const data: ResumeData = payload.resumeData;
        setResumeData(structuredClone(data));
        setOriginalData(structuredClone(data));

        const tid = (payload.resumeTemplateId ?? "r1") as ResumeTemplateId;
        setTemplateId(tid);
        setOriginalTemplateId(tid);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Failed to load resume.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [router]);

  /* ── Derived state ──────────────────────────────────────────── */
  const hasChanges =
    (resumeData && originalData && !deepEqual(resumeData, originalData)) ||
    templateId !== originalTemplateId;

  /* ── Handlers ───────────────────────────────────────────────── */

  const handleDataChange = useCallback((data: ResumeData) => {
    setResumeData(data);
    setSaveStatus("idle");
  }, []);

  const handleTemplateChange = useCallback((id: ResumeTemplateId) => {
    setTemplateId(id);
    setSaveStatus("idle");
  }, []);

  const handleSave = useCallback(async () => {
    if (!resumeData || !previewPayload) return;

    setSaveStatus("saving");

    try {
      // Build the projects payload — need IDs from preview payload
      const projectsPayload = resumeData.projects.map((proj) => {
        // Try to match by name to get the ID from the portfolio data
        const originalProject = previewPayload.portfolioData.projects.find(
          (p) => p.name === proj.name,
        );
        return {
          id: originalProject?.id ?? proj.name, // Fallback to name if no ID found
          finalBullets: proj.finalBullets.filter((b) => b.trim() !== ""),
          projectIntent: null as string | null,
        };
      });

      const skillNames = resumeData.skills.map((s) => s.name);

      await onboardingApi.finalizeOutput({
        portfolioTemplate: previewPayload.portfolioTemplateId ?? "p1",
        resumeTemplate: templateId,
        summary: resumeData.summary ?? "",
        skills: skillNames,
        projects: projectsPayload,
      });

      // Update original snapshots
      setOriginalData(structuredClone(resumeData));
      setOriginalTemplateId(templateId);
      setSaveStatus("saved");

      // Clear saved status after 3s
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      console.error("Save failed:", e);
      setSaveStatus("error");
    }
  }, [resumeData, previewPayload, templateId]);

  const handleDownload = useCallback(() => {
    window.print();
  }, []);

  const handleReset = useCallback(() => {
    if (!originalData) return;
    setResumeData(structuredClone(originalData));
    setTemplateId(originalTemplateId);
    setSaveStatus("idle");
  }, [originalData, originalTemplateId]);

  /* ── Render: Loading ────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="rs-skeleton">
        <div className="rs-skeleton-spinner" />
        <p className="rs-skeleton-text">Loading your resume…</p>
      </div>
    );
  }

  /* ── Render: Error ──────────────────────────────────────────── */
  if (error || !resumeData) {
    return (
      <div className="rs-error">
        <p className="rs-error-text">{error ?? "No resume data found."}</p>
        <button
          type="button"
          className="rs-btn rs-btn-secondary"
          onClick={() => router.push("/dashboard")}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  /* ── Render: Studio ─────────────────────────────────────────── */
  return (
    <div className="rs-studio">
      {/* Header — static, never scrolls */}
      <div className="rs-header">
        <div className="rs-header-glow" />
        <h1>
          Resume{" "}
          <span className="gradient-text bg-gradient-to-r from-indigo-500 to-teal-500 text-transparent bg-clip-text">
            Studio
          </span>
        </h1>
        <p>Edit, preview, and perfect your resume in real-time.</p>
      </div>

      {/* Mobile Tabs */}
      <div className="rs-mobile-tabs">
        <button
          type="button"
          className="rs-tab-btn"
          data-active={mobileTab === "preview"}
          onClick={() => setMobileTab("preview")}
        >
          <Eye size={14} />
          Preview
        </button>
        <button
          type="button"
          className="rs-tab-btn"
          data-active={mobileTab === "edit"}
          onClick={() => setMobileTab("edit")}
        >
          <Pencil size={14} />
          Edit
        </button>
      </div>

      {/* Body — flex row that fills remaining height */}
      <div className="rs-body">
        {/* Left: Preview — scrolls independently */}
        <div className={`rs-panel rs-panel-preview ${mobileTab === "edit" ? "rs-hide-mobile" : ""}`}>
          <ResumePreviewPanel resumeData={resumeData} templateId={templateId} />
        </div>

        {/* Right: Editor — scrolls independently */}
        <div className={`rs-panel rs-panel-edit ${mobileTab === "preview" ? "rs-hide-mobile" : ""}`}>
          <ResumeEditingPanel
            resumeData={resumeData}
            templateId={templateId}
            onDataChange={handleDataChange}
            onTemplateChange={handleTemplateChange}
          />
        </div>
      </div>

      {/* Action Bar — fixed at bottom */}
      <ActionBar
        hasChanges={!!hasChanges}
        saveStatus={saveStatus}
        onSave={handleSave}
        onDownload={handleDownload}
        onReset={handleReset}
      />
    </div>
  );
}
