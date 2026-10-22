// Qloo Taste AI client. Hackathon keys only work against this base URL.
// Without QLOO_API_KEY every call returns sample data from ./sample, flagged `sample: true`.
import { sampleInsights, sampleSearch } from "./sample";

const BASE_URL = "https://hackathon.api.qloo.com";

export type QlooEntity = {
  id: string;
  name: string;
  type?: string;
  affinity?: number;
  popularity?: number;
  detail?: string;
};

export type QlooResult = { sample: boolean; entities: QlooEntity[]; raw?: unknown };

export const ENTITY_TYPES = [
  "urn:entity:book",
  "urn:entity:person",
  "urn:entity:podcast",
  "urn:entity:tv_show",
  "urn:entity:movie",
  "urn:entity:artist",
  "urn:entity:brand",
  "urn:entity:destination",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

const cache = new Map<string, { at: number; value: QlooResult }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

async function get(path: string, params: Record<string, string>): Promise<unknown> {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { "X-Api-Key": process.env.QLOO_API_KEY! } });
  if (!res.ok) throw new Error(`Qloo ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function cached(key: string, load: () => Promise<QlooResult>): Promise<QlooResult> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Verified 2026-10-22: /search returns results[] with `types[]`; /v2/insights returns results.entities[] with
// `subtype`/`type` and query.affinity.
function toEntities(json: unknown): QlooEntity[] {
  const j = json as { results?: { entities?: unknown[] } | unknown[] };
  const list = (Array.isArray(j.results) ? j.results : j.results?.entities) ?? [];
  return (list as Record<string, unknown>[]).map((e) => {
    const query = e.query as { affinity?: number } | undefined;
    const props = e.properties as { short_description?: string; description?: string } | undefined;
    return {
      id: String(e.entity_id ?? e.id ?? ""),
      name: String(e.name ?? ""),
      type: e.subtype ? String(e.subtype) : e.type ? String(e.type) : (e.types as string[] | undefined)?.[0],
      affinity: query?.affinity ?? (e.affinity as number | undefined),
      popularity: e.popularity as number | undefined,
      detail: props?.short_description ?? props?.description?.slice(0, 160),
    };
  });
}

export const hasQlooKey = () => Boolean(process.env.QLOO_API_KEY);

export async function searchEntities(query: string, type: EntityType, take = 5): Promise<QlooResult> {
  if (!hasQlooKey()) return { sample: true, entities: sampleSearch(query, type).slice(0, take) };
  return cached(`search|${type}|${query}|${take}`, async () => {
    const raw = await get("/search", { query, types: type, take: String(take) });
    return { sample: false, entities: toEntities(raw) };
  });
}

export type InsightsArgs = {
  filterType: EntityType;
  signalEntityIds: string[];
  locationQuery?: string;
  take: number;
};

export async function insights(args: InsightsArgs): Promise<QlooResult> {
  if (!hasQlooKey()) return { sample: true, entities: sampleInsights(args.filterType).slice(0, args.take) };
  const params: Record<string, string> = {
    "filter.type": args.filterType,
    "signal.interests.entities": args.signalEntityIds.join(","),
    "feature.explainability": "true",
    take: String(args.take),
  };
  if (args.locationQuery) params["signal.location.query"] = args.locationQuery;
  return cached(`insights|${JSON.stringify(params)}`, async () => {
    const raw = await get("/v2/insights", params);
    return { sample: false, entities: toEntities(raw), raw };
  });
}
