"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ImprovePanel from "@/components/ImprovePanel";
import Logo from "@/components/Logo";
import { api, ApiError, type Basics, type Fact, type Item, type ItemKind, type Profile } from "@/lib/api";

/* ---------- small building blocks ---------- */

const input =
  "w-full rounded-xl border border-lavender bg-white/85 px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3 text-base font-semibold text-white shadow-[0_10px_24px_-12px_rgb(90_72_198/0.8)] hover:bg-violet-deep disabled:opacity-50";
const SOURCE_STYLE: Record<Fact["source"], string> = {
  resume: "bg-lavender text-ink-soft",
  mcq: "bg-violet/10 text-violet",
  note: "bg-powder/40 text-[#3d6a9e]",
  manual: "bg-peach/25 text-[#9a4a2b]",
};

function Svg({ d, className = "h-5 w-5" }: { d: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
  );
}
const ICONS = {
  personal: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  links: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>,
  skills: <><path d="M12 3l2.6 5.4 5.9.9-4.3 4.1 1 5.9L12 16.6 6.8 19.3l1-5.9L3.5 9.3l5.9-.9z" /></>,
  experience: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  project: <><path d="M4 7l4-3h8l4 3v12H4z" /><path d="M9 12l2 2 4-4" /></>,
  education: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></>,
  research: <><circle cx="10.5" cy="10.5" r="6" /><path d="M20 20l-5-5" /></>,
  achievements: <><circle cx="12" cy="9" r="5" /><path d="M8.5 13l-1.5 8 5-3 5 3-1.5-8" /></>,
  upload: <><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" /></>,
  assistant: <><path d="M4 5h16v10H9l-5 4z" /><path d="M9 9h6M9 12h3" /></>,
  matches: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  signout: <><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M6 9l6 6 6-6" />,
};

/* ---------- sections and what "complete" means ---------- */

type SectionKey = "personal" | "links" | "skills" | "experience" | "project" | "education" | "research"
  | "achievements" | "upload" | "assistant";

interface SectionDef {
  key: SectionKey;
  label: string;
  title: string;
  subtitle: string;
  required?: boolean;                 // counts towards "profile complete"
  kinds?: ItemKind[];                 // sections that list profile items
  done?: (p: Profile) => boolean;
}

const has = (p: Profile, kinds: ItemKind[]) => p.items.some((i) => kinds.includes(i.kind));

const SECTIONS: SectionDef[] = [
  { key: "personal", label: "Personal", title: "Personal", subtitle: "Your name and how recruiters can reach you.",
    required: true, done: (p) => Boolean(p.full_name && p.email && p.phone && p.location) },
  { key: "links", label: "Links", title: "Links", subtitle: "LinkedIn, GitHub, portfolio: where your work lives.",
    done: (p) => p.links.length > 0 },
  { key: "skills", label: "Skills", title: "Skills", subtitle: "Technologies and tools you can talk about in an interview.",
    required: true, done: (p) => p.skills.length >= 3 },
  { key: "experience", label: "Experience", title: "Experience", subtitle: "Internships and jobs, with what you built and the result.",
    kinds: ["experience"], done: (p) => has(p, ["experience"]) },
  { key: "project", label: "Projects", title: "Projects", subtitle: "What you built, how, and what came of it.",
    required: true, kinds: ["project"], done: (p) => has(p, ["project"]) },
  { key: "education", label: "Education", title: "Education", subtitle: "Degree, college, years and CGPA.",
    required: true, kinds: ["education"], done: (p) => has(p, ["education"]) },
  { key: "research", label: "Research", title: "Research", subtitle: "Papers, theses and lab work.",
    kinds: ["research"], done: (p) => has(p, ["research"]) },
  { key: "achievements", label: "Achievements", title: "Achievements", subtitle: "Hackathons, awards, certifications and more.",
    kinds: ["award", "certification", "other"], done: (p) => has(p, ["award", "certification", "other"]) },
];
const TOOLS: SectionDef[] = [
  { key: "upload", label: "Import resume", title: "Import resume", subtitle: "Upload your resume as a PDF and we'll fill your profile from it." },
  { key: "assistant", label: "Profile assistant", title: "Profile assistant", subtitle: "Short questions, one at a time, to fill the gaps. Skip anything." },
];
const ALL = [...SECTIONS, ...TOOLS];
const ICON_FOR: Record<SectionKey, React.ReactNode> = {
  personal: ICONS.personal, links: ICONS.links, skills: ICONS.skills, experience: ICONS.experience,
  project: ICONS.project, education: ICONS.education, research: ICONS.research, achievements: ICONS.achievements,
  upload: ICONS.upload, assistant: ICONS.assistant,
};

