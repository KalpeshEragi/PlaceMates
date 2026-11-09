"use client";

import { useEffect, useState } from "react";
import { api, type AgentQuestion, type EnrichView, type Screen, type SectionView } from "@/lib/api";

const primary =
  "rounded-xl bg-violet px-4 py-2 text-base font-medium text-white hover:bg-violet-deep disabled:opacity-50";
const quiet = "rounded-xl px-3 py-1.5 text-base text-ink-soft hover:bg-lavender/60 hover:text-ink disabled:opacity-50";
const input = "w-full rounded-xl border border-lavender bg-white px-3 py-2 text-base focus:border-violet focus:outline-none";

const STATUS_DOT: Record<string, string> = {
  finished: "bg-violet",
  in_progress: "bg-amber-400",
  skipped: "bg-ink-soft/30",
  not_started: "bg-lavender",
};

/** Profile assistant: guided topics, one question at a time, student always in control. */
export default function ImprovePanel({
  onSaved,
  focus,
}: {
  onSaved: () => void;
  focus: { id: string; nonce: number } | null;
}) {
  const [view, setView] = useState<EnrichView | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function call(label: string, path: string, body?: object) {
    setBusy(label);
    setError("");
    try {
      setView(await api<EnrichView>(path, { method: path === "/enrich" ? "GET" : "POST", body: body ? JSON.stringify(body) : undefined }));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    api<EnrichView>("/enrich").then(setView).catch((e) => setError(e.message));
  }, []);

  // "Discuss" on a profile item opens the assistant on that item.
  useEffect(() => {
    if (focus) call("Reading this item…", "/enrich/start", { entity_id: focus.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  if (!view) return error ? <p className="text-base text-red-700">{error}</p> : null;
  const { header, session, sections, failed_answers } = view;
  const screen = session.screen;
  const live = session.status === "active" && screen && screen.screen !== "done";
  const act = (type: string, label: string, keys: string[] = []) => call(label, "/enrich/action", { type, keys });

  return (
    <section id="assistant" className="space-y-4 rounded-3xl border border-lavender bg-lavender/40 p-5">
      {header && (
        <div>
          <h2 className="font-display text-2xl font-semibold">Profile strength: {header.strength}%</h2>
          <div className="mt-2 h-2 rounded-full bg-lavender">
            <div className="h-2 rounded-full bg-violet transition-all" style={{ width: `${header.strength}%` }} />
          </div>
          <p className="mt-3 text-base text-ink/85">{header.summary}</p>
        </div>
      )}

      {failed_answers > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-base text-amber-800">
          <span>
            {failed_answers} answer{failed_answers > 1 ? "s are" : " is"} saved but not fully processed yet.
          </span>
          <button className={quiet} disabled={!!busy} onClick={() => call("Processing saved answers…", "/enrich/retry")}>
            Try again
          </button>
        </div>
      )}

      {busy && <p className="animate-pulse text-base text-violet">{busy}</p>}
      {error && <p className="text-base text-red-700">{error}</p>}

      {!live && !busy && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4">
          <p className="flex-1 text-base text-ink/85">
            {session.status === "paused"
              ? "You paused here. Everything you shared is saved."
              : session.status === "done" || screen?.screen === "done"
                ? "You're all set for now. You can revisit any item below whenever you like."
                : "I've read your profile. Want to see where a few details could make it stronger? It only takes a few minutes, and you can skip anything."}
          </p>
          <button className={primary} onClick={() => call("Getting things ready…", "/enrich/start", {})}>
            {session.status === "paused" ? "Resume" : session.status === "done" ? "Start again" : "Let's go"}
          </button>
        </div>
      )}

      {screen?.screen === "done" && screen.notices.length > 0 && <Notices notices={screen.notices} />}

      {live && !busy && screen && (
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          {"entity" in screen && (
            <div className="flex items-center justify-between text-sm uppercase tracking-wide text-ink-soft">
              <span>
                {screen.entity.section_label} · {screen.entity.title}
              </span>
              <button className={quiet} onClick={() => call("Pausing…", "/enrich/pause")}>
                Pause
              </button>
            </div>
          )}
          <Notices notices={screen.notices} />
          {screen.screen === "topics" && <Topics screen={screen} act={act} />}
          {screen.screen === "question" && (
            <Question
              key={screen.question.text}
              screen={screen}
              act={act}
              answer={(body) => call("Saving your answer…", "/enrich/answer", body)}
            />
          )}
          {screen.screen === "summary" && <Summary screen={screen} act={act} />}
        </div>
      )}

      <Sections sections={sections} disabled={!!busy} onDiscuss={(id) => call("Reading this item…", "/enrich/start", { entity_id: id })} />
    </section>
  );
}

function Notices({ notices }: { notices: string[] }) {
  if (!notices.length) return null;
  return (
    <ul className="space-y-1 text-base text-ink-soft">
      {notices.map((n, i) => (
        <li key={i}>• {n}</li>
      ))}
    </ul>
  );
}

type Act = (type: string, label: string, keys?: string[]) => void;

function Topics({ screen, act }: { screen: Extract<Screen, { screen: "topics" }>; act: Act }) {
  // Picks survive "Suggest other topics", so earlier choices aren't lost when paging.
  const [picked, setPicked] = useState<string[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const toggle = (k: string, label: string) => {
    setLabels((l) => ({ ...l, [k]: label }));
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  };
  const earlier = picked.filter((k) => !screen.topics.some((t) => t.key === k));

  return (
    <div className="space-y-4">
      {screen.understanding && <p className="rounded-2xl bg-mist p-3 text-base text-ink">{screen.understanding}</p>}
      {screen.topics.length > 0 ? (
        <>
          <p className="text-base text-ink/85">A few details could make this stronger. Pick any you&apos;d like to talk about:</p>
          <div className="space-y-2">
            {screen.topics.map((t) => (
              <label
                key={t.key}
                className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${
                  picked.includes(t.key) ? "border-violet bg-lavender" : "border-lavender hover:border-violet/50"
                }`}
              >
                <input type="checkbox" className="mt-1" checked={picked.includes(t.key)} onChange={() => toggle(t.key, t.label)} />
                <span>
                  <span className="block text-base font-medium">{t.label}</span>
                  {t.why && <span className="block text-base text-ink-soft">{t.why}</span>}
                </span>
              </label>
            ))}
          </div>
          {earlier.length > 0 && (
            <p className="text-base text-ink-soft">Also chosen: {earlier.map((k) => labels[k] ?? k).join(", ")}</p>
          )}
        </>
      ) : (
        <p className="text-base text-ink/85">This already looks clear. Nothing important to add right now.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {screen.topics.length > 0 && (
          <button className={primary} disabled={!picked.length} onClick={() => act("select", "Thinking of a good first question…", picked)}>
            Explore {picked.length > 1 ? `${picked.length} topics` : "this"}
          </button>
        )}
        {screen.more_available && (
          <button className={quiet} onClick={() => act("more", "Finding other ideas…")}>
            Suggest other topics
          </button>
        )}
        <button className={quiet} onClick={() => act("skip_entity", "Saving…")}>
          {screen.topics.length ? "Skip for now" : "Continue"}
        </button>
        <button className={quiet} onClick={() => act("finish_section", "Saving…")}>
          Finish {screen.entity.section_label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

function Question({
  screen,
  act,
  answer,
}: {
  screen: Extract<Screen, { screen: "question" }>;
  act: Act;
  answer: (body: { keys: string[]; text: string | null; number: number | null }) => void;
}) {
  const q: AgentQuestion = screen.question;
  const [keys, setKeys] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [num, setNum] = useState("");
  const hasOptions = q.options.length > 0;

  function toggle(k: string) {
    setKeys((prev) => {
      if (q.kind === "single") return prev[0] === k ? [] : [k];
      return prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
    });
  }
  const canSend = keys.length > 0 || text.trim() !== "" || num.trim() !== "";
  const send = () => answer({ keys, text: text.trim() || null, number: num.trim() ? Number(num) : null });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {screen.selected_topics.map((t) => (
          <span
            key={t.key}
            className={`rounded-full px-2.5 py-0.5 text-sm ${t.current ? "bg-violet text-white" : "bg-lavender/60 text-ink-soft"}`}
          >
            {t.label}
          </span>
        ))}
      </div>

      {screen.history.map((h, i) => (
        <div key={i} className="space-y-1 text-base">
          <p className="text-ink-soft">{h.q}</p>
          <p className="ml-6 rounded-2xl bg-lavender px-3 py-2 text-ink">{h.a}</p>
        </div>
      ))}

      <div className="space-y-1">
        {q.lead_in && <p className="text-base text-ink-soft">{q.lead_in}</p>}
        <p className="font-medium">{q.text}</p>
        {q.kind === "multi" && <p className="text-sm text-ink-soft">Pick any that apply.</p>}
      </div>

      {hasOptions && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => (
            <button
              key={o.key}
              onClick={() => toggle(o.key)}
              className={`rounded-full border px-3 py-1.5 text-base transition ${
                keys.includes(o.key) ? "border-violet bg-violet text-white" : "border-lavender bg-white hover:border-violet/60"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {q.kind === "number" && (
        <div className="flex items-center gap-2">
          <input type="number" className={`${input} w-40`} value={num} onChange={(e) => setNum(e.target.value)} />
          {q.unit && <span className="text-base text-ink-soft">{q.unit}</span>}
        </div>
      )}
      {q.kind === "long_text" ? (
        <textarea className={input} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="In your own words…" />
      ) : (
        <input
          className={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canSend && send()}
          placeholder={hasOptions ? "Other, or add a note (shorthand like “ab + note” works too)" : q.kind === "number" ? "Or describe it" : "Your answer"}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={!canSend} onClick={send}>
          Send
        </button>
        <button className={quiet} onClick={() => act("skip_question", "Moving on…")}>
          Skip question
        </button>
        <button className={quiet} onClick={() => act("skip_topic", "Moving on…")}>
          Skip topic
        </button>
        <button className={quiet} onClick={() => act("finish_topic", "Saving…")}>
          Done with this topic
        </button>
        <button className={quiet} onClick={() => act("finish_entity", "Saving…")}>
          Finish {screen.entity.title} for now
        </button>
      </div>
    </div>
  );
}

function Summary({ screen, act }: { screen: Extract<Screen, { screen: "summary" }>; act: Act }) {
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <p className="text-base font-medium text-ink/85">{title}</p>
        <ul className="ml-5 list-disc text-base text-ink-soft">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="font-medium">
        {screen.saved.length ? `Your ${screen.entity.title} details are saved.` : `Nothing changed for ${screen.entity.title}, and that's fine.`}
      </p>
      {list("Saved", screen.saved)}
      {list("We talked about", screen.discussed)}
      {list("You skipped", screen.skipped)}
      {screen.unexplored.length > 0 && (
        <p className="text-base text-ink-soft">
          Not explored yet: {screen.unexplored.join(", ")}. You can come back to these anytime.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button className={primary} onClick={() => act("continue", screen.next_title ? `Looking at ${screen.next_title}…` : "Wrapping up…")}>
          {screen.next_title ? `Next: ${screen.next_title}` : "Finish"}
        </button>
        <button className={quiet} onClick={() => act("back_to_topics", "Loading topics…")}>
          Explore more here
        </button>
      </div>
    </div>
  );
}

function Sections({
  sections,
  disabled,
  onDiscuss,
}: {
  sections: SectionView[];
  disabled: boolean;
  onDiscuss: (id: string) => void;
}) {
  return (
    <details className="rounded-2xl bg-white p-3 text-base">
      <summary className="cursor-pointer font-medium text-ink/85">Sections and progress</summary>
      <div className="mt-3 space-y-3">
        {sections.map((s) => (
          <div key={s.key}>
            <p className="text-sm uppercase tracking-wide text-ink-soft">{s.label}</p>
            <ul className="mt-1 space-y-1">
              {s.entities.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[e.status] ?? "bg-lavender"}`} title={e.status.replace("_", " ")} />
                  <span className="flex-1">{e.title}</span>
                  {e.total > 0 && (
                    <span className="text-sm text-ink-soft/70">
                      {e.complete}/{e.total} clear
                    </span>
                  )}
                  <button className={quiet} disabled={disabled} onClick={() => onDiscuss(e.id)}>
                    Discuss
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
