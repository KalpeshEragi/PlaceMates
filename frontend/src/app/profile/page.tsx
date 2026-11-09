"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ImprovePanel from "@/components/ImprovePanel";
import { api, ApiError, type Basics, type Fact, type Item, type ItemKind, type Profile } from "@/lib/api";

const KINDS: ItemKind[] = ["project", "experience", "research", "education", "certification", "award", "other"];
const SOURCE_STYLE: Record<Fact["source"], string> = {
  resume: "bg-lavender/60 text-ink-soft",
  mcq: "bg-lavender text-violet",
  note: "bg-sky-50 text-sky-700",
  manual: "bg-amber-50 text-amber-700",
};

const input = "w-full rounded-xl border border-lavender bg-white px-3 py-2 text-base focus:border-violet focus:outline-none";
const button = "rounded-xl bg-violet px-4 py-2 text-base font-medium text-white hover:bg-violet-deep disabled:opacity-50";

function showValue(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Profile>("/profile")
      .then(setProfile)
      .catch((e) => (e instanceof ApiError && e.status === 401 ? router.push("/login") : setError(e.message)));
  }, [router]);

  // Calls that return the full profile update it directly; any other call refetches it.
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      const isProfile = typeof result === "object" && result !== null && "items" in result;
      setProfile(isProfile ? (result as Profile) : await api<Profile>("/profile"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!profile)
    return (
      <AppShell title="Your profile">
        <p className="text-ink-soft">{error || "Loading…"}</p>
      </AppShell>
    );

  return (
    <AppShell
      title="Your profile"
      subtitle="Everything PlaceMates knows about your work. Each fact shows where it came from."
      actions={
        <ResumeUpload
          busy={busy}
          onUpload={(file) => {
            const form = new FormData();
            form.append("file", file);
            return run(() => api<Profile>("/profile/resume", { method: "POST", body: form }));
          }}
        />
      }
    >
    <div className="space-y-8">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">{error}</p>}
      {busy && <p className="text-base text-ink-soft">Working…</p>}

      <ImprovePanel focus={focus} onSaved={() => api<Profile>("/profile").then(setProfile)} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
      <div className="space-y-8 xl:sticky xl:top-6">
      <BasicsForm
        profile={profile}
        onSave={(basics) => run(() => api<Profile>("/profile/basics", { method: "PUT", body: JSON.stringify(basics) }))}
      />

      <SkillsEditor
        skills={profile.skills.map((s) => s.name)}
        onSave={(names) => run(() => api<Profile>("/profile/skills", { method: "PUT", body: JSON.stringify(names) }))}
      />
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Experience, projects and education</h2>
        {profile.items.length === 0 && (
          <p className="text-base text-ink-soft">Nothing yet. Upload a resume or add an item below.</p>
        )}
        {profile.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onDiscuss={() => {
              setFocus({ id: item.id, nonce: Date.now() });
              document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth" });
            }}
            onDelete={() => run(() => api(`/profile/items/${item.id}`, { method: "DELETE" }))}
            onDeleteFact={(id) => run(() => api(`/profile/facts/${id}`, { method: "DELETE" }))}
            onAddFact={(field, value) =>
              run(() =>
                api(`/profile/items/${item.id}/facts`, {
                  method: "POST",
                  body: JSON.stringify({ field, value, source: "manual" }),
                }),
              )
            }
          />
        ))}
        <AddItem onAdd={(body) => run(() => api("/profile/items", { method: "POST", body: JSON.stringify(body) }))} />
      </section>
      </div>
    </div>
    </AppShell>
  );
}

