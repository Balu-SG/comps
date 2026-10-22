"use client";

import { ArrowRight, BookOpenText, Brain, Github, Loader2, Network, PlayCircle, Radar, Target } from "lucide-react";
import Link from "next/link";
import { useReducer, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/agent";
import { emptyRun, EXAMPLES, reduce, type RecordedLine, type RunState } from "@/lib/run";
import { Report } from "@/components/Report";
import { RunFeed } from "@/components/RunFeed";
import { Card, InfoTip, Tip } from "@/components/ui";

const REPO = "https://github.com/Balu-SG/comps";
const REPLAY_MS = 9000;

type Action = { type: "reset" } | { type: "event"; e: AgentEvent };
const runReducer = (s: RunState, a: Action): RunState => (a.type === "reset" ? emptyRun : reduce(s, a.e));

export default function Home() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [comps, setComps] = useState("");
  const [run, dispatch] = useReducer(runReducer, emptyRun);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [replay, setReplay] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const timers = useRef<number[]>([]);
  const runRef = useRef<HTMLDivElement>(null);

  function begin(replayLabel: string | null) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    dispatch({ type: "reset" });
    setReplay(replayLabel);
    setStarted(true);
    setRunning(true);
    requestAnimationFrame(() => runRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function runLive(e: React.FormEvent) {
    e.preventDefault();
    const knownComps = comps.split(/[;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (description.trim().length < 20) {
      setFormError("Describe the book in at least a sentence or two (20+ characters).");
      return;
    }
    setFormError("");
    begin(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author: author || undefined, description, knownComps }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Something went wrong.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) dispatch({ type: "event", e: JSON.parse(line) });
      }
    } catch (err) {
      dispatch({ type: "event", e: { type: "error", message: err instanceof Error ? err.message : String(err) } });
    } finally {
      setRunning(false);
    }
  }

  async function playExample(slug: string, genre: string) {
    begin(genre);
    try {
      const text = await (await fetch(`/examples/${slug}.ndjson`)).text();
      const lines: RecordedLine[] = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const last = lines.at(-1)?.t ?? 1;
      const scale = Math.min(1, REPLAY_MS / last);
      for (const { t, e } of lines) {
        timers.current.push(
          window.setTimeout(() => {
            dispatch({ type: "event", e });
            if (e.type === "done" || e.type === "error") setRunning(false);
          }, t * scale),
        );
      }
      const book = lines.find((l) => l.e.type === "done");
      if (book?.e.type === "done") {
        const b = book.e.result.book;
        setTitle(b.title);
        setAuthor(b.author ?? "");
        setDescription(b.description);
        setComps(b.knownComps.join("; "));
      }
    } catch {
      dispatch({ type: "event", e: { type: "error", message: "Could not load the example." } });
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-paper">
              <BookOpenText className="size-4" />
            </span>
            <span className="font-serif text-xl font-semibold tracking-tight">Comps</span>
          </Link>
          <div className="flex items-center gap-1 text-[13px] sm:gap-4">
            <a href="#how" className="hidden rounded-md px-2 py-1 text-ink-2 hover:text-ink sm:inline">
              How it works
            </a>
            <Tip content="Taste data from Qloo's Taste AI. Reasoning by Claude." side="bottom" align="end">
              <span className="hidden cursor-help rounded-full border border-line bg-card px-2.5 py-1 text-[12px] text-ink-2 md:inline">
                Qloo Taste AI × Claude
              </span>
            </Tip>
            <a href={REPO} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-ink-2 hover:text-ink" target="_blank" rel="noreferrer">
              <Github className="size-4" /> <span className="hidden sm:inline">Source</span>
            </a>
          </div>
        </div>
      </nav>

      <header className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-[12px] font-medium text-ink-2">
            <span className="size-1.5 rounded-full bg-good" /> For self-published authors
          </p>
          <h1 className="font-serif text-[40px] font-medium leading-[1.05] tracking-tight sm:text-[56px]">
            Find the readers who will <em className="text-accent-ink">actually</em> buy your book.
          </h1>
          <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-2">
            Comps is an AI agent that reads Qloo&apos;s taste graph, not its own memory. It finds comp titles with real reader overlap, Amazon Ads
            targets that won&apos;t burn your budget, and the podcasts, shows and places where your readers already are.
          </p>
          <ul className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Target, t: "Evidence, not vibes", d: "Every pick cites Qloo's affinity and popularity." },
              { icon: Radar, t: "Taste map", d: "See the sweet spot between fit and crowding." },
              { icon: Brain, t: "Beats LLM-only", d: "Side by side with what a plain LLM guesses." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="rounded-xl border border-line bg-card p-3.5">
                <Icon className="size-4 text-accent" />
                <p className="mt-2 text-[13.5px] font-semibold">{t}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{d}</p>
              </li>
            ))}
          </ul>
        </div>

        <Card className="p-5 shadow-[0_1px_0_var(--line),0_20px_40px_-24px_rgba(23,21,15,0.25)] sm:p-6">
          <form onSubmit={runLive} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-medium">Your book</h2>
              <InfoTip align="end">Nothing is stored. Your description is sent to Claude and the titles you name are looked up in Qloo.</InfoTip>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <Field label="Title" required>
                <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="The Lighthouse Ledger" />
              </Field>
              <Field label="Author" hint="optional">
                <input className={input} value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} />
              </Field>
            </div>
            <Field label="What is it about?" required tip="Two or three sentences: premise, tone and audience. The more specific, the sharper the comps.">
              <textarea
                className={`${input} min-h-28 resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={2000}
                placeholder="A cozy mystery set in a Cornish fishing village…"
              />
            </Field>
            <Field
              label="Books you think are similar"
              hint="up to 5, separate with ;"
              tip="Your best guesses. The agent finds them in Qloo and uses them as signals to discover who really reads books like yours."
            >
              <input className={input} value={comps} onChange={(e) => setComps(e.target.value)} placeholder="The Thursday Murder Club; Agatha Raisin" />
            </Field>
            {formError && <p className="text-[13px] text-bad">{formError}</p>}
            <button
              type="submit"
              disabled={running}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-[15px] font-medium text-paper outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {running && !replay ? <Loader2 className="size-4 animate-spin" /> : null}
              {running && !replay ? "Reading the taste graph…" : "Find my readers"}
              {!running && <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />}
            </button>
            <p className="text-center text-[12px] text-ink-3">A live run takes about a minute. You&apos;ll see every Qloo call as it happens.</p>
          </form>

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
              <PlayCircle className="size-4 text-accent" /> No book handy? Replay a real run instantly
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <Tip key={ex.slug} content={`“${ex.title}”: a real agent run, recorded and replayed in a few seconds.`}>
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => playExample(ex.slug, ex.genre)}
                    className="rounded-full border border-line bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 outline-none transition hover:border-accent hover:text-accent-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                  >
                    {ex.genre}
                  </button>
                </Tip>
              ))}
            </div>
          </div>
        </Card>
      </header>

      <div ref={runRef} className="scroll-mt-20">
        {started && (
          <main className="mx-auto max-w-6xl space-y-12 px-4 pb-20 sm:px-6">
            <RunFeed run={run} running={running} replay={replay} />
            {run.result ? <Report result={run.result} /> : !run.error && <ReportSkeleton />}
          </main>
        )}
      </div>

      <section id="how" className="scroll-mt-20 border-t border-line bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">How it works</p>
          <h2 className="mt-2 max-w-2xl font-serif text-3xl font-medium tracking-tight">An agent that checks who really reads books like yours</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                icon: BookOpenText,
                t: "Resolve your signals",
                d: "The agent finds your book, your comps and their authors in Qloo's catalogue, so it reasons from real IDs instead of fuzzy titles.",
              },
              {
                n: "02",
                icon: Network,
                t: "Read the taste graph",
                d: "It asks Qloo what those readers also love: books, authors, podcasts, shows, films, brands and places, each with affinity and popularity scores.",
              },
              {
                n: "03",
                icon: Target,
                t: "Build an evidence-backed plan",
                d: "Claude weighs fit against crowding, then writes your pitch line, comps, ad targets and channels, citing the numbers behind every pick.",
              },
            ].map(({ n, icon: Icon, t, d }) => (
              <Card key={n} className="p-5">
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-accent" />
                  <span className="font-mono text-[12px] text-ink-3">{n}</span>
                </div>
                <p className="mt-4 text-[15px] font-semibold">{t}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{d}</p>
              </Card>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-line bg-paper p-5 text-[14px] leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">Why not just ask a chatbot?</p>
            <p className="mt-1">
              A chatbot names the same famous books for everyone, the ones every author already bids on. It has no idea who actually reads what. Comps
              runs a plain LLM next to the agent on every request, so you can see the difference for your own book.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-[12.5px] text-ink-3 sm:px-6">
          <p>Built for the Qloo Agentic Hackathon · Open source, MIT</p>
          <a href={REPO} className="inline-flex items-center gap-1.5 hover:text-ink" target="_blank" rel="noreferrer">
            <Github className="size-3.5" /> github.com/Balu-SG/comps
          </a>
        </div>
      </footer>
    </div>
  );
}

const input =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14.5px] outline-none transition placeholder:text-ink-3/70 focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent-soft";

function Field({ label, required, hint, tip, children }: { label: string; required?: boolean; hint?: string; tip?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-ink-2">
        {label}
        {required && <span className="text-ink-3">*</span>}
        {hint && <span className="font-normal text-ink-3">· {hint}</span>}
        {tip && <InfoTip>{tip}</InfoTip>}
      </span>
      {children}
    </label>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="skeleton h-9 w-2/3 rounded-lg" />
      <div className="skeleton h-36 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  );
}
