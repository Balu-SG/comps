import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPlan } from "@/lib/agent";

export const maxDuration = 300;

const Body = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().max(120).optional(),
  description: z.string().trim().min(20).max(2000),
  knownComps: z.array(z.string().trim().min(1).max(200)).max(5),
});

// Best-effort per-instance limit so a public demo can't run up the API bill.
const hits = new Map<string, number[]>();
const LIMIT = 8;
const WINDOW_MS = 60 * 60 * 1000;

function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  hits.set(ip, [...recent, now]);
  return true;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip)) {
    return NextResponse.json({ error: "Hourly limit reached for this demo. Please try again later." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please give a title and a description of at least 20 characters." }, { status: 400 });
  }
  try {
    return NextResponse.json(await buildPlan(parsed.data));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
  }
}
