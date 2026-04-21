"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi, type AdminResumeResult } from "@/lib/api/admin-api";

// Forcefully download the URL as a Blob to enforce the exact .pdf extension on the client
async function forcePdfDownload(e: React.MouseEvent<HTMLAnchorElement>, url: string, requestedName: string) {
  e.preventDefault();
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error during file download");
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    const cleanName = requestedName.replace(/[^a-zA-Z0-9_-]/g, "_");
    a.download = `${cleanName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error("Failed to intercept and rename download, falling back to new tab", error);
    window.open(url, "_blank");
  }
}

// Hardcoded mock data for unknown jobs (from job-matches page)
const MOCK_TITLES = [
  "Frontend Software Engineer",
  "Full Stack Developer",
  "Backend Engineer",
  "Software Development Engineer",
  "React Native Developer",
  "Senior Web Developer",
];
const MOCK_COMPANIES = [
  "Tata Consultancy Services",
  "Infosys",
  "Wipro",
  "Zomato",
  "Flipkart",
  "Razorpay",
  "Zerodha",
  "Zoho",
  "Swiggy",
  "Groww",
];

function getMockTitle(id: string, original: string) {
  if (original && original !== "Unknown Job" && original !== "Unknown") return original;
  const hash = Array.from(id || "").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return MOCK_TITLES[hash % MOCK_TITLES.length];
}

function getMockCompany(id: string, original: string) {
  if (original && original !== "Unknown Company" && original !== "Unknown") return original;
  const hash = Array.from(id || "").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return MOCK_COMPANIES[hash % MOCK_COMPANIES.length];
}

export default function AdminPage() {
  const [resumes, setResumes] = useState<AdminResumeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResumes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getAllResumes();
      setResumes(res.resumes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resumes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const hasResults = resumes.length > 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs text-primary">
              👑
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            View and download all generated resumes across the platform.
          </p>
        </div>

        <button
          onClick={fetchResumes}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
        >
          <RefreshIcon />
          Refresh
        </button>
      </div>

      {loading && !hasResults && (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8 text-center">
          <div className="mx-auto w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground mt-4">Loading resumes…</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !hasResults && !error && (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
            📭
          </div>
          <h2 className="text-xl font-semibold">No Resumes Found</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            No users have generated any tailored resumes yet.
          </p>
        </div>
      )}

      {hasResults && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">
                  {resumes.length}
                </span>
                <span className="text-muted-foreground">Total Resumes</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span className="text-lg">📄</span> All User Resumes
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {resumes.map((resume) => (
                <AdminResumeCard key={resume.id} resume={resume} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminResumeCard({ resume }: { resume: AdminResumeResult }) {
  const title = getMockTitle(resume.job.id, resume.job.title);
  const company = getMockCompany(resume.job.id, resume.job.company);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
          👤
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm truncate">{resume.user.name}</h4>
          <p className="text-xs text-muted-foreground truncate" title={resume.user.email}>
            {resume.user.email}
          </p>
        </div>
        {resume.atsScore != null && (
          <div className={`flex-shrink-0 text-center ${
            resume.atsScore >= 75
              ? "text-green-600"
              : resume.atsScore >= 50
                ? "text-yellow-600"
                : "text-orange-600"
          }`}>
            <div className="text-lg font-bold leading-none">{resume.atsScore}</div>
            <div className="text-[9px] font-medium opacity-75">ATS</div>
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-lg p-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold truncate">🏢 {company}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span className="truncate">💼 {title}</span>
        </div>
      </div>

      <div className="flex gap-2">
         <a
          href={resume.resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 flex-1 justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted cursor-pointer"
         >
           <ViewIcon /> View
         </a>
         <a
           href={resume.resumeUrl}
           onClick={(e) => forcePdfDownload(e, resume.resumeUrl, `${resume.user.name.replace(/\s+/g, "_")}_${company}_Resume`)}
           className="inline-flex items-center gap-1.5 flex-1 justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
         >
           <DownloadIcon /> Download
         </a>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}
