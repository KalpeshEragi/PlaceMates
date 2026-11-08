"use client";

import { useEffect, useState } from "react";
import { api, type EnrichState, type Question } from "@/lib/api";

type Picks = Record<number, string[]>;
type Notes = Record<number, string>;

export default function ImprovePanel({ onSaved }: { onSaved: () => void }) {
  const [state, setState] = useState<EnrichState | null>(null);
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<Picks>({});
  const [notes, setNotes] = useState<Notes>({});
  const [shorthand, setShorthand] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setState(await api<EnrichState>("/enrich"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load questions");
    }
  }
  useEffect(() => {
    load();
  }, []);

  function toggle(q: Question, key: string) {
    setPicks((prev) => {
      const current = prev[q.n] ?? [];
      if (!q.multi || key === q.skip_key) return { ...prev, [q.n]: current[0] === key ? [] : [key] };
      const withoutSkip = current.filter((k) => k !== q.skip_key);
      return {
        ...prev,
        [q.n]: withoutSkip.includes(key) ? withoutSkip.filter((k) => k !== key) : [...withoutSkip, key],
      };
    });
  }

  async function submit() {
    if (!state?.batch) return;
    setBusy(true);
    setError("");
    const body = shorthand.trim()
      ? { batch_id: state.batch.id, reply: shorthand }
      : {
          batch_id: state.batch.id,
          answers: state.batch.questions.map((q) => ({
            n: q.n,
            keys: picks[q.n] ?? [],
            note: notes[q.n]?.trim() || null,
          })),
        };
    try {
      setState(await api<EnrichState>("/enrich/answer", { method: "POST", body: JSON.stringify(body) }));
      setPicks({});
      setNotes({});
      setShorthand("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save answers");
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  const done = !state.batch;

  return (
    <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Profile strength: {state.strength}%</h2>
          <div className="mt-2 h-2 rounded-full bg-zinc-200">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${state.strength}%` }} />
          </div>
        </div>
        {!done && !open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Improve my profile
          </button>
        )}
      </div>

      {done && <p className="text-sm text-zinc-600">Nothing left to ask right now. Add items or upload a resume to get more questions.</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {open && state.batch && (
        <div className="space-y-5">
          <p className="text-sm text-zinc-600">
            Tap your answers, or type shorthand below like <code className="rounded bg-white px-1">1c 2a 3abd + also added Redis</code>.
          </p>

          {state.batch.questions.map((q) => (
            <div key={q.n} className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{q.item_title}</p>
              <p className="font-medium">
                {q.n}. {q.text}
                {q.multi && <span className="ml-2 text-xs font-normal text-zinc-500">(pick any)</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => {
                  const on = (picks[q.n] ?? []).includes(o.key);
                  return (
                    <button
                      key={o.key}
                      onClick={() => toggle(q, o.key)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        on ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 bg-white hover:border-zinc-500"
                      } ${o.key === q.skip_key && !on ? "text-zinc-500" : ""}`}
                    >
                      <span className="mr-1 font-mono text-xs opacity-60">{o.key}</span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <input
                value={notes[q.n] ?? ""}
                onChange={(e) => setNotes({ ...notes, [q.n]: e.target.value })}
                placeholder="Anything to add? (optional)"
                className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none"
              />
            </div>
          ))}

          <div className="flex gap-2">
            <input
              value={shorthand}
              onChange={(e) => setShorthand(e.target.value)}
              placeholder="Or type: 1c 2a 3abd + note"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm focus:border-zinc-900 focus:outline-none"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save answers"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
