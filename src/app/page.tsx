"use client";

import { useState } from "react";
import type { Plan, TraceStep } from "@/lib/agent";

type Result = { plan: Plan; trace: TraceStep[]; sample: boolean };

const EXAMPLE = {
  title: "The Lighthouse Ledger",
  author: "",
  description:
    "A cozy mystery set in a Cornish fishing village. A retired bookkeeper finds a coded ledger in a lighthouse and has to work out which of her neighbours has been hiding money for forty years. Gentle humour, found family, no gore.",
  comps: "Richard Osman's The Thursday Murder Club; M.C. Beaton's Agatha Raisin",
};

export default function Home() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [comps, setComps] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author: author || undefined,
          description,
          knownComps: comps.split(/[;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function useExample() {
    setTitle(EXAMPLE.title);
    setAuthor(EXAMPLE.author);
    setDescription(EXAMPLE.description);
    setComps(EXAMPLE.comps);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Comps</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Find the readers who will actually buy your book. Comps uses Qloo&apos;s taste graph to pick real comparable
          titles, Amazon Ads targets, and places to reach readers outside Amazon, and shows the evidence for each pick.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Book title" required>
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </Field>
          <Field label="Author (optional)">
            <input className={input} value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} />
          </Field>
        </div>
        <Field label="What is the book about?" required>
          <textarea
            className={`${input} min-h-28`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={20}
            maxLength={2000}
          />
        </Field>
        <Field label="Books you think are similar (separate with ;)">
          <input className={input} value={comps} onChange={(e) => setComps(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-stone-900 px-5 py-2.5 font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? "Reading the taste graph…" : "Find my readers"}
          </button>
          <button type="button" onClick={useExample} className="text-sm text-stone-600 underline underline-offset-4">
            Try an example book
          </button>
        </div>
        {loading && <p className="text-sm text-stone-500">This takes about a minute: the agent makes a series of Qloo calls.</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>

      {result && <PlanView result={result} />}
    </main>
  );
}

const input =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">
        {label}
        {required && <span className="text-stone-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

function downloadCsv(plan: Plan) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["target", "kind", "priority", "why"], ...plan.ad_targets.map((t) => [t.target, t.kind, t.priority, t.why])];
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "comps-ad-targets.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function PlanView({ result }: { result: Result }) {
  const { plan, trace, sample } = result;
  return (
    <div className="mt-10 space-y-8">
      {sample && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sample mode: no Qloo key is set yet, so the names below are made-up placeholders.
        </p>
      )}

      <section className="rounded-xl bg-stone-900 px-5 py-6 text-stone-50">
        <p className="text-xs uppercase tracking-widest text-stone-400">Your pitch line</p>
        <p className="mt-2 text-xl font-medium sm:text-2xl">{plan.pitch_line}</p>
      </section>

      <Section title="Comp titles">
        <div className="grid gap-3 sm:grid-cols-2">
          {plan.comp_titles.map((c) => (
            <div key={c.title} className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="font-medium">{c.title}</p>
              {c.author && <p className="text-sm text-stone-500">{c.author}</p>}
              <p className="mt-2 text-sm">{c.why}</p>
              <p className="mt-2 font-mono text-xs text-stone-500">{c.evidence}</p>
              {c.warning && <p className="mt-2 text-xs text-amber-800">{c.warning}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Amazon Ads targets"
        action={
          <button onClick={() => downloadCsv(plan)} className="text-sm text-stone-700 underline underline-offset-4">
            Download CSV
          </button>
        }
      >
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {plan.ad_targets.map((t) => (
                <tr key={t.target + t.kind} className="border-t border-stone-100 align-top">
                  <td className="px-3 py-2 font-medium">{t.target}</td>
                  <td className="px-3 py-2 text-stone-600">{t.kind}</td>
                  <td className="px-3 py-2">{t.priority}</td>
                  <td className="px-3 py-2 text-stone-600">{t.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-8 sm:grid-cols-2">
        <Section title="Reach readers outside Amazon">
          <ul className="space-y-3">
            {plan.outside_amazon.map((o) => (
              <li key={o.name} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <span className="mr-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">{o.channel.replace("_", " ")}</span>
                <span className="font-medium">{o.name}</span>
                <p className="mt-1 text-stone-600">{o.idea}</p>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Where your readers are">
          <ul className="space-y-3">
            {plan.regions.map((r) => (
              <li key={r.place} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <span className="font-medium">{r.place}</span>
                <p className="mt-1 text-stone-600">{r.why}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {plan.avoid.length > 0 && (
        <Section title="Skip these (crowded or poor fit)">
          <ul className="space-y-2 text-sm">
            {plan.avoid.map((a) => (
              <li key={a.name}>
                <span className="font-medium">{a.name}</span> <span className="text-stone-600">— {a.why}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {plan.notes && <p className="text-sm text-stone-600">{plan.notes}</p>}

      <details className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">Qloo calls the agent made ({trace.length})</summary>
        <ol className="mt-3 space-y-2 font-mono text-xs">
          {trace.map((t, i) => (
            <li key={i} className={t.error ? "text-red-700" : "text-stone-600"}>
              {i + 1}. {t.tool} {JSON.stringify(t.input)} → {t.error ?? `${t.count} results`} · {t.ms}ms
              {t.sample ? " · sample" : ""}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
