import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ENTITY_TYPES, hasQlooKey, insights, searchEntities, type QlooResult } from "./qloo";

const client = new Anthropic();
const MODEL = "claude-opus-5-5";
const MAX_TURNS = 14;

export type BookInput = {
  title: string;
  author?: string;
  description: string;
  knownComps: string[];
};

export type TraceStep = { tool: string; input: unknown; ms: number; count: number; sample: boolean; error?: string };

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
      "Ask Qloo's taste graph what people who like the signal entities also like, within one entity type. Books and authors give comp titles; podcasts, tv_show, movie and brand give reader channels outside Amazon; destination gives places where these readers over-index. Results carry affinity (fit) and popularity (how mainstream; very high popularity means expensive, crowded ad targets).",
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
              title: { type: "string" },
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

Work from Qloo's taste graph, not from your own memory of famous books. Start by resolving the author's book and their known comps with qloo_search, then use qloo_insights to find books and authors with real reader overlap, then the podcasts, TV shows, films and brands those readers like, then the destinations where they over-index. Make independent calls in parallel.

Every comp title, ad target, channel and region you submit must come from a Qloo result in this conversation; cite its affinity and popularity in the evidence. Prefer strong affinity with moderate popularity: very popular names are crowded, expensive ad targets for a new author, so list them under avoid with the reason. If the author's own book is not in Qloo, use their known comps as the signal and say so in notes. If a result is marked sample, say in notes that the plan uses sample data.

Aim for 5 to 8 comp titles, 10 to 20 ad targets, 3 to 6 outside-Amazon ideas and 3 to 5 regions. Finish by calling submit_plan.`;

async function runTool(name: string, input: unknown): Promise<QlooResult> {
  if (name === "qloo_search") {
    const i = z.object({ query: z.string(), type: z.enum(ENTITY_TYPES) }).parse(input);
    return searchEntities(i.query, i.type);
  }
  if (name === "qloo_insights") {
    const i = z
      .object({ filter_type: z.enum(ENTITY_TYPES), signal_entity_ids: z.array(z.string()).min(1), take: z.number().int() })
      .parse(input);
    return insights({ filterType: i.filter_type, signalEntityIds: i.signal_entity_ids, take: Math.min(Math.max(i.take, 1), 20) });
  }
  throw new Error(`Unknown tool ${name}`);
}

export async function buildPlan(book: BookInput): Promise<{ plan: Plan; trace: TraceStep[]; sample: boolean }> {
  const trace: TraceStep[] = [];
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
    console.log(`[comps] ${turns} turns, in ${usage.input} (+${usage.cacheRead} cached), out ${usage.output}, ~$${usd.toFixed(3)}`);
  };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
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
      return { plan: Plan.parse(submit.input), trace, sample: !hasQlooKey() };
    }
    if (calls.length === 0) {
      messages.push({ role: "user", content: "Please finish by calling submit_plan with the plan." });
      continue;
    }

    const results = await Promise.all(
      calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const started = Date.now();
        try {
          const result = await runTool(call.name, call.input);
          trace.push({ tool: call.name, input: call.input, ms: Date.now() - started, count: result.entities.length, sample: result.sample });
          return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify({ sample: result.sample, entities: result.entities }) };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          trace.push({ tool: call.name, input: call.input, ms: Date.now() - started, count: 0, sample: false, error: message });
          return { type: "tool_result", tool_use_id: call.id, content: message, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  throw new Error("The agent did not finish in time. Try again with a shorter description.");
}