/* ---------- page ---------- */

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [active, setActive] = useState<SectionKey>("personal");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as SectionKey;
    if (ALL.some((s) => s.key === fromHash)) setActive(fromHash);
    api<Profile>("/profile")
      .then(setProfile)
      .catch((e) => (e instanceof ApiError && e.status === 401 ? router.push("/login") : setError(e.message)));
  }, [router]);

  function open(key: SectionKey) {
    setActive(key);
    setNotice("");
    window.history.replaceState(null, "", `#${key}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Calls that return the full profile update it directly; any other call refetches it.
  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      const isProfile = typeof result === "object" && result !== null && "items" in result;
      setProfile(isProfile ? (result as Profile) : await api<Profile>("/profile"));
      if (done) setNotice(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
    router.push("/");
  }

  const required = SECTIONS.filter((s) => s.required);
  const missing = profile ? required.filter((s) => !s.done!(profile)) : required;
  const pct = profile ? Math.round(((required.length - missing.length) / required.length) * 100) : 0;
  const section = ALL.find((s) => s.key === active)!;

  return (
    <div className="relative isolate min-h-[100svh] text-ink">
      <div className="fixed inset-0 -z-10 bg-[url('/profile_bg.png')] bg-cover bg-center" aria-hidden="true" />

      <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)]">
        <Sidebar profile={profile} active={active} onOpen={open} onSignOut={signOut} />

        <div className="min-w-0 px-4 pb-16 pt-4 sm:px-6 lg:px-10 lg:pt-5">
          <Progress pct={pct} missing={missing} onOpen={open} />

          <section className="glass-light mt-6 rounded-[2rem] p-6 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-4xl font-semibold tracking-[-0.02em]">{section.title}</h1>
                <p className="mt-2 text-lg text-ink-soft">{section.subtitle}</p>
              </div>
              {busy && <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-ink-soft">Saving…</span>}
            </div>

            {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">{error}</p>}
            {notice && <p className="mt-6 rounded-xl bg-violet/10 px-4 py-3 text-base font-medium text-violet">{notice}</p>}

            <div className="mt-8">
              {!profile ? (
                <p className="text-ink-soft">{error ? "" : "Loading your profile…"}</p>
              ) : (
                <SectionBody
                  section={section}
                  profile={profile}
                  busy={busy}
                  run={run}
                  focus={focus}
                  onDiscuss={(id) => {
                    setFocus({ id, nonce: Date.now() });
                    open("assistant");
                  }}
                  onSaved={() => api<Profile>("/profile").then(setProfile)}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- sidebar and progress ---------- */

function StatusMark({ def, profile }: { def: SectionDef; profile: Profile | null }) {
  if (!def.done || !profile) return null;
  if (def.done(profile))
    return <span className="grid h-5 w-5 place-items-center rounded-full bg-violet text-white"><Svg d={ICONS.check} className="h-3 w-3" /></span>;
  if (def.required) return <span className="block h-2.5 w-2.5 rounded-full bg-peach-deep" title="Needed" />;
  return <span className="block h-0.5 w-3 rounded bg-ink-soft/40" title="Optional" />;
}

function NavButton({ def, active, profile, onOpen }: {
  def: SectionDef; active: boolean; profile: Profile | null; onOpen: (k: SectionKey) => void;
}) {
  return (
    <button onClick={() => onOpen(def.key)} aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-semibold transition-colors lg:w-full ${active
        ? "bg-violet text-white shadow-[0_10px_24px_-12px_rgb(90_72_198/0.9)]" : "text-ink hover:bg-white/70"}`}>
      <Svg d={ICON_FOR[def.key]} />
      <span className="flex-1 whitespace-nowrap">{def.label}</span>
      <span className={active ? "[&>span]:bg-white [&>span]:text-violet" : ""}><StatusMark def={def} profile={profile} /></span>
    </button>
  );
}

