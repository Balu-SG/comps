import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ENTITY_TYPES, hasQlooKey, insights, searchEntities, type EntityType, type QlooResult } from "./qloo";

const client = new Anthropic();
const MODEL = "claude-opus-5-5";
const MAX_TURNS = 10;

export type BookInput = {
  title: string;
  author?: string;
  description: string;
  knownComps: string[];
};

export type TraceStep = { tool: string; input: unknown; ms: number; count: number; sample: boolean; error?: string };

// A book or author Qloo returned, with the two numbers the taste map plots.
export type Candidate = { id: string; name: string; kind: "book" | "author"; affinity: number; popularity: number };

// What Claude guesses from memory alone, checked against Qloo afterwards.
export type BaselineGuess = { title: string; author: string; popularity: number | null; inQloo: boolean };

export type AgentEvent =
  | { type: "call"; id: string; tool: string; input: unknown }
  | { type: "result"; id: string; count: number; ms: number; error?: string; top: string[] }
  | { type: "baseline"; guesses: BaselineGuess[] }
  | { type: "done"; result: PlanResult }
  | { type: "error"; message: string };

export type PlanResult = {
  book: BookInput;
  plan: Plan;
  trace: TraceStep[];
  candidates: Candidate[];
  baseline: BaselineGuess[];
  sample: boolean;
  seconds: number;
};

const Plan = z.object({
  pitch_line: z.string(),
  comp_titles: z.array(
    z.object({ title: z.string(), author: z.string(), why: z.string(), evidence: z.string(), warning: z.string() }),
  ),
  ad_targets: z.array(
    z.object({
      target: z.string(),
      kind: z.enum(["author", "title", "keyword"]),
      priority: z.enum(["high", "medium", "low"]),
      why: z.string(),
    }),
  ),
  outside_amazon: z.array(
    z.object({ channel: z.enum(["podcast", "tv_show", "movie", "brand", "other"]), name: z.string(), idea: z.string() }),
  ),
  regions: z.array(z.object({ place: z.string(), why: z.string() })),
  avoid: z.array(z.object({ name: z.string(), why: z.string() })),
  notes: z.string(),
});
export type Plan = z.infer<typeof Plan>;

const entityType = { type: "string", enum: [...ENTITY_TYPES] } as const;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "qloo_search",
    description:
      "Look up Qloo entity IDs by name. Use it for the author's own book, their known comps, and authors (type urn:entity:person). Insights calls need these IDs.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["query", "type"],
      properties: { query: { type: "string" }, type: entityType },
    },
  },
  {
    name: "qloo_insights",
    description:
      "Ask Qloo's taste graph what people who like the signal entities also like, within one entity type. Books and authors give comp titles; podcasts, tv_show, movie and brand give reader channels outside Amazon; destination gives places where these readers over-index. Destination only accepts author (urn:entity:person), tv_show, movie or podcast IDs as signals, never book IDs. Results carry affinity (fit) and popularity (how mainstream; very high popularity means expensive, crowded ad targets).",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["filter_type", "signal_entity_ids", "take"],
      properties: {
        filter_type: entityType,
        signal_entity_ids: { type: "array", items: { type: "string" } },
        take: { type: "integer" },
      },
    },
  },
  {
    name: "submit_plan",
    description: "Submit the finished targeting plan. Call this exactly once, at the end.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["pitch_line", "comp_titles", "ad_targets", "outside_amazon", "regions", "avoid", "notes"],
      properties: {
        pitch_line: { type: "string", description: "A 'for fans of X meets Y' line built from real Qloo overlap." },
        comp_titles: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "author", "why", "evidence", "warning"],
            properties: {
              title: { type: "string", description: "Exactly as Qloo named it." },
              author: { type: "string", description: "Empty string if Qloo did not give one." },
              why: { type: "string" },
              evidence: { type: "string", description: "The Qloo numbers behind the pick, e.g. affinity 0.88, popularity 0.37." },
              warning: { type: "string", description: "Empty string if none." },
            },
          },
        },
        ad_targets: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["target", "kind", "priority", "why"],
            properties: {
              target: { type: "string" },
              kind: { type: "string", enum: ["author", "title", "keyword"] },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              why: { type: "string" },
            },
          },
        },
        outside_amazon: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["channel", "name", "idea"],
            properties: {
              channel: { type: "string", enum: ["podcast", "tv_show", "movie", "brand", "other"] },
              name: { type: "string" },
              idea: { type: "string" },
            },
          },
        },
        regions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["place", "why"],
            properties: { place: { type: "string" }, why: { type: "string" } },
          },
        },
        avoid: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "why"],
            properties: { name: { type: "string" }, why: { type: "string" } },
          },
        },
        notes: { type: "string" },
      },
    },
  },
];

