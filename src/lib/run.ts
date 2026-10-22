// Client-side view of a run: folds the AgentEvent stream into feed items the page can render.
import type { AgentEvent, BaselineGuess, PlanResult } from "./agent";

export type FeedItem = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  status: "running" | "done" | "error";
  count?: number;
  ms?: number;
  top?: string[];
  error?: string;
};

export type RunState = {
  feed: FeedItem[];
  baseline: BaselineGuess[] | null;
  result: PlanResult | null;
  error: string | null;
};

export const emptyRun: RunState = { feed: [], baseline: null, result: null, error: null };

export function reduce(state: RunState, e: AgentEvent): RunState {
  switch (e.type) {
    case "call":
      return { ...state, feed: [...state.feed, { id: e.id, tool: e.tool, input: e.input as Record<string, unknown>, status: "running" }] };
    case "result":
      return {
        ...state,
        feed: state.feed.map((f) =>
          f.id === e.id ? { ...f, status: e.error ? "error" : "done", count: e.count, ms: e.ms, top: e.top, error: e.error } : f,
        ),
      };
    case "baseline":
      return { ...state, baseline: e.guesses };
    case "done":
      return { ...state, result: e.result, baseline: e.result.baseline };
    case "error":
      return { ...state, error: e.message };
  }
}

export const TYPE_LABEL: Record<string, string> = {
  "urn:entity:book": "books",
  "urn:entity:person": "authors",
  "urn:entity:podcast": "podcasts",
  "urn:entity:tv_show": "TV shows",
  "urn:entity:movie": "films",
  "urn:entity:artist": "music",
  "urn:entity:brand": "brands",
  "urn:entity:destination": "places",
};

const SINGULAR: Record<string, string> = {
  "urn:entity:book": "book",
  "urn:entity:person": "author",
  "urn:entity:podcast": "podcast",
  "urn:entity:tv_show": "TV show",
  "urn:entity:movie": "film",
  "urn:entity:artist": "artist",
  "urn:entity:brand": "brand",
  "urn:entity:destination": "place",
};

export type Phase = "resolve" | "books" | "channels" | "places";

export function phaseOf(item: Pick<FeedItem, "tool" | "input">): Phase {
  if (item.tool === "qloo_search") return "resolve";
  const t = String(item.input.filter_type ?? "");
  if (t === "urn:entity:destination") return "places";
  if (t === "urn:entity:book" || t === "urn:entity:person") return "books";
  return "channels";
}

export const PHASES: { key: Phase; label: string; tip: string }[] = [
  { key: "resolve", label: "Resolve", tip: "Find your book, your comps and their authors in Qloo, so the agent works from real catalogue IDs." },
  { key: "books", label: "Readers' books", tip: "Ask Qloo which books and authors the same readers love, with an affinity score for each." },
  { key: "channels", label: "Readers' world", tip: "Ask which podcasts, shows, films and brands those readers over-index on: places to reach them outside Amazon." },
  { key: "places", label: "Where they live", tip: "Ask which places these readers cluster in, for regional ads and events." },
];

export function describe(item: Pick<FeedItem, "tool" | "input">): { title: string; detail: string } {
  if (item.tool === "qloo_search") {
    return {
      title: `Find “${String(item.input.query ?? "")}”`,
      detail: `Search Qloo's catalogue for this ${SINGULAR[String(item.input.type)] ?? "entity"}`,
    };
  }
  const n = Array.isArray(item.input.signal_entity_ids) ? item.input.signal_entity_ids.length : 0;
  const what = TYPE_LABEL[String(item.input.filter_type)] ?? "results";
  return {
    title: `Readers' taste in ${what}`,
    detail: `Taste graph query from ${n} signal${n === 1 ? "" : "s"}`,
  };
}

// Recorded runs live in /public/examples as {t, e} lines; t is ms since the run started.
export type RecordedLine = { t: number; e: AgentEvent };

export const EXAMPLES = [
  { slug: "cozy-mystery", genre: "Cozy mystery", title: "The Lighthouse Ledger" },
  { slug: "space-survival", genre: "Space survival", title: "The Last Signal from Kepler" },
  { slug: "family-secrets", genre: "Family secrets", title: "The Orchard Keeper's Daughter" },
] as const;
