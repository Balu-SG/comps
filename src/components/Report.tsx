"use client";

import {
  Ban,
  BookOpen,
  Brain,
  Download,
  Film,
  Headphones,
  Lightbulb,
  ListChecks,
  MapPin,
  Megaphone,
  Radar,
  ShoppingBag,
  Target,
  TerminalSquare,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Candidate, Plan, PlanResult } from "@/lib/agent";
import { TYPE_LABEL } from "@/lib/run";
import { norm, TasteMap } from "./TasteMap";
import { Badge, Card, CopyButton, Meter, SectionHeader, Tip, type Tone } from "./ui";

const AFFINITY_TIP = "Affinity (0–1): how strongly people who like your signals also like this. Higher means a closer reader match.";
const POPULARITY_TIP =
  "Popularity (0–1): how mainstream this is across Qloo's data. Very high means many authors already advertise against it, so clicks cost more.";

export function Report({ result }: { result: PlanResult }) {
  const { plan, candidates, baseline, trace, book } = result;
  const byName = useMemo(() => new Map(candidates.map((c) => [norm(c.name), c])), [candidates]);
  const errors = trace.filter((t) => t.error).length;

  return (
    <div className="space-y-12">
      {/* Header + pitch */}
      <section className="rise">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Reader intelligence report</p>
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-[40px] sm:leading-[1.1]">{book.title}</h1>
        {book.knownComps.length > 0 && (
          <p className="mt-2 text-[14px] text-ink-3">Seeded with: {book.knownComps.join(" · ")}</p>
        )}

        <div className="mt-6 rounded-2xl bg-hero p-6 text-hero-ink sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
              <Megaphone className="size-3.5" /> Your pitch line
            </p>
            <CopyButton text={plan.pitch_line} />
          </div>
          <p className="mt-3 font-serif text-2xl leading-snug sm:text-[30px]">“{plan.pitch_line}”</p>
          <p className="mt-3 text-[13px] opacity-70">Use it in your book description, A+ content, ad copy and reader-magnet pages.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Qloo calls" value={trace.length} tip={`The agent queried Qloo's taste graph ${trace.length} times${errors ? `; ${errors} failed and were worked around` : ""}.`} />
          <Stat label="Books & authors scored" value={candidates.length} tip="Every book and author Qloo returned with an affinity and popularity score. All of them are plotted on the taste map below." />
          <Stat label="Comps chosen" value={plan.comp_titles.length} tip="Picked for strong reader overlap with moderate popularity: real readers, affordable ads." />
          <Stat label="Ad targets" value={plan.ad_targets.length} tip="Ready to paste into Amazon Ads as product, author or keyword targets." />
        </div>
      </section>

      <QlooVsLlm result={result} byName={byName} />

      <section>
        <SectionHeader
          icon={<Radar className="size-5" />}
          kicker="Signature view"
          title="Taste map"
          info={
            <>
              Every book and author Qloo returned, by fit (up) and how mainstream it is (right). They are all strong matches, so the best comps
              for a new author sit in the shaded, less-crowded half. Orange triangles are the LLM-only guesses: they have no fit score at all.
              Hover any dot for details.
            </>
          }
        />
        <Card className="p-4 sm:p-6">
          <TasteMap candidates={candidates} plan={plan} baseline={baseline} />
        </Card>
      </section>

      <section>
        <SectionHeader
          icon={<BookOpen className="size-5" />}
          title="Comp titles"
          info="Comparable titles to name in your pitch, your book description and your ads. Each one comes from Qloo with the numbers behind it."
          action={<CopyButton text={plan.comp_titles.map((c) => (c.author ? `${c.title} by ${c.author}` : c.title)).join("\n")} label="Copy list" />}
        />
        <div className="grid gap-3 md:grid-cols-2">
          {plan.comp_titles.map((c, i) => {
            const hit = byName.get(norm(c.title));
            return (
              <Card key={c.title} className="rise flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-[17px] font-medium leading-snug">{c.title}</p>
                    {c.author && <p className="text-[13px] text-ink-3">{c.author}</p>}
                  </div>
                  <span className="font-mono text-[12px] text-ink-3">#{i + 1}</span>
                </div>
                <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-2">{c.why}</p>
                {hit ? (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Meter label="Affinity" value={hit.affinity} tip={AFFINITY_TIP} />
                    <Meter label="Popularity" value={hit.popularity} tip={POPULARITY_TIP} tone="muted" />
                  </div>
                ) : (
                  <Tip content="The Qloo numbers the agent cited for this pick.">
                    <p className="mt-4 cursor-help font-mono text-[12px] text-ink-3">{c.evidence}</p>
                  </Tip>
                )}
                {c.warning && (
                  <p className="mt-3 rounded-lg bg-warn-soft px-2.5 py-1.5 text-[12.5px] text-warn">
                    <span className="font-semibold">Watch out:</span> {c.warning}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <AdTargets plan={plan} />

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <SectionHeader
            icon={<Headphones className="size-5" />}
            title="Reach readers outside Amazon"
            info="Podcasts, shows, films and brands your readers over-index on, per Qloo. Use them for sponsorships, guest spots, newsletter swaps or ad interest targeting on Meta and BookBub."
          />
          <div className="space-y-3">
            {plan.outside_amazon.map((o) => {
              const ch = CHANNEL[o.channel] ?? CHANNEL.other;
              return (
                <Card key={o.name} className="flex gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                    <ch.icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium">
                      {o.name} <Badge>{ch.label}</Badge>
                    </p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{o.idea}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeader
            icon={<MapPin className="size-5" />}
            title="Where your readers cluster"
            info="Places where people with your readers' taste over-index in Qloo. Use them for location targeting, bookstore events, library talks and local press."
          />
          <Card className="divide-y divide-line">
            {plan.regions.map((r, i) => (
              <div key={r.place} className="flex gap-3 p-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunk font-mono text-[12px] text-ink-2">{i + 1}</span>
                <div>
                  <p className="text-[14.5px] font-medium">{r.place}</p>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">{r.why}</p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      </div>

      {plan.avoid.length > 0 && (
        <section>
          <SectionHeader
            icon={<Ban className="size-5" />}
            title="Skip these"
            info="Names that look like obvious comps but are too crowded or too broad. Ads against them burn budget for a new author."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.avoid.map((a) => (
              <div key={a.name} className="flex gap-3 rounded-xl border border-line bg-card p-4">
                <Ban className="mt-0.5 size-4 shrink-0 text-bad" />
                <div>
                  <p className="text-[14px] font-medium">{a.name}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{a.why}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {plan.notes && (
        <p className="flex gap-2.5 rounded-xl border border-line bg-sunk px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-ink-3" /> {plan.notes}
        </p>
      )}

      <details className="group rounded-2xl border border-line bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-[14px] font-medium">
          <TerminalSquare className="size-4 text-ink-3" />
          Every Qloo call the agent made ({trace.length})
          <span className="ml-auto text-[12.5px] font-normal text-ink-3 group-open:hidden">Show</span>
          <span className="ml-auto hidden text-[12.5px] font-normal text-ink-3 group-open:inline">Hide</span>
        </summary>
        <ol className="space-y-1.5 border-t border-line px-5 py-4 font-mono text-[11.5px]">
          {trace.map((t, i) => (
            <li key={i} className={t.error ? "text-bad" : "text-ink-2"}>
              <span className="text-ink-3">{String(i + 1).padStart(2, "0")}</span> {t.tool} {JSON.stringify(t.input)} →{" "}
              {t.error ?? `${t.count} results`} · {t.ms}ms
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function Stat({ label, value, tip }: { label: string; value: number | string; tip: string }) {
  return (
    <Tip content={tip} className="w-full">
      <span className="block w-full cursor-help rounded-xl border border-line bg-card px-4 py-3">
        <span className="block font-serif text-[26px] font-medium tabular-nums leading-none">{value}</span>
        <span className="mt-1.5 block text-[12px] text-ink-3">{label}</span>
      </span>
    </Tip>
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function QlooVsLlm({ result, byName }: { result: PlanResult; byName: Map<string, Candidate> }) {
  const { baseline, plan } = result;
  if (baseline.length === 0) return null;
  const qloo = plan.comp_titles.map((c) => byName.get(norm(c.title))).filter((c): c is Candidate => Boolean(c));
  const llmPop = avg(baseline.flatMap((g) => (g.popularity == null ? [] : [g.popularity])));
  const qlooPop = avg(qloo.map((c) => c.popularity));
  const qlooAff = avg(qloo.map((c) => c.affinity));
  const scored = new Set(result.candidates.map((c) => norm(c.name)));
  const overlap = baseline.filter((g) => scored.has(norm(g.title))).length;
  const missing = baseline.filter((g) => !g.inQloo).length;

  return (
    <section>
      <SectionHeader
        icon={<Brain className="size-5" />}
        kicker="Why Qloo matters"
        title="LLM alone vs. Comps with Qloo"
        info="Both columns answer the same question for the same book. The left is a plain LLM answering from memory. The right is the Comps agent reading Qloo's taste graph."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border-rival/30 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-rival">
              <Brain className="size-4" /> LLM alone
            </p>
            {llmPop != null && (
              <Tip content={`Average Qloo popularity of the LLM's suggestions. ${POPULARITY_TIP}`} align="end">
                <Badge tone="rival">avg popularity {llmPop.toFixed(2)}</Badge>
              </Tip>
            )}
          </div>
          <ul className="space-y-2">
            {baseline.map((g) => (
              <li key={g.title} className="flex items-baseline justify-between gap-3 text-[14px]">
                <span>
                  {g.title}
                  {g.author && <span className="text-ink-3"> · {g.author}</span>}
                </span>
                {g.popularity != null ? (
                  <span className="font-mono text-[12px] text-ink-3">{g.popularity.toFixed(2)}</span>
                ) : (
                  <Tip content="Qloo could not find this title, so there is no evidence real readers connect it to your book." align="end">
                    <Badge tone="warn">not in Qloo</Badge>
                  </Tip>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">From memory. No reader data, so no affinity score and no way to tell crowded names from good ones.</p>
        </Card>

        <Card className="border-accent/40 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-accent-ink">
              <Target className="size-4" /> Comps with Qloo
            </p>
            <span className="flex gap-1.5">
              {qlooAff != null && (
                <Tip content={`Average affinity of the chosen comps. ${AFFINITY_TIP}`} align="end">
                  <Badge tone="accent">avg affinity {qlooAff.toFixed(2)}</Badge>
                </Tip>
              )}
              {qlooPop != null && (
                <Tip content={`Average popularity of the chosen comps. ${POPULARITY_TIP}`} align="end">
                  <Badge>avg popularity {qlooPop.toFixed(2)}</Badge>
                </Tip>
              )}
            </span>
          </div>
          <ul className="space-y-2">
            {plan.comp_titles.map((c) => {
              const hit = byName.get(norm(c.title));
              return (
                <li key={c.title} className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span>
                    {c.title}
                    {c.author && <span className="text-ink-3"> · {c.author}</span>}
                  </span>
                  {hit && <span className="font-mono text-[12px] text-ink-3">{hit.affinity.toFixed(2)}</span>}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">From Qloo&apos;s taste graph: every pick has a measured reader overlap with your book&apos;s signals.</p>
        </Card>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        <span>
          <strong className="font-semibold">{overlap}</strong> of {baseline.length} LLM guesses showed up among the {result.candidates.length} books and authors Qloo scored.
        </span>
        {missing > 0 && (
          <span>
            <strong className="font-semibold">{missing}</strong> could not be found in Qloo at all.
          </span>
        )}
        {llmPop != null && qlooPop != null && (
          <span>
            Qloo picks are{" "}
            <strong className="font-semibold">{qlooPop < llmPop ? `${Math.round((1 - qlooPop / llmPop) * 100)}% less mainstream` : "similarly mainstream"}</strong>{" "}
            on average.
          </span>
        )}
      </p>
    </section>
  );
}

const KIND_TIP: Record<Plan["ad_targets"][number]["kind"], string> = {
  title: "Product targeting: show your ad on this book's Amazon page. Search the title in the Amazon Ads console and add its ASIN.",
  author: "Author keyword: bid on searches for this author's name.",
  keyword: "Keyword targeting: bid on shoppers searching this phrase.",
};
const PRIORITY_TONE: Record<string, Tone> = { high: "good", medium: "accent", low: "neutral" };

function AdTargets({ plan }: { plan: Plan }) {
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const rows = plan.ad_targets.filter((t) => filter === "all" || t.priority === filter);
  const count = (p: string) => plan.ad_targets.filter((t) => t.priority === p).length;

  return (
    <section>
      <SectionHeader
        icon={<Target className="size-5" />}
        title="Amazon Ads targets"
        info="Where to show your book's ads on Amazon: on other books' pages (title), when shoppers search an author's name (author), or a phrase (keyword). Picked for reader overlap with less competition, so clicks cost less."
        action={
          <div className="flex gap-2">
            <CopyButton text={rows.map((t) => t.target).join("\n")} label="Copy targets" />
            <button
              onClick={() => downloadCsv(plan)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-[12.5px] font-medium text-paper outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Download className="size-3.5" /> CSV
            </button>
          </div>
        }
      />
      <ol className="mb-4 grid gap-2 sm:grid-cols-4">
        {[
          ["Export", "Click CSV or Copy targets."],
          ["Create a campaign", "In Amazon Ads, start a Sponsored Products campaign with manual targeting."],
          ["Add the high ones", "Paste the high-priority targets and set a small daily budget, e.g. $5."],
          ["Keep what sells", "After a week, keep targets that convert and add the medium ones."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-2.5 rounded-xl border border-line bg-card p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent-ink">{i + 1}</span>
            <span>
              <span className="block text-[13px] font-semibold">{t}</span>
              <span className="block text-[12.5px] leading-snug text-ink-3">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by priority">
        {(["all", "high", "medium", "low"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            aria-pressed={filter === p}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              filter === p ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-line-strong"
            }`}
          >
            {p} {p === "all" ? plan.ad_targets.length : count(p)}
          </button>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13.5px]">
          <thead className="border-b border-line text-[12px] text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-medium">Target</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.target + t.kind} className="border-t border-line align-top first:border-t-0 hover:bg-sunk/50">
                <td className="px-4 py-3 font-medium">{t.target}</td>
                <td className="px-4 py-3">
                  <Tip content={KIND_TIP[t.kind]}>
                    <Badge className="cursor-help capitalize">{t.kind}</Badge>
                  </Tip>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={PRIORITY_TONE[t.priority]} className="capitalize">
                    {t.priority}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-ink-2">{t.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

const CHANNEL: Record<string, { icon: LucideIcon; label: string }> = {
  podcast: { icon: Headphones, label: TYPE_LABEL["urn:entity:podcast"].replace(/s$/, "") },
  tv_show: { icon: Tv, label: "TV show" },
  movie: { icon: Film, label: "Film" },
  brand: { icon: ShoppingBag, label: "Brand" },
  other: { icon: ListChecks, label: "Other" },
};

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
