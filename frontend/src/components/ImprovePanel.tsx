"use client";

import { useEffect, useState } from "react";
import { api, type EnrichState, type Question } from "@/lib/api";

type Picks = Record<number, string[]>;
type Notes = Record<number, string>;

function show(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export default function ImprovePanel({ onSaved }: { onSaved: () => void }) {
  const [state, setState] = useState<EnrichState | null>(null);
  const [picks, setPicks] = useState<Picks>({});
  const [notes, setNotes] = useState<Notes>({});
  const [shorthand, setShorthand] = useState("");
  const [freeText, setFreeText] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<EnrichState>("/enrich")
      .then(setState)
      .catch((e) => setError(e.message));
  }, []);

  async function call(label: string, path: string, body?: object) {
    setBusy(label);
    setError("");
    try {
      const next = await api<EnrichState>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      setState(next);
      setPicks({});
      setNotes({});
      setShorthand("");
      setFreeText("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  }

  function toggle(q: Question, key: string) {
    setPicks((prev) => {
      const current = prev[q.n] ?? [];
      if (!q.multi || key === q.skip_key) return { ...prev, [q.n]: current[0] === key ? [] : [key] };
      const rest = current.filter((k) => k !== q.skip_key);
      return { ...prev, [q.n]: rest.includes(key) ? rest.filter((k) => k !== key) : [...rest, key] };
    });
  }

  function submit() {
    if (!state) return;
    const free_text = freeText.trim() || null;
    const body = shorthand.trim()
      ? { reply: shorthand, free_text }
      : {
          free_text,
          answers: state.questions.map((q) => ({ n: q.n, keys: picks[q.n] ?? [], note: notes[q.n]?.trim() || null })),
        };
    call("Reading your answers and picking the next questions…", "/enrich/answer", body);
  }

  if (!state) return error ? <p className="text-sm text-red-700">{error}</p> : null;
  const asking = state.status === "asking";

  return (
    <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Profile strength: {state.strength}%</h2>
          <div className="mt-2 h-2 rounded-full bg-zinc-200">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${state.strength}%` }} />
          </div>
          {state.summary && <p className="mt-3 text-sm text-zinc-700">{state.summary}</p>}
          {state.strength_reasons.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-zinc-600">
              {state.strength_reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
        {asking ? (
          <button
            onClick={() => call("Stopping…", "/enrich/stop")}
            disabled={!!busy}
            className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
          >
            Stop for now
          </button>
        ) : (
          <button
            onClick={() => call("Reading your profile and choosing questions…", "/enrich/start")}
            disabled={!!busy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {state.status === "done" ? "Ask me more" : "Improve my profile"}
          </button>
        )}
      </div>

      {busy && <p className="animate-pulse text-sm text-emerald-700">{busy}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {state.last_recorded.length > 0 && (
        <div className="rounded-lg bg-white p-3 text-sm">
          <p className="mb-1 font-medium text-zinc-700">Saved from your last answers</p>
          <ul className="space-y-0.5 text-zinc-600">
            {state.last_recorded.map((r, i) => (
              <li key={i}>
                <span className="text-zinc-400">{r.field}:</span> {show(r.value)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.conflicts.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">These didn&apos;t match earlier answers. Fix the facts below if needed:</p>
          <ul className="list-disc pl-5">
            {state.conflicts.map((c, i) => (
              <li key={i}>{c.split(": ").slice(1).join(": ") || c}</li>
            ))}
          </ul>
        </div>
      )}

      {!asking && state.status === "done" && !busy && (
        <p className="text-sm text-zinc-600">That&apos;s everything worth asking for now. Nice work.</p>
      )}

      {asking && !busy && (
        <div className="space-y-5">
          <p className="text-sm text-zinc-600">
            Tap your answers, or type shorthand like <code className="rounded bg-white px-1">1c 2a 3abd + also added Redis</code>.
          </p>

          {state.questions.map((q) => (
            <div key={q.n} className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{q.item_title}</p>
              <p className="font-medium">
                {q.n}. {q.text}
                {q.multi && <span className="ml-2 text-xs font-normal text-zinc-500">(pick any)</span>}
              </p>
              {q.kind !== "text" && (
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
              )}
              <input
                value={notes[q.n] ?? ""}
                onChange={(e) => setNotes({ ...notes, [q.n]: e.target.value })}
                placeholder={q.kind === "text" ? "Your answer" : "Anything to add? (optional)"}
                className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none"
              />
            </div>
          ))}

          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={2}
            placeholder="Or just tell me in your own words, e.g. “Shop API is live on Render and our canteen uses it”"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={shorthand}
              onChange={(e) => setShorthand(e.target.value)}
              placeholder="Shorthand: 1c 2a 3abd + note"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm focus:border-zinc-900 focus:outline-none"
            />
            <button
              onClick={submit}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Save answers
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
