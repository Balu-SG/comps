"use client";

import { Check, Copy, Info } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

// Hover/focus tooltip. Content stays in the DOM so screen readers get it via aria-describedby.
export function Tip({
  content,
  children,
  align = "center",
  side = "top",
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  align?: "center" | "start" | "end";
  side?: "top" | "bottom";
  className?: string;
}) {
  const id = useId();
  const x = align === "center" ? "left-1/2 -translate-x-1/2" : align === "start" ? "left-0" : "right-0";
  const y = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  return (
    <span className={`group/tip relative inline-flex ${className}`} aria-describedby={id}>
      {children}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute ${x} ${y} z-50 hidden w-max max-w-[min(17rem,80vw)] rounded-lg bg-ink px-3 py-2 text-left text-[12.5px] font-normal leading-snug normal-case tracking-normal text-paper shadow-lg group-hover/tip:block group-focus-within/tip:block`}
      >
        {content}
      </span>
    </span>
  );
}

export function InfoTip({ children, align }: { children: ReactNode; align?: "center" | "start" | "end" }) {
  return (
    <Tip content={children} align={align}>
      <button
        type="button"
        aria-label="More information"
        className="inline-flex size-5 items-center justify-center rounded-full text-ink-3 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Info className="size-3.5" />
      </button>
    </Tip>
  );
}

const TONES = {
  neutral: "bg-sunk text-ink-2 border-line",
  accent: "bg-accent-soft text-accent-ink border-transparent",
  rival: "bg-rival-soft text-rival border-transparent",
  good: "bg-good-soft text-good border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

// A labelled 0-1 bar, e.g. Qloo affinity or popularity.
export function Meter({ label, value, tip, tone = "accent" }: { label: string; value: number; tip: ReactNode; tone?: "accent" | "muted" }) {
  return (
    <Tip content={tip} className="w-full">
      <span className="block w-full cursor-help">
        <span className="flex items-baseline justify-between text-[11.5px] text-ink-3">
          <span>{label}</span>
          <span className="font-mono tabular-nums text-ink-2">{value.toFixed(2)}</span>
        </span>
        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-sunk">
          <span
            className={`block h-full rounded-full ${tone === "accent" ? "bg-accent" : "bg-ink-3"}`}
            style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
          />
        </span>
      </span>
    </Tip>
  );
}

export function SectionHeader({
  icon,
  title,
  info,
  kicker,
  action,
}: {
  icon: ReactNode;
  title: string;
  info?: ReactNode;
  kicker?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{kicker}</p>}
        <h2 className="flex items-center gap-2 font-serif text-[22px] font-medium tracking-tight">
          <span className="text-ink-3">{icon}</span>
          {title}
          {info && <InfoTip>{info}</InfoTip>}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 outline-none hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
    >
      {done ? <Check className="size-3.5 text-good" /> : <Copy className="size-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}
