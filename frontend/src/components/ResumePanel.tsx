"use client";

import { useEffect, useState } from "react";
import { api, type Match, type ResumeDetail } from "@/lib/api";

const primary = "rounded-xl bg-violet px-3 py-1.5 text-base font-medium text-white hover:bg-violet-deep disabled:opacity-50";
const quiet = "rounded-xl border border-lavender px-3 py-1.5 text-base text-ink/85 hover:bg-mist";

const BAND_STYLE: Record<string, string> = {
  Strong: "bg-lavender text-violet",
  Good: "bg-sky-50 text-sky-700",
  "Needs work": "bg-amber-50 text-amber-700",
};
const DECISION_STYLE: Record<string, string> = {
  shortlist: "text-violet",
  maybe: "text-amber-700",
  reject: "text-red-700",
};

/** The tailored resume for one match: write it, follow progress, then score, PDF and what to check. */
export default function ResumePanel({ match }: { match: Match }) {
  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [loaded, setLoaded] = useState(!match.resume);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setResume(await api<ResumeDetail | null>(`/matches/${match.id}/resume`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the resume");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (match.resume) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // The crew takes a few minutes: check back every 10 seconds while it works.
  useEffect(() => {
    if (resume?.status !== "running") return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume?.status]);

  async function write() {
    setError("");
    try {
      setResume(await api<ResumeDetail>(`/matches/${match.id}/resume`, { method: "POST" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the resume");
    }
  }

  if (!loaded) return null;
  const status = resume?.status;

  return (
    <div className="space-y-2 rounded-2xl bg-mist p-3 text-base">
      {!resume && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-soft">No tailored resume yet.</span>
          <button className={primary} onClick={write}>Write tailored resume</button>
        </div>
      )}
      {status === "running" && (
        <p className="animate-pulse text-ink-soft">
          Writing your resume: analysing the job, planning, writing, then an ATS check and an HR panel review. This
          takes a few minutes; you can leave this page and come back.
        </p>
      )}
      {(status === "failed" || status === "pending") && (
        <div className="flex items-center justify-between gap-3">
          <span className={status === "pending" ? "text-ink-soft" : "text-red-700"}>
            {status === "pending" ? resume?.error : "Writing the resume failed."}
          </span>
          <button className={quiet} onClick={write}>Try again</button>
        </div>
      )}
      {status === "ready" && resume?.score_parts && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Tailored resume</span>
            <span className={`rounded-full px-2 py-0.5 text-sm font-medium ${BAND_STYLE[resume.score_parts.band] ?? ""}`}>
              {resume.score_parts.score} · {resume.score_parts.band}
            </span>
            <span className="text-sm text-ink-soft">
              ATS {resume.score_parts.ats} · HR panel {resume.score_parts.panel} (
              {resume.score_parts.shortlist_votes.shortlist ?? 0} shortlist, {resume.score_parts.shortlist_votes.maybe ?? 0}{" "}
              maybe, {resume.score_parts.shortlist_votes.reject ?? 0} reject)
            </span>
            <span className="ml-auto flex gap-2">
              <a className={primary} href={`/api/matches/${match.id}/resume.pdf`} target="_blank" rel="noreferrer">
                Resume PDF
              </a>
              <a className={quiet} href={`/api/matches/${match.id}/review.pdf`} target="_blank" rel="noreferrer">
                Review PDF
              </a>
              <button className={quiet} onClick={() => setOpen(!open)}>{open ? "Hide details" : "Details"}</button>
              <button className={quiet} onClick={write} title="Write it again, e.g. after updating your profile">
                Rewrite
              </button>
            </span>
          </div>
          {resume.ats && <JobMatch ats={resume.ats} />}
          {resume.ask_student.length > 0 && (
            <div>
              <p className="font-medium text-ink">Check before sending</p>
              <ul className="list-disc space-y-0.5 pl-5 text-ink/85">
                {resume.ask_student.slice(0, 4).map((q) => <li key={q}>{q}</li>)}
              </ul>
            </div>
          )}
          {open && <Details resume={resume} />}
        </>
      )}
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}

function Details({ resume }: { resume: ResumeDetail }) {
  return (
    <div className="space-y-3 border-t border-lavender pt-3">
      {resume.ats && (
        <section>
          <p className="font-medium">
            ATS check: {resume.ats.tier} match, grade {resume.ats.grade} ({resume.ats.score}/100)
          </p>
          <p className="text-sm text-ink-soft">{resume.ats.note}</p>
          <p className="text-ink/85">
            {Object.entries(resume.ats.sub_scores).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(" · ")}
          </p>
          {resume.ats.required_missing.length > 0 && (
            <p className="text-ink/85">Required but not on your resume: {resume.ats.required_missing.join(", ")}</p>
          )}
        </section>
      )}
      {resume.panel && (
        <section>
          <p className="font-medium">HR panel</p>
          <ul className="space-y-1">
            {resume.panel.reviewers.map((r) => (
              <li key={r.id}>
                <span className="text-ink-soft">{r.role}: </span>
                {r.verdict ? (
                  <>
                    <span className={`font-medium ${DECISION_STYLE[r.verdict.decision]}`}>{r.verdict.decision}</span>
                    <span className="text-ink/85"> — {r.verdict.one_line}</span>
                  </>
                ) : (
                  <span className="text-ink-soft">did not answer</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {resume.interview_prep.length > 0 && (
        <section>
          <p className="font-medium">Questions to prepare for</p>
          <ul className="list-disc space-y-0.5 pl-5 text-ink/85">
            {resume.interview_prep.slice(0, 6).map((q) => <li key={q}>{q}</li>)}
          </ul>
        </section>
      )}
      {resume.text && (
        <section>
          <p className="font-medium">Resume text</p>
          <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 font-sans text-sm text-ink">{resume.text}</pre>
        </section>
      )}
    </div>
  );
}

/** What the job asks for: on the resume (violet) and missing (peach). */
function JobMatch({ ats }: { ats: NonNullable<ResumeDetail["ats"]> }) {
  const found = ats.required_found ?? [];
  const missing = ats.required_missing;
  const total = found.length + missing.length;
  return (
    <div className="space-y-2">
      <p className="font-medium text-ink">
        Job requirements on your resume: {found.length} of {total || "?"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {found.map((s) => (
          <span key={`f-${s}`} className="rounded-full bg-violet/10 px-2.5 py-0.5 text-sm font-medium text-violet">✓ {s}</span>
        ))}
        {missing.map((s) => (
          <span key={`m-${s}`} className="rounded-full bg-peach/25 px-2.5 py-0.5 text-sm font-medium text-[#9a4a2b]">✗ {s}</span>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="text-sm text-ink-soft">
          Have any of the missing ones? Add where you used them to your profile, then Rewrite.
        </p>
      )}
    </div>
  );
}