const SYSTEM = `You help self-published authors find their real readers and spend their Amazon Ads budget well.

Work from Qloo's taste graph, not from your own memory of famous books. Work in three rounds and make every call within a round in parallel:
1. qloo_search for the author's book, each known comp, and the authors of those comps (urn:entity:person).
2. qloo_insights with those IDs for books, authors (person), podcasts, tv_show, movie and brand.
3. qloo_insights for destination, using author or TV show IDs as signals (Qloo rejects book IDs there). Then call submit_plan.

Every comp title, ad target, channel and region you submit must come from a Qloo result in this conversation; cite its affinity and popularity in the evidence, and copy comp titles exactly as Qloo names them. Prefer strong affinity with moderate popularity: very popular names are crowded, expensive ad targets for a new author, so list them under avoid with the reason. If the author's own book is not in Qloo, use their known comps as the signal and say so in notes. If a result is marked sample, say in notes that the plan uses sample data.

Aim for 5 to 8 comp titles, 10 to 20 ad targets, 3 to 6 outside-Amazon ideas and 3 to 5 regions. Keep each "why" to one sentence.`;

const DESTINATION_SIGNALS = new Set<EntityType>(["urn:entity:person", "urn:entity:tv_show", "urn:entity:movie", "urn:entity:podcast"]);