function Sidebar({ profile, active, onOpen, onSignOut }: {
  profile: Profile | null; active: SectionKey; onOpen: (k: SectionKey) => void; onSignOut: () => void;
}) {
  return (
    <aside className="px-4 pt-4 sm:px-6 lg:sticky lg:top-0 lg:h-[100svh] lg:px-0 lg:py-5 lg:pl-5">
      <div className="glass-light flex flex-col rounded-[1.75rem] p-4 lg:h-full lg:overflow-y-auto">
        <div className="px-2 pb-4 pt-1">
          <Link href="/" aria-label="PlaceMates home"><Logo large /></Link>
        </div>

        <p className="hidden px-4 pb-2 text-sm font-semibold text-ink-soft lg:block">Profile</p>
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Profile sections">
          {SECTIONS.map((s) => <NavButton key={s.key} def={s} active={active === s.key} profile={profile} onOpen={onOpen} />)}
          <span className="hidden lg:mt-4 lg:block lg:border-t lg:border-white/60 lg:px-4 lg:pb-2 lg:pt-4 lg:text-sm lg:font-semibold lg:text-ink-soft">Tools</span>
          {TOOLS.map((s) => <NavButton key={s.key} def={s} active={active === s.key} profile={profile} onOpen={onOpen} />)}
          <Link href="/matches"
            className="flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-ink hover:bg-white/70">
            <Svg d={ICONS.matches} /> <span className="whitespace-nowrap">Today&apos;s matches</span>
          </Link>
        </nav>

        <button onClick={onSignOut}
          className="mt-auto hidden items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium text-ink-soft hover:bg-white/70 hover:text-ink lg:flex">
          <Svg d={ICONS.signout} /> Sign out
        </button>
      </div>
    </aside>
  );
}

function Progress({ pct, missing, onOpen }: { pct: number; missing: SectionDef[]; onOpen: (k: SectionKey) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-light rounded-[1.5rem] px-5 py-4 sm:px-7">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="font-display text-lg font-semibold">
          <span className="text-violet">{pct}%</span> profile complete
        </p>
        <div className="h-2.5 min-w-40 flex-1 overflow-hidden rounded-full bg-white/80">
          <div className="h-full rounded-full bg-gradient-to-r from-violet to-peach transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        {missing.length > 0 ? (
          <button onClick={() => setOpen(!open)} aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-base font-semibold text-violet hover:bg-white/70">
            {missing.length} remaining <Svg d={ICONS.chevron} className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <span className="text-base font-semibold text-violet">Ready for tailored resumes</span>
        )}
      </div>
      {open && missing.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 border-t border-white/70 pt-4">
          {missing.map((s) => (
            <li key={s.key}>
              <button onClick={() => { onOpen(s.key); setOpen(false); }}
                className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2 text-base font-medium text-ink hover:bg-white">
                <span className="h-2 w-2 rounded-full bg-peach-deep" /> {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- section bodies ---------- */

type Run = (action: () => Promise<unknown>, done?: string) => Promise<void>;

function SectionBody({ section, profile, busy, run, focus, onDiscuss, onSaved }: {
  section: SectionDef; profile: Profile; busy: boolean; run: Run;
  focus: { id: string; nonce: number } | null; onDiscuss: (id: string) => void; onSaved: () => void;
}) {
  const saveBasics = (b: Basics, done: string) =>
    run(() => api<Profile>("/profile/basics", { method: "PUT", body: JSON.stringify(b) }), done);

  switch (section.key) {
    case "personal":
      return <PersonalForm profile={profile} onSave={(b) => saveBasics(b, "Personal details saved.")} />;
    case "links":
      return <LinksForm profile={profile} onSave={(b) => saveBasics(b, "Links saved.")} />;
    case "skills":
      return (
        <SkillsEditor skills={profile.skills.map((s) => s.name)}
          onSave={(names) => run(() => api<Profile>("/profile/skills", { method: "PUT", body: JSON.stringify(names) }), "Skills saved.")} />
      );
    case "upload":
      return (
        <ResumeUpload busy={busy} onUpload={(file) => {
          const form = new FormData();
          form.append("file", file);
          return run(() => api<Profile>("/profile/resume", { method: "POST", body: form }), "Resume imported. Check each section.");
        }} />
      );
    case "assistant":
      return <ImprovePanel focus={focus} onSaved={onSaved} />;
    default:
      return <ItemsSection kinds={section.kinds!} profile={profile} run={run} onDiscuss={onDiscuss} label={section.label} />;
  }
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-base font-semibold">
        {label}{required && <span className="text-peach-deep"> *</span>}
      </span>
      {children}
    </label>
  );
}

function PersonalForm({ profile, onSave }: { profile: Profile; onSave: (b: Basics) => void }) {
  const [form, setForm] = useState<Basics>(profile);
  useEffect(() => setForm(profile), [profile]);
  const set = (k: keyof Basics) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Full name" required><input className={input} value={form.full_name ?? ""} onChange={set("full_name")} /></Field>
        <Field label="City" required><input className={input} value={form.location ?? ""} onChange={set("location")} placeholder="Pune" /></Field>
        <Field label="Email" required><input type="email" className={input} value={form.email ?? ""} onChange={set("email")} /></Field>
        <Field label="Phone" required><input className={input} value={form.phone ?? ""} onChange={set("phone")} placeholder="+91 98765 43210" /></Field>
      </div>
      <details className="rounded-2xl border border-lavender bg-white/60 px-5 py-4" open={Boolean(form.headline || form.summary)}>
        <summary className="cursor-pointer text-base font-semibold">Headline and summary</summary>
        <div className="mt-5 space-y-5">
          <Field label="Headline"><input className={input} value={form.headline ?? ""} onChange={set("headline")} placeholder="Final-year CSE student, backend and ML" /></Field>
          <Field label="Summary"><textarea className={input} rows={4} value={form.summary ?? ""} onChange={set("summary")} /></Field>
        </div>
      </details>
      <div className="border-t border-white/70 pt-6"><button className={button}>Save personal</button></div>
    </form>
  );
}

function LinksForm({ profile, onSave }: { profile: Profile; onSave: (b: Basics) => void }) {
  const [links, setLinks] = useState<string[]>(profile.links.length ? profile.links : [""]);
  useEffect(() => setLinks(profile.links.length ? profile.links : [""]), [profile]);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave({ ...profile, links: links.map((l) => l.trim()).filter(Boolean) }); }}>
      {links.map((link, i) => (
        <div key={i} className="flex gap-3">
          <input className={input} value={link} placeholder="https://github.com/you" aria-label={`Link ${i + 1}`}
            onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))} />
          <button type="button" onClick={() => setLinks(links.length > 1 ? links.filter((_, j) => j !== i) : [""])}
            className="rounded-xl px-4 text-base font-medium text-ink-soft hover:bg-white/70 hover:text-red-600">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => setLinks([...links, ""])}
        className="rounded-xl border border-dashed border-violet/40 px-5 py-3 text-base font-semibold text-violet hover:bg-white/70">
        + Add link
      </button>
      <div className="border-t border-white/70 pt-6"><button className={button}>Save links</button></div>
    </form>
  );
}

