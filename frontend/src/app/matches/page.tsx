"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Digest, type Match, type Preferences } from "@/lib/api";
import ResumePanel from "@/components/ResumePanel";

const input = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";
const primary = "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50";
const quiet = "rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";

const SOURCE_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  naukri: "Naukri",
  internshala: "Internshala",
};

const EMPTY: Preferences = {
  target_roles: [],
  locations: [],
  remote_ok: true,
  experience_level: "entry",
  job_types: ["full_time"],
  min_salary_lpa: null,
};

export default function MatchesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [editing, setEditing] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function loadMatches() {
    setBusy("Finding today's best matches…");
    setError("");
    try {
      setMatches((await api<{ matches: Match[] }>("/matches/today")).matches);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load matches");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    api<Preferences | null>("/preferences")
      .then((p) => {
        setPrefs(p ?? EMPTY);
        setEditing(!p);
        if (p) loadMatches();
      })
      .catch((e) => (e instanceof ApiError && e.status === 401 ? router.push("/login") : setError(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(p: Preferences) {
    setBusy("Saving…");
    try {
      setPrefs(await api<Preferences>("/preferences", { method: "PUT", body: JSON.stringify(p) }));
      setEditing(false);
      await loadMatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy("");
    }
  }

  async function mark(m: Match, status: Match["status"]) {
    const updated = await api<Match>(`/matches/${m.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setMatches((list) => list?.map((x) => (x.id === m.id ? updated : x)) ?? null);
  }

  if (!prefs) return <main className="p-10 text-zinc-500">{error || "Loading…"}</main>;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Today&apos;s matches</h1>
        <Link href="/profile" className={quiet}>
          ← Profile
        </Link>
      </header>

      {editing ? (
        <PreferencesForm initial={prefs} onSave={save} onCancel={prefs.target_roles.length ? () => setEditing(false) : undefined} />
      ) : (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          <p>
            {prefs.target_roles.join(", ") || "Any tech role"} · {prefs.experience_level} level ·{" "}
            {prefs.job_types.map((t) => (t === "full_time" ? "full-time" : "internship")).join(" & ")} ·{" "}
            {prefs.locations.length ? prefs.locations.join(", ") : "anywhere in India"}
            {prefs.remote_ok ? " or remote" : ""}
          </p>
          <button className={quiet} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}

      {!editing && matches && matches.length > 0 && <DigestBar onDone={loadMatches} />}

      {busy && <p className="animate-pulse text-sm text-zinc-500">{busy}</p>}
      {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {matches && !busy && (
        <section className="space-y-4">
          {matches.length === 0 && (
            <p className="text-sm text-zinc-600">
              No new jobs match your preferences today. Try more cities, or allow remote or internships.
            </p>
          )}
          {matches.map((m) => (
            <article
              key={m.id}
              className={`space-y-3 rounded-xl border bg-white p-5 ${m.status === "dismissed" ? "opacity-50" : "border-zinc-200"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{m.job.title}</h2>
                  <p className="text-sm text-zinc-600">
                    {m.job.company} · {m.job.remote ? "Remote" : m.job.location}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  {Math.round(m.score * 100)}% match
                </span>
              </div>
              <ul className="space-y-0.5 text-sm text-zinc-700">
                {/* The location already shows under the title. */}
                {m.reasons.filter((r) => r !== m.job.location && r !== "Remote").map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              <ResumePanel match={m} />
              <div className="flex flex-wrap items-center gap-2">
                <a href={m.job.apply_url} target="_blank" rel="noreferrer" className={primary}>
                  Apply on {SOURCE_LABEL[m.job.source] ?? "company site"}
                </a>
                {m.status === "applied" ? (
                  <span className="text-sm text-emerald-700">Marked as applied</span>
                ) : (
                  <>
                    <button className={quiet} onClick={() => mark(m, "applied")}>
                      I applied
                    </button>
                    <button className={quiet} onClick={() => mark(m, m.status === "dismissed" ? "shortlisted" : "dismissed")}>
                      {m.status === "dismissed" ? "Undo" : "Not for me"}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function PreferencesForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Preferences;
  onSave: (p: Preferences) => void;
  onCancel?: () => void;
}) {
  const [roles, setRoles] = useState(initial.target_roles.join(", "));
  const [cities, setCities] = useState(initial.locations.join(", "));
  const [p, setP] = useState(initial);
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const toggleType = (t: "full_time" | "internship") =>
    setP((x) => ({ ...x, job_types: x.job_types.includes(t) ? x.job_types.filter((y) => y !== t) : [...x.job_types, t] }));

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">What are you looking for?</h2>
      <label className="block text-sm">
        <span className="text-zinc-600">Roles (comma separated)</span>
        <input className={input} value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="Backend developer, Data analyst" />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Cities (leave empty for anywhere in India)</span>
        <input className={input} value={cities} onChange={(e) => setCities(e.target.value)} placeholder="Bengaluru, Pune" />
      </label>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={p.remote_ok} onChange={(e) => setP({ ...p, remote_ok: e.target.checked })} />
          Remote is fine
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={p.job_types.includes("full_time")} onChange={() => toggleType("full_time")} />
          Full-time
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={p.job_types.includes("internship")} onChange={() => toggleType("internship")} />
          Internship
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-zinc-600">Experience</span>
        <select
          className={input}
          value={p.experience_level}
          onChange={(e) => {
            const level = e.target.value as Preferences["experience_level"];
            // "Internships only" with only full-time ticked would always match nothing.
            setP({ ...p, experience_level: level, job_types: level === "intern" ? ["internship"] : p.job_types });
          }}
        >
          <option value="intern">Student, internships only</option>
          <option value="entry">Fresher or up to 2 years</option>
          <option value="mid">2 to 5 years</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button
          className={primary}
          disabled={!p.job_types.length}
          onClick={() => onSave({ ...p, target_roles: split(roles), locations: split(cities) })}
        >
          Save and show matches
        </button>
        {onCancel && (
          <button className={quiet} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

/** Today's email: sent automatically each morning; can also be run now. */
function DigestBar({ onDone }: { onDone: () => void }) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setDigest(await api<Digest | null>("/digest/today"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load today's email status");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (digest?.status !== "running") return;
    const t = setInterval(async () => {
      const d = await api<Digest | null>("/digest/today").catch(() => null);
      setDigest(d);
      if (d && d.status !== "running") onDone();
    }, 15000);
    return () => clearInterval(t);
  }, [digest?.status, onDone]);

  async function run() {
    setError("");
    try {
      await api("/digest/run?force=true", { method: "POST" });
      setDigest({ date: "", status: "running", stats: {}, error: null, sent_at: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
    }
  }

  const s = digest?.stats ?? {};
  const label =
    digest?.status === "sent"
      ? `Today's email was sent to your Gmail, with ${s.ready ?? 0} tailored resume${s.ready === 1 ? "" : "s"} attached.`
      : digest?.status === "running"
        ? "Preparing today's email: writing resumes for your top matches. This can take 10–15 minutes."
        : digest?.status === "failed"
          ? `Today's email failed: ${digest.error}`
          : digest?.status === "skipped"
            ? `No email today: ${digest.error}`
            : "Each morning you get these jobs by email, with tailored resumes for the top 3.";

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
      <p className={digest?.status === "running" ? "animate-pulse" : ""}>{error || label}</p>
      {digest?.status !== "running" && (
        <button className={quiet} onClick={run}>
          {digest?.status === "sent" ? "Send again" : "Email me now"}
        </button>
      )}
    </div>
  );
}
