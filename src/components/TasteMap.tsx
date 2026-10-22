"use client";

import { useMemo, useState } from "react";
import type { BaselineGuess, Candidate, Plan } from "@/lib/agent";

const W = 760;
const H = 440;
const M = { top: 24, right: 24, bottom: 86, left: 52 };
const RUG_Y = H - 30;

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Status = "pick" | "avoid" | "other";
type Point = Candidate & { status: Status; llm: boolean };
type Hover = { x: number; y: number; title: string; lines: string[]; note: string };

export function classify(candidates: Candidate[], plan: Plan, baseline: BaselineGuess[]): Point[] {
  const picks = new Set(plan.comp_titles.map((c) => norm(c.title)));
  const avoid = new Set(plan.avoid.flatMap((a) => a.name.split(/\s*[/,;]\s*/)).map(norm));
  const llm = new Set(baseline.map((g) => norm(g.title)));
  return candidates.map((c) => {
    const n = norm(c.name);
    const status: Status = picks.has(n) ? "pick" : avoid.has(n) ? "avoid" : "other";
    return { ...c, status, llm: llm.has(n) };
  });
}

function niceDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const lo = Math.floor((Math.min(...values) - 0.02) * 20) / 20;
  const hi = Math.min(1, Math.ceil((Math.max(...values) + 0.01) * 20) / 20);
  return [Math.max(0, lo), hi <= lo ? lo + 0.1 : hi];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0.5;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function TasteMap({ candidates, plan, baseline }: { candidates: Candidate[]; plan: Plan; baseline: BaselineGuess[] }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [view, setView] = useState<"map" | "table">("map");
  const points = useMemo(() => classify(candidates, plan, baseline), [candidates, plan, baseline]);
  const rug = baseline.filter((g) => g.popularity != null);

  const xDom = niceDomain([...points.map((p) => p.popularity), ...rug.map((g) => g.popularity!)]);
  const yDom = niceDomain(points.map((p) => p.affinity));
  const x = (v: number) => M.left + ((v - xDom[0]) / (xDom[1] - xDom[0])) * (W - M.left - M.right);
  const y = (v: number) => H - M.bottom - ((v - yDom[0]) / (yDom[1] - yDom[0])) * (H - M.top - M.bottom);
  const midX = median(points.map((p) => p.popularity));
  const midY = median(points.map((p) => p.affinity));
  const xTicks = ticks(xDom);
  const yTicks = ticks(yDom);

  const order: Record<Status, number> = { other: 0, avoid: 1, pick: 2 };
  const sorted = [...points].sort((a, b) => order[a.status] - order[b.status]);
  const labels = placeLabels(points.filter((p) => p.status === "pick").map((p) => ({ id: p.id, cx: x(p.popularity), cy: y(p.affinity), text: short(p.name) })));

  const describe = (p: Point): Hover => ({
    x: x(p.popularity),
    y: y(p.affinity),
    title: p.name,
    lines: [`${p.kind === "book" ? "Book" : "Author"} · affinity ${p.affinity.toFixed(2)} · popularity ${p.popularity.toFixed(2)}`],
    note:
      p.status === "pick"
        ? "Chosen as a comp: strong reader overlap without being the most crowded name."
        : p.status === "avoid"
          ? "Flagged to skip: too mainstream, so ads against it are crowded and costly."
          : p.affinity >= midY && p.popularity <= midX
            ? "In the sweet spot. Worth a look as an extra ad target."
            : "Considered by the agent, not chosen.",
  });

  if (points.length === 0) {
    return <p className="text-sm text-ink-3">No scored books or authors came back from Qloo for this run.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Legend />
        <div role="tablist" className="inline-flex rounded-lg border border-line bg-sunk p-0.5 text-[12.5px]">
          {(["map", "table"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-accent ${view === v ? "bg-card text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "map" ? (
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full select-none"
            role="img"
            aria-label={`Taste map of ${points.length} books and authors from Qloo, plotted by popularity and affinity.`}
          >
            {/* sweet-spot quadrant: above-median fit, below-median popularity */}
            <rect x={M.left} y={M.top} width={x(midX) - M.left} height={y(midY) - M.top} fill="var(--accent-soft)" rx={8} />
            <text x={M.left + 10} y={M.top + 18} className="fill-accent-ink text-[11px] font-semibold uppercase tracking-[0.12em]">
              Sweet spot
            </text>
            <text x={M.left + 10} y={M.top + 33} className="fill-accent-ink text-[11px]">
              strong fit, less crowded
            </text>
            <text x={W - M.right - 10} y={M.top + 18} textAnchor="end" className="fill-[var(--ink-3)] text-[11px] font-semibold uppercase tracking-[0.12em]">
              Crowded
            </text>
            <text x={W - M.right - 10} y={M.top + 33} textAnchor="end" className="fill-[var(--ink-3)] text-[11px]">
              strong fit, costly ads
            </text>

            {yTicks.map((t) => (
              <g key={`y${t}`}>
                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" />
                <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--ink-3)] font-mono text-[10.5px]">
                  {t.toFixed(2)}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={`x${t}`} x={x(t)} y={H - M.bottom + 18} textAnchor="middle" className="fill-[var(--ink-3)] font-mono text-[10.5px]">
                {t.toFixed(2)}
              </text>
            ))}
            <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--line-strong)" />
            <line x1={x(midX)} x2={x(midX)} y1={M.top} y2={H - M.bottom} stroke="var(--line-strong)" strokeDasharray="4 4" />
            <line x1={M.left} x2={W - M.right} y1={y(midY)} y2={y(midY)} stroke="var(--line-strong)" strokeDasharray="4 4" />

            <text x={(M.left + W - M.right) / 2} y={H - M.bottom + 38} textAnchor="middle" className="fill-[var(--ink-2)] text-[11.5px] font-medium">
              Popularity → how mainstream (and how crowded for ads)
            </text>
            <text
              transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-[var(--ink-2)] text-[11.5px] font-medium"
            >
              Affinity → how strongly your readers like it
            </text>

            {sorted.map((p) => {
              const cx = x(p.popularity);
              const cy = y(p.affinity);
              const r = p.status === "pick" ? 6.5 : 4.5;
              const fill = p.status === "pick" ? "var(--accent)" : p.kind === "book" ? "var(--dot)" : "var(--card)";
              const stroke = p.status === "pick" ? "var(--card)" : p.status === "avoid" ? "var(--ink-2)" : "var(--dot)";
              return (
                <g key={p.id}>
                  {p.llm && <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="var(--rival)" strokeWidth={2} />}
                  <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={p.status === "avoid" ? 2 : 2} />
                  {p.status === "avoid" && (
                    <line x1={cx - 4} y1={cy + 4} x2={cx + 4} y2={cy - 4} stroke="var(--ink-2)" strokeWidth={1.5} />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={11}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${p.name}: affinity ${p.affinity.toFixed(2)}, popularity ${p.popularity.toFixed(2)}`}
                    onMouseEnter={() => setHover(describe(p))}
                    onFocus={() => setHover(describe(p))}
                    onBlur={() => setHover(null)}
                    className="cursor-pointer outline-none"
                  />
                </g>
              );
            })}

            {labels.map((l) => (
              <g key={`l${l.id}`} className="pointer-events-none">
                {Math.abs(l.ly - l.cy) > 3 && (
                  <line x1={l.cx} y1={l.cy} x2={l.anchor === "start" ? l.lx - 3 : l.lx + 3} y2={l.ly - 4} stroke="var(--line-strong)" strokeWidth={1} />
                )}
                <text
                  x={l.lx}
                  y={l.ly}
                  textAnchor={l.anchor}
                  className="fill-[var(--ink)] text-[11px] font-medium"
                  style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 3 }}
                >
                  {l.text}
                </text>
              </g>
            ))}

            {/* LLM-only guesses have no affinity, so they sit on a popularity rug under the axis */}
            {rug.length > 0 && (
              <>
                <text x={M.left - 8} y={RUG_Y + 4} textAnchor="end" className="fill-rival text-[10.5px] font-semibold">
                  LLM
                </text>
                <line x1={M.left} x2={W - M.right} y1={RUG_Y} y2={RUG_Y} stroke="var(--line)" />
                {rug.map((g, i) => {
                  const cx = x(g.popularity!);
                  const h: Hover = {
                    x: cx,
                    y: RUG_Y,
                    title: g.title,
                    lines: [`${g.author || "Unknown author"} · popularity ${g.popularity!.toFixed(2)}`],
                    note: "Suggested by an LLM with no taste data. No affinity score: the model never checked who actually reads it.",
                  };
                  return (
                    <g key={`rug${i}`}>
                      <path d={`M${cx} ${RUG_Y - 7} L${cx + 6} ${RUG_Y + 4} L${cx - 6} ${RUG_Y + 4} Z`} fill="var(--rival)" stroke="var(--card)" strokeWidth={1.5} />
                      <circle
                        cx={cx}
                        cy={RUG_Y}
                        r={11}
                        fill="transparent"
                        tabIndex={0}
                        aria-label={`LLM guess ${g.title}, popularity ${g.popularity!.toFixed(2)}`}
                        onMouseEnter={() => setHover(h)}
                        onFocus={() => setHover(h)}
                        onBlur={() => setHover(null)}
                        className="cursor-pointer outline-none"
                      />
                    </g>
                  );
                })}
              </>
            )}
          </svg>

          {hover && (
            <div
              className="pointer-events-none absolute z-20 w-64 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-3 py-2 text-[12.5px] leading-snug text-paper shadow-lg"
              style={{ left: `${(hover.x / W) * 100}%`, top: `calc(${(hover.y / H) * 100}% - 14px)` }}
            >
              <p className="font-semibold">{hover.title}</p>
              {hover.lines.map((l) => (
                <p key={l} className="mt-0.5 font-mono text-[11px] opacity-80">
                  {l}
                </p>
              ))}
              <p className="mt-1.5 opacity-90">{hover.note}</p>
            </div>
          )}
        </div>
      ) : (
        <MapTable points={points} />
      )}
    </div>
  );
}

function Legend() {
  const item = "inline-flex items-center gap-1.5";
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-2">
      <li className={item}>
        <svg width="14" height="14" aria-hidden>
          <circle cx="7" cy="7" r="5.5" fill="var(--accent)" />
        </svg>
        Chosen comp
      </li>
      <li className={item}>
        <svg width="14" height="14" aria-hidden>
          <circle cx="7" cy="7" r="4" fill="var(--dot)" />
        </svg>
        Other book
      </li>
      <li className={item}>
        <svg width="14" height="14" aria-hidden>
          <circle cx="7" cy="7" r="4" fill="var(--card)" stroke="var(--dot)" strokeWidth="2" />
        </svg>
        Author
      </li>
      <li className={item}>
        <svg width="14" height="14" aria-hidden>
          <circle cx="7" cy="7" r="4" fill="var(--dot)" stroke="var(--ink-2)" strokeWidth="2" />
          <line x1="4" y1="10" x2="10" y2="4" stroke="var(--ink-2)" strokeWidth="1.5" />
        </svg>
        Crowded, skip
      </li>
      <li className={item}>
        <svg width="14" height="14" aria-hidden>
          <path d="M7 1 L13 12 L1 12 Z" fill="var(--rival)" />
        </svg>
        LLM-only guess
      </li>
    </ul>
  );
}

function MapTable({ points }: { points: Point[] }) {
  const rows = [...points].sort((a, b) => b.affinity - a.affinity);
  const label: Record<Status, string> = { pick: "Chosen comp", avoid: "Skip (crowded)", other: "Considered" };
  return (
    <div className="max-h-96 overflow-auto rounded-xl border border-line">
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-sunk text-ink-3">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">Affinity</th>
            <th className="px-3 py-2 text-right font-medium">Popularity</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-3 py-2 font-medium">{p.name}</td>
              <td className="px-3 py-2 text-ink-2">{p.kind}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{p.affinity.toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{p.popularity.toFixed(2)}</td>
              <td className="px-3 py-2 text-ink-2">{label[p.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ticks([lo, hi]: [number, number]): number[] {
  const step = hi - lo > 0.4 ? 0.1 : 0.05;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

type Label = { id: string; cx: number; cy: number; text: string; lx: number; ly: number; anchor: "start" | "end" };

// Greedy label placement: put each label beside its dot, then step it up or down until it clears the labels already placed.
function placeLabels(items: { id: string; cx: number; cy: number; text: string }[]): Label[] {
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const out: Label[] = [];
  const LINE = 14;
  for (const it of [...items].sort((a, b) => a.cy - b.cy)) {
    const w = it.text.length * 6.1;
    const anchor = it.cx + 10 + w > W - M.right ? "end" : "start";
    const lx = anchor === "start" ? it.cx + 10 : it.cx - 10;
    const x0 = anchor === "start" ? lx : lx - w;
    let best = it.cy + 4;
    for (const offset of [0, LINE, -LINE, 2 * LINE, -2 * LINE, 3 * LINE, -3 * LINE, 4 * LINE]) {
      const ly = it.cy + 4 + offset;
      const box = { x0, x1: x0 + w, y0: ly - 11, y1: ly + 3 };
      if (!placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) {
        best = ly;
        break;
      }
    }
    placed.push({ x0, x1: x0 + w, y0: best - 11, y1: best + 3 });
    out.push({ ...it, lx, ly: best, anchor });
  }
  return out;
}

function short(name: string) {
  const s = name.replace(/\s*\(.*?\)\s*/g, "").trim();
  return s.length > 26 ? s.slice(0, 25) + "…" : s;
}