export async function runPlan(book: BookInput, emit: (e: AgentEvent) => void): Promise<PlanResult> {
  const started = Date.now();
  const trace: TraceStep[] = [];
  const idType = new Map<string, EntityType>();
  const candidates = new Map<string, Candidate>();

  function remember(type: EntityType, result: QlooResult) {
    for (const e of result.entities) {
      if (!e.id) continue;
      idType.set(e.id, type);
      const kind = type === "urn:entity:book" ? "book" : type === "urn:entity:person" ? "author" : null;
      if (!kind || e.affinity == null || e.popularity == null) continue;
      const prev = candidates.get(e.id);
      if (!prev || prev.affinity < e.affinity) {
        candidates.set(e.id, { id: e.id, name: e.name, kind, affinity: e.affinity, popularity: e.popularity });
      }
    }
  }

  async function runTool(name: string, input: unknown): Promise<QlooResult> {
    if (name === "qloo_search") {
      const i = z.object({ query: z.string(), type: z.enum(ENTITY_TYPES) }).parse(input);
      const r = await searchEntities(i.query, i.type);
      remember(i.type, r);
      return r;
    }
    if (name === "qloo_insights") {
      const i = z
        .object({ filter_type: z.enum(ENTITY_TYPES), signal_entity_ids: z.array(z.string()).min(1), take: z.number().int() })
        .parse(input);
      let ids = i.signal_entity_ids;
      if (i.filter_type === "urn:entity:destination") {
        ids = ids.filter((id) => !idType.has(id) || DESTINATION_SIGNALS.has(idType.get(id)!));
        if (ids.length === 0) {
          throw new Error("Destination needs author (urn:entity:person), tv_show, movie or podcast IDs as signals, not book IDs.");
        }
      }
      const r = await insights({ filterType: i.filter_type, signalEntityIds: ids, take: Math.min(Math.max(i.take, 1), 20) });
      remember(i.filter_type, r);
      return r;
    }
    throw new Error(`Unknown tool ${name}`);
  }

  const baselinePromise = guessWithoutQloo(book)
    .then((guesses) => {
      emit({ type: "baseline", guesses });
      return guesses;
    })
    .catch((err) => {
      console.error("[comps] baseline failed", err);
      return [] as BaselineGuess[];
    });

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Book title: ${book.title}
Author: ${book.author || "(not given)"}
Description: ${book.description}
Books the author thinks are similar: ${book.knownComps.length ? book.knownComps.join("; ") : "(none given)"}`,
    },
  ];

  const usage = { input: 0, output: 0, cacheRead: 0 };
  const logUsage = (turns: number) => {
    const usd = (usage.input * 4 + usage.cacheRead * 0.2 + usage.output * 20) / 1e6;
    console.log(`[comps] ${turns} turns, in ${usage.input} (+${usage.cacheRead} cached), out ${usage.output}, ~$${usd.toFixed(3)}, ${Math.round((Date.now() - started) / 1000)}s`);
  };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      tools,
      messages,
    });

    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;
    usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
    if (response.stop_reason === "refusal") throw new Error("The model declined this request.");
    messages.push({ role: "assistant", content: response.content });

    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const submit = calls.find((c) => c.name === "submit_plan");
    if (submit) {
      logUsage(turn + 1);
      const result: PlanResult = {
        book,
        plan: Plan.parse(submit.input),
        trace,
        candidates: [...candidates.values()],
        baseline: await baselinePromise,
        sample: !hasQlooKey(),
        seconds: Math.round((Date.now() - started) / 1000),
      };
      emit({ type: "done", result });
      return result;
    }
    if (calls.length === 0) {
      messages.push({ role: "user", content: "Please finish by calling submit_plan with the plan." });
      continue;
    }

    const results = await Promise.all(
      calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const t0 = Date.now();
        emit({ type: "call", id: call.id, tool: call.name, input: call.input });
        try {
          const result = await runTool(call.name, call.input);
          const ms = Date.now() - t0;
          trace.push({ tool: call.name, input: call.input, ms, count: result.entities.length, sample: result.sample });
          emit({ type: "result", id: call.id, count: result.entities.length, ms, top: result.entities.slice(0, 3).map((e) => e.name) });
          return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify({ sample: result.sample, entities: result.entities }) };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const ms = Date.now() - t0;
          trace.push({ tool: call.name, input: call.input, ms, count: 0, sample: false, error: message });
          emit({ type: "result", id: call.id, count: 0, ms, error: message, top: [] });
          return { type: "tool_result", tool_use_id: call.id, content: message, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  throw new Error("The agent did not finish in time. Try again with a shorter description.");
}

const Guesses = z.object({ guesses: z.array(z.object({ title: z.string(), author: z.string() })) });

// The control group: what an LLM suggests with no taste data. Shown next to the Qloo picks.
async function guessWithoutQloo(book: BookInput): Promise<BaselineGuess[]> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Guesses) },
    messages: [
      {
        role: "user",
        content: `Suggest 6 comparable titles (comps) a self-published author could use for this book in Amazon Ads. Answer from your own knowledge.

Title: ${book.title}
Description: ${book.description}
Books the author thinks are similar: ${book.knownComps.join("; ") || "(none)"}`,
      },
    ],
  });
  const guesses = response.parsed_output?.guesses.slice(0, 6) ?? [];
  return Promise.all(
    guesses.map(async (g) => {
      const hit = (await searchEntities(`${g.title} ${g.author}`.trim(), "urn:entity:book", 1)).entities[0];
      return { title: g.title, author: g.author, popularity: hit?.popularity ?? null, inQloo: Boolean(hit) };
    }),
  );
}
