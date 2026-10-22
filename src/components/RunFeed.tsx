"use client";

import {
  AlertTriangle,
  Check,
  Loader2,
  Network,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Fragment } from "react";
import { describe, phaseOf, PHASES, type RunState } from "@/lib/run";
import { Badge, Card, Tip } from "./ui";

export function RunFeed({
  run,
  running,
  replay,
}: {
  run: RunState;
  running: boolean;
  replay: string | null;
}) {
  const done = Boolean(run.result);
  const reached = new Set(run.feed.map(phaseOf));
  const allSettled =
    run.feed.length > 0 && run.feed.every((f) => f.status !== "running");
  const writing = running && !done && allSettled && reached.has("places");
  const current = done
    ? null
    : writing
      ? "write"
      : run.feed.length
        ? phaseOf(run.feed[run.feed.length - 1])
        : "resolve";

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            {!done && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            )}
            <span
              className={`relative inline-flex size-2.5 rounded-full ${done ? "bg-good" : "bg-accent"}`}
            />
          </span>
          <h2 className="font-serif text-lg font-medium">
            {done ? "Agent run complete" : "Agent at work"}
          </h2>
          {replay && (
            <Tip content="This is a real run recorded earlier, replayed at high speed so you don't have to wait. Enter your own book to run the agent live.">
              <Badge tone="accent">Replay · {replay}</Badge>
            </Tip>
          )}
        </div>
        <p className="text-[12.5px] text-ink-3">
          {run.feed.length} Qloo call{run.feed.length === 1 ? "" : "s"}
          {run.result ? ` · ${run.result.seconds}s live` : ""}
        </p>
      </div>

      <ol className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ...PHASES,
          {
            key: "write" as const,
            label: "Write plan",
            tip: "Claude turns the Qloo evidence into comps, ad targets and channels, citing the numbers behind each pick.",
          },
        ].map((p, i) => {
          const isDone =
            done ||
            (p.key !== "write" && reached.has(p.key) && current !== p.key);
          const isNow = current === p.key;
          return (
            <li key={p.key}>
              <Tip content={p.tip} className="w-full">
                <span
                  className={`flex w-full cursor-help items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px] font-medium ${
                    isNow
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : isDone
                        ? "border-line bg-card text-ink-2"
                        : "border-dashed border-line text-ink-3"
                  }`}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sunk font-mono text-[10.5px]">
                    {isDone ? (
                      <Check className="size-3 text-good" />
                    ) : isNow ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {p.label}
                </span>
              </Tip>
            </li>
          );
        })}
      </ol>

      <ul className="space-y-1.5">
        <li className="rise flex items-start gap-3 rounded-xl border border-dashed border-rival/40 bg-rival-soft/50 px-3 py-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-rival-soft text-rival">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">
              Control group: an LLM guesses comps with no taste data
              <Tip content="Runs in parallel with the agent, so the report can show what Qloo adds over a plain LLM answer.">
                <span className="ml-1.5 cursor-help text-[12px] font-normal text-ink-3 underline decoration-dotted underline-offset-2">
                  why?
                </span>
              </Tip>
            </p>
            <p className="truncate text-[12.5px] text-ink-3">
              {run.baseline
                ? run.baseline.map((g) => g.title).join(" · ") ||
                  "No guesses returned"
                : "Asking…"}
            </p>
          </div>
          <StatusIcon status={run.baseline ? "done" : "running"} />
        </li>

        {run.feed.map((f, i) => {
          const d = describe(f);
          return (
            <Fragment key={f.id}>
              {run.checks
                .filter((c) => c.after === i)
                .map((c) => (
                  <CheckRow key={c.message} message={c.message} />
                ))}
              <li className="rise flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-sunk/60">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                  {f.tool === "qloo_search" ? (
                    <Search className="size-4" />
                  ) : (
                    <Network className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13.5px] font-medium">
                    {d.title}
                    <Tip
                      content={
                        <span className="font-mono text-[11px]">
                          {f.tool}({JSON.stringify(f.input)})
                        </span>
                      }
                    >
                      <span className="cursor-help text-[12px] font-normal text-ink-3 underline decoration-dotted underline-offset-2">
                        {d.detail}
                      </span>
                    </Tip>
                  </p>
                  {f.status === "error" ? (
                    <p className="text-[12.5px] text-bad">{f.error}</p>
                  ) : f.top && f.top.length > 0 ? (
                    <p className="truncate text-[12.5px] text-ink-3">
                      {f.count} found · {f.top.join(" · ")}
                    </p>
                  ) : f.status === "done" ? (
                    <p className="text-[12.5px] text-ink-3">No matches</p>
                  ) : null}
                </div>
                <span className="flex items-center gap-2">
                  {f.ms != null && (
                    <span className="font-mono text-[11px] text-ink-3">
                      {(f.ms / 1000).toFixed(1)}s
                    </span>
                  )}
                  <StatusIcon status={f.status} />
                </span>
              </li>
            </Fragment>
          );
        })}
        {run.checks
          .filter((c) => c.after >= run.feed.length)
          .map((c) => (
            <CheckRow key={c.message} message={c.message} />
          ))}

        {writing && (
          <li className="rise flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-sunk text-ink-2">
              <PenLine className="size-4" />
            </span>
            <p className="flex-1 text-[13.5px] font-medium">
              Writing your plan from the evidence…
            </p>
            <StatusIcon status="running" />
          </li>
        )}
      </ul>

      {run.error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2.5 text-[13.5px] text-bad">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {run.error}
        </p>
      )}
    </Card>
  );
}

function StatusIcon({ status }: { status: "running" | "done" | "error" }) {
  if (status === "running")
    return (
      <Loader2
        aria-label="Running"
        className="size-4 animate-spin text-accent"
      />
    );
  if (status === "error")
    return (
      <Tip
        content="This call failed. The agent sees the error and works around it."
        align="end"
      >
        <AlertTriangle aria-label="Failed" className="size-4 text-bad" />
      </Tip>
    );
  return <Check aria-label="Done" className="size-4 text-good" />;
}

function CheckRow({ message }: { message: string }) {
  return (
    <li className="rise flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-soft/60 px-3 py-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn">
        <ShieldCheck className="size-4" />
      </span>
      <p className="flex-1 text-[13.5px]">
        <span className="font-medium">{message}</span>
        <Tip content="Comps checks the agent's own plan before you see it. Comps on the crowded side of the taste map cost more to advertise against, so the agent is sent back with less-crowded alternatives from Qloo.">
          <span className="ml-1.5 cursor-help text-[12px] text-ink-3 underline decoration-dotted underline-offset-2">
            what is this?
          </span>
        </Tip>
      </p>
    </li>
  );
}