function SkillsEditor({ skills, onSave }: { skills: string[]; onSave: (names: string[]) => void }) {
  const [list, setList] = useState(skills);
  const [draft, setDraft] = useState("");
  useEffect(() => setList(skills), [skills]);
  function add() {
    const names = draft.split(",").map((s) => s.trim()).filter(Boolean);
    const known = new Set(list.map((s) => s.toLowerCase()));
    setList([...list, ...names.filter((n) => !known.has(n.toLowerCase()))]);
    setDraft("");
  }
  return (
    <div className="space-y-6">
      <ul className="flex flex-wrap gap-2.5">
        {list.length === 0 && <li className="text-ink-soft">No skills yet. Add the tools you&apos;ve used in projects.</li>}
        {list.map((s) => (
          <li key={s} className="inline-flex items-center gap-2 rounded-full border border-lavender bg-white/85 py-2 pl-4 pr-2 text-base font-medium">
            {s}
            <button onClick={() => setList(list.filter((x) => x !== s))} aria-label={`Remove ${s}`}
              className="grid h-6 w-6 place-items-center rounded-full text-ink-soft hover:bg-lavender hover:text-ink">×</button>
          </li>
        ))}
      </ul>
      <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add skills, separated by commas"
          aria-label="New skills" />
        <button className="rounded-xl border border-violet/40 bg-white/80 px-5 text-base font-semibold text-violet hover:bg-white">Add</button>
      </form>
      <div className="border-t border-white/70 pt-6"><button className={button} onClick={() => onSave(list)}>Save skills</button></div>
    </div>
  );
}

function ResumeUpload({ busy, onUpload }: { busy: boolean; onUpload: (f: File) => void }) {
  return (
    <label className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-[1.75rem] border-2 border-dashed border-violet/40 bg-white/60 px-6 py-16 text-center transition-colors hover:bg-white/80 ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-violet text-white"><Svg d={ICONS.upload} className="h-7 w-7" /></span>
      <span className="font-display text-2xl font-semibold">{busy ? "Reading your resume…" : "Choose a PDF resume"}</span>
      <span className="max-w-md text-base text-ink-soft">
        We pull out your experience, projects, education and skills. Every detail keeps a note that it came from your resume.
      </span>
      <input type="file" accept="application/pdf" className="hidden" disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }} />
    </label>
  );
}