function ResumeUpload({ busy, onUpload }: { busy: boolean; onUpload: (f: File) => void }) {
  return (
    <label className={`${button} cursor-pointer`}>
      Upload resume (PDF)
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function BasicsForm({ profile, onSave }: { profile: Profile; onSave: (b: Basics) => void }) {
  const [form, setForm] = useState<Basics>(profile);
  useEffect(() => setForm(profile), [profile]);
  const fields: [keyof Basics, string][] = [
    ["full_name", "Full name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["location", "Location"],
    ["headline", "Headline"],
  ];

  return (
    <section className="space-y-3 rounded-3xl border border-lavender bg-white p-6 sm:p-7">
      <h2 className="font-display text-2xl font-semibold">Basics</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {fields.map(([key, label]) => (
          <label key={key} className="text-base">
            <span className="text-ink-soft">{label}</span>
            <input
              className={input}
              value={(form[key] as string) ?? ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="block text-base">
        <span className="text-ink-soft">Links (one per line)</span>
        <textarea
          className={input}
          rows={3}
          value={form.links.join("\n")}
          onChange={(e) => setForm({ ...form, links: e.target.value.split("\n") })}
        />
      </label>
      <button
        className={button}
        onClick={() => onSave({ ...form, links: form.links.map((l) => l.trim()).filter(Boolean) })}
      >
        Save basics
      </button>
    </section>
  );
}

function SkillsEditor({ skills, onSave }: { skills: string[]; onSave: (names: string[]) => void }) {
  const [text, setText] = useState(skills.join(", "));
  useEffect(() => setText(skills.join(", ")), [skills]);

  return (
    <section className="space-y-3 rounded-3xl border border-lavender bg-white p-6 sm:p-7">
      <h2 className="font-display text-2xl font-semibold">Skills</h2>
      <input className={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="React, Node.js, SQL" />
      <button className={button} onClick={() => onSave(text.split(",").map((s) => s.trim()).filter(Boolean))}>
        Save skills
      </button>
    </section>
  );
}

function ItemCard({
  item,
  onDiscuss,
  onDelete,
  onDeleteFact,
  onAddFact,
}: {
  item: Item;
  onDiscuss: () => void;
  onDelete: () => void;
  onDeleteFact: (id: string) => void;
  onAddFact: (field: string, value: string) => void;
}) {
  const [field, setField] = useState("detail");
  const [value, setValue] = useState("");
  const dates = [item.start_date, item.end_date].filter(Boolean).join(" – ");

  return (
    <article className="space-y-3 rounded-3xl border border-lavender bg-white p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-ink-soft">{item.kind}</p>
          <h3 className="font-semibold">
            {item.title}
            {item.organization && <span className="font-normal text-ink-soft"> · {item.organization}</span>}
          </h3>
          {dates && <p className="text-base text-ink-soft">{dates}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onDiscuss} className="text-base text-violet hover:text-violet-deep">
            Discuss
          </button>
          <button onClick={onDelete} className="text-base text-ink-soft/70 hover:text-red-600">
            Delete
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {item.facts.map((fact) => (
          <li key={fact.id} className="group flex items-start gap-2 text-base">
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-sm ${SOURCE_STYLE[fact.source]}`}>{fact.source}</span>
            <span className="text-ink-soft">{fact.field}:</span>
            <span className="flex-1">{showValue(fact.value)}</span>
            <button
              onClick={() => onDeleteFact(fact.id)}
              className="text-sm text-ink-soft/50 opacity-0 hover:text-red-600 group-hover:opacity-100"
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onAddFact(field, value.trim());
          setValue("");
        }}
      >
        <select className={`${input} w-32`} value={field} onChange={(e) => setField(e.target.value)}>
          {["detail", "bullet", "tech", "scale", "role", "outcome"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <input className={input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add a fact" />
        <button className={button}>Add</button>
      </form>
    </article>
  );
}

function AddItem({ onAdd }: { onAdd: (body: { kind: ItemKind; title: string; organization: string | null }) => void }) {
  const [kind, setKind] = useState<ItemKind>("project");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");

  return (
    <form
      className="flex flex-wrap gap-2 rounded-3xl border border-dashed border-lavender p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd({ kind, title: title.trim(), organization: org.trim() || null });
        setTitle("");
        setOrg("");
      }}
    >
      <select className={`${input} w-40`} value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
        {KINDS.map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      <input className={`${input} flex-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <input className={`${input} flex-1`} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Company / college (optional)" />
      <button className={button}>Add item</button>
    </form>
  );
}
