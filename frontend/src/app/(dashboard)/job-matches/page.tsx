"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkflow, type WorkflowState } from "@/hooks/useWorkflow";
import {
  workflowApi,
  type JobMatchResult,
  type TailoredResumeResult,
  type MyMatchesResponse,
} from "@/lib/api/workflow-api";

// Ensure Cloudinary raw PDF URLs end with .pdf for proper browser handling
function ensurePdfUrl(url: string, filename?: string): string {
  if (!url) return url;
  // For Cloudinary raw URLs, insert fl_attachment after /upload/ to force download as PDF
  if (url.includes("/raw/upload/")) {
    const attachName = filename ? `:${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}` : ":resume";
    return url.replace("/raw/upload/", `/raw/upload/fl_attachment${attachName}/`);
  }
  return url;
}

// Hardcoded mock data for unknown jobs
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

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function JobMatchesPage() {
  const { state, data, error, isTriggering, trigger } = useWorkflow();

  // Separate state for persisted matches from the DB
  const [matches, setMatches] = useState<JobMatchResult[]>([]);
  const [resumes, setResumes] = useState<TailoredResumeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res: MyMatchesResponse = await workflowApi.getMyMatches();
      setMatches(res.matches);
      setResumes(res.tailoredResumes);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Re-fetch when workflow completes
  useEffect(() => {
    if (state === "completed") {
      fetchMatches();
    }
  }, [state, fetchMatches]);

  // Build resume lookup by jobId
  const resumeByJobId = new Map<string, TailoredResumeResult>();
  resumes.forEach((r) => resumeByJobId.set(r.job.id, r));

  const hasResults = matches.length > 0 || resumes.length > 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Job Matches</h1>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs text-primary">
              ⭐
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            AI-powered job matches personalized for your profile and
            preferences.
          </p>
        </div>

        {/* Trigger / Refresh button */}
        {(state === "idle" || state === "completed" || state === "failed") && (
          <button
            id="btn-trigger-workflow"
            onClick={trigger}
            disabled={isTriggering}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTriggering ? (
              <>
                <Spinner />
                Starting…
              </>
            ) : hasResults ? (
              <>
                <RefreshIcon />
                Re-run Matching
              </>
            ) : (
              <>
                <RocketIcon />
                Start Job Matching
              </>
            )}
          </button>
        )}
      </div>

      {/* Processing State */}
      {(state === "pending" || state === "processing") && (
        <ProcessingState state={state} />
      )}

      {/* Error State */}
      {state === "failed" && <FailedState error={error} onRetry={trigger} />}

      {/* Loading */}
      {loading && !hasResults && (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8 text-center">
          <div className="mx-auto w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground mt-4">Loading your matches…</p>
        </div>
      )}

      {/* Fetch Error */}
      {fetchError && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {fetchError}
        </div>
      )}

      {/* No results yet — idle state */}
      {!loading && !hasResults && state !== "pending" && state !== "processing" && (
        <IdleState />
      )}

      {/* Results */}
      {hasResults && (
        <div className="space-y-6">
          {/* Summary Bar */}
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">
                  {matches.length}
                </span>
                <span className="text-muted-foreground">Jobs Matched</span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">
                  {resumes.length}
                </span>
                <span className="text-muted-foreground">Tailored Resumes</span>
              </div>
              {matches.length > 0 && (
                <>
                  <div className="h-8 w-px bg-border hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-green-600">
                      {Math.round(
                        matches.reduce((acc, m) => acc + m.matchScore, 0) /
                          matches.length
                      )}
                      %
                    </span>
                    <span className="text-muted-foreground">Avg Match Score</span>
                  </div>
                </>
              )}
              {/* Semantic match count */}
              {matches.some((m) => m.matchMethod === "semantic") && (
                <>
                  <div className="h-8 w-px bg-border hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-violet-600">
                      {matches.filter((m) => m.matchMethod === "semantic").length}
                    </span>
                    <span className="text-muted-foreground">AI Matches</span>
                  </div>
                </>
              )}
              {/* Average ATS score */}
              {resumes.some((r) => r.atsScore != null) && (
                <>
                  <div className="h-8 w-px bg-border hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600">
                      {Math.round(
                        resumes
                          .filter((r) => r.atsScore != null)
                          .reduce((acc, r) => acc + (r.atsScore || 0), 0) /
                          resumes.filter((r) => r.atsScore != null).length
                      )}
                    </span>
                    <span className="text-muted-foreground">Avg ATS Score</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Job Match Cards */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Matched Jobs</h3>
            <div className="grid gap-4">
              {matches.map((match) => {
                const resume = resumeByJobId.get(match.job.id);
                return (
                  <JobMatchCard
                    key={match.id}
                    match={match}
                    resume={resume}
                  />
                );
              })}
            </div>
          </div>

          {/* All Resumes Section */}
          {resumes.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span className="text-lg">📄</span> All Tailored Resumes
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {resumes.map((resume) => (
                  <ResumeCard key={resume.id} resume={resume} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// State: Idle (no run yet)
// ─────────────────────────────────────────────────────────────
function IdleState() {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8 text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
        🎯
      </div>
      <h2 className="text-xl font-semibold">Ready to Find Your Next Role?</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Click <strong>Start Job Matching</strong> above. Our AI will match your
        skills, experience, and preferences with the latest job postings and
        generate tailored resumes.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
          ✅ Profile analyzed
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
          ✅ Preferences set
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
          ⏳ Matching not started
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// State: Processing (pending or processing)
// ─────────────────────────────────────────────────────────────
function ProcessingState({ state }: { state: WorkflowState }) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8 text-center space-y-5">
      <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <h2 className="text-xl font-semibold">
        {state === "pending" ? "Initiating Workflow…" : "Matching in Progress…"}
      </h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        {state === "pending"
          ? "We're preparing your profile data and sending it to our AI matching engine."
          : "Our AI is scanning job postings, computing match scores, and generating tailored resumes. This usually takes 1–3 minutes."}
      </p>
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground/60">
        Auto-refreshing every few seconds…
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// State: Failed
// ─────────────────────────────────────────────────────────────
function FailedState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 text-card-foreground shadow-sm p-8 text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-3xl">
        ⚠️
      </div>
      <h2 className="text-xl font-semibold text-destructive">
        Workflow Failed
      </h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        {error || "Something went wrong while processing your job matches."}
      </p>
      <button
        id="btn-retry-workflow"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground shadow-sm transition-all hover:bg-destructive/90"
      >
        <RefreshIcon />
        Retry
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Job Match Card
// ─────────────────────────────────────────────────────────────
function JobMatchCard({
  match,
  resume,
}: {
  match: JobMatchResult;
  resume?: TailoredResumeResult;
}) {
  const scoreColor =
    match.matchScore >= 80
      ? "text-green-600 bg-green-500/10 border-green-500/20"
      : match.matchScore >= 60
        ? "text-yellow-600 bg-yellow-500/10 border-yellow-500/20"
        : "text-orange-600 bg-orange-500/10 border-orange-500/20";

  const title = getMockTitle(match.job.id, match.job.title);
  const company = getMockCompany(match.job.id, match.job.company);

  return (
    <div
      id={`job-match-${match.id}`}
      className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 flex flex-col sm:flex-row gap-4 items-start"
    >
      {/* Score badge */}
      <div
        className={`flex-shrink-0 w-14 h-14 rounded-xl border flex flex-col items-center justify-center ${scoreColor}`}
      >
        <span className="text-lg font-bold leading-none">
          {match.matchScore}
        </span>
        <span className="text-[10px] font-medium">MATCH</span>
      </div>

      {/* Job details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-base truncate">{title}</h4>
          {/* Match method badge */}
          {match.matchMethod === "semantic" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold flex-shrink-0">
              🤖 AI
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20 px-2 py-0.5 text-[10px] font-semibold flex-shrink-0">
              🔑 KW
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {company}
          {match.job.location && match.job.location !== "Unknown" && ` · ${match.job.location}`}
        </p>
        <div className="flex items-center gap-3">
          {match.job.postedAt && (
            <p className="text-xs text-muted-foreground/60">
              Posted{" "}
              {new Date(match.job.postedAt).toLocaleDateString("en-IN", {
                dateStyle: "medium",
              })}
            </p>
          )}
          {match.semanticScore != null && (
            <span className="text-xs text-violet-500 font-medium">
              Cosine: {(match.semanticScore * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <a
          href={match.job.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
        >
          <ExternalLinkIcon />
          View Job
        </a>
        {resume && (
          <a
            href={ensurePdfUrl(resume.resumeUrl, `Resume_${company}_${title}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <DownloadIcon />
            Resume
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Resume Card
// ─────────────────────────────────────────────────────────────
function ResumeCard({ resume }: { resume: TailoredResumeResult }) {
  const title = getMockTitle(resume.job.id, resume.job.title);
  const company = getMockCompany(resume.job.id, resume.job.company);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
          📄
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm truncate">{title}</h4>
          <p className="text-xs text-muted-foreground truncate">
            {company}
          </p>
        </div>
        {/* ATS Score Badge */}
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
      {resume.iterations && resume.iterations > 1 && (
        <p className="text-[10px] text-muted-foreground">
          🔄 {resume.iterations} RAG iterations
        </p>
      )}
      <a
        href={ensurePdfUrl(resume.resumeUrl, `Resume_${company}_${title}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 w-full justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
      >
        <DownloadIcon />
        Download Resume
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline SVG Icons
// ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function RocketIcon() {
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
        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 003.46-8.62 2.25 2.25 0 00-2.18-2.18 14.98 14.98 0 00-8.62 3.46m6 6v-6m-6 6H5.21a2.25 2.25 0 01-2.18-2.18 14.98 14.98 0 013.46-8.62m0 0L9.73 9.73"
      />
    </svg>
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

function ExternalLinkIcon() {
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
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
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