function showValue(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function ItemsSection({ kinds, profile, run, onDiscuss, label }: {
  kinds: ItemKind[]; profile: Profile; run: Run; onDiscuss: (id: string) => void; label: string;
}) {
  const items = useMemo(() => profile.items.filter((i) => kinds.includes(i.kind)), [profile, kinds]);
  return (
    <div className="space-y-5">
      {items.length === 0 && (
        <p className="rounded-2xl bg-white/60 px-5 py-4 text-base text-ink-soft">
          No {label.toLowerCase()} yet. Add one below, or import your resume.
        </p>
      )}
      {items.map((item) => (
        <ItemCard key={item.id} item={item}
          onDiscuss={() => onDiscuss(item.id)}
          onDelete={() => run(() => api(`/profile/items/${item.id}`, { method: "DELETE" }), "Removed.")}
          onDeleteFact={(id) => run(() => api(`/profile/facts/${id}`, { method: "DELETE" }))}
          onAddFact={(field, value) => run(() => api(`/profile/items/${item.id}/facts`, {
            method: "POST", body: JSON.stringify({ field, value, source: "manual" }) }), "Detail added.")} />
      ))}
      <AddItem kinds={kinds} label={label}
        onAdd={(body) => run(() => api("/profile/items", { method: "POST", body: JSON.stringify(body) }), "Added.")} />
    </div>
  );
}

function ItemCard({ item, onDiscuss, onDelete, onDeleteFact, onAddFact }: {
  item: Item; onDiscuss: () => void; onDelete: () => void;
  onDeleteFact: (id: string) => void; onAddFact: (field: string, value: string) => void;
}) {
  const [field, setField] = useState("detail");
  const [value, setValue] = useState("");
  const dates = [item.start_date, item.end_date].filter(Boolean).join(" – ");
  return (
    <article className="space-y-4 rounded-[1.5rem] border border-white/80 bg-white/80 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-semibold">{item.title}</h3>
          <p className="mt-1 text-base text-ink-soft">{[item.organization, dates].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onDiscuss} className="rounded-xl bg-violet/10 px-4 py-2 text-base font-semibold text-violet hover:bg-violet/15">
            Improve with assistant
          </button>
          <button onClick={onDelete} className="rounded-xl px-4 py-2 text-base font-medium text-ink-soft hover:bg-red-50 hover:text-red-600">
            Delete
          </button>
        </div>
      </div>
      <ul className="space-y-2.5">
        {item.facts.map((fact) => (
          <li key={fact.id} className="group flex items-start gap-3 text-base">
            <span className={`mt-0.5 shrink-0 rounded-lg px-2 py-0.5 text-sm ${SOURCE_STYLE[fact.source]}`}>{fact.source}</span>
            <span className="text-ink-soft">{fact.field}:</span>
            <span className="flex-1">{showValue(fact.value)}</span>
            <button onClick={() => onDeleteFact(fact.id)}
              className="text-sm text-ink-soft/50 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100">remove</button>
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAddFact(field, value.trim());
        setValue("");
      }}>
        <select className={`${input} w-36`} value={field} onChange={(e) => setField(e.target.value)} aria-label="Detail type">
          {["detail", "bullet", "tech", "scale", "role", "outcome"].map((f) => <option key={f}>{f}</option>)}
        </select>
        <input className={`${input} min-w-48 flex-1`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add a detail"
          aria-label="New detail" />
        <button className="rounded-xl border border-violet/40 bg-white px-5 text-base font-semibold text-violet hover:bg-mist">Add</button>
      </form>
    </article>
  );
}

const KIND_LABEL: Record<ItemKind, string> = {
  experience: "Experience", project: "Project", education: "Education", research: "Research",
  certification: "Certification", award: "Award", other: "Other",
};

function AddItem({ kinds, label, onAdd }: {
  kinds: ItemKind[]; label: string;
  onAdd: (body: { kind: ItemKind; title: string; organization: string | null }) => void;
}) {
  const [kind, setKind] = useState<ItemKind>(kinds[0]);
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  return (
    <form className="space-y-4 rounded-[1.5rem] border-2 border-dashed border-violet/30 bg-white/50 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd({ kind, title: title.trim(), organization: org.trim() || null });
        setTitle("");
        setOrg("");
      }}>
      <p className="font-display text-xl font-semibold">Add {label.toLowerCase()}</p>
      <div className="flex flex-wrap gap-3">
        {kinds.length > 1 && (
          <select className={`${input} w-44`} value={kind} onChange={(e) => setKind(e.target.value as ItemKind)} aria-label="Type">
            {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        )}
        <input className={`${input} min-w-48 flex-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
          aria-label="Title" />
        <input className={`${input} min-w-48 flex-1`} value={org} onChange={(e) => setOrg(e.target.value)}
          placeholder="Company, college or event (optional)" aria-label="Organisation" />
        <button className={button}>Add</button>
      </div>
    </form>
  );
}
