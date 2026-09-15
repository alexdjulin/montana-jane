import { NextResponse } from "next/server";
import { ITEMS, MAX_INSPECT } from "@/app/lib/items";
import { SCENE_LOOKABLES } from "@/app/lib/look";

/**
 * Jane looks at something — an item in her bag, or anything in the scene — and
 * says what she sees.
 *
 * A fresh line every time, but never a fresh STORY: the item's canon is authored
 * in `items.ts` and passed in as fixed fact. The model is told to riff on it and
 * is shown what it already said this session, so repeat clicks give a new angle
 * — what it is, how it looks, where she got it — instead of the same sentence or,
 * worse, a different provenance each time.
 */
export const dynamic = "force-dynamic";

const LLM = "google/gemini-2.5-flash";

function extractJson(raw: string): { line?: string } | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  const key = process.env.FAL_KEY;
  if (!key) {
    return NextResponse.json({ error: "FAL_KEY is not set on the server" }, { status: 500 });
  }

  let itemId: string;
  let said: string[];
  try {
    const body = await request.json();
    itemId = String(body?.itemId ?? "");
    said = Array.isArray(body?.said) ? body.said.slice(-5).map(String) : [];
  } catch {
    return NextResponse.json({ error: "bad request body" }, { status: 400 });
  }

  // items carry their canon inline; scene subjects live in their own registry
  const item = ITEMS.find((i) => i.id === itemId);
  const scene = SCENE_LOOKABLES.find((l) => l.id === itemId);
  if (!item && !scene) {
    return NextResponse.json({ error: `unknown subject: ${itemId}` }, { status: 404 });
  }

  const label = item ? item.label : scene!.label;
  const canon = item
    ? { ...item.canon, origin: item.canon.from }
    : scene!.canon;
  const inBag = Boolean(item);

  const system =
    "You are Montana Jane, an archaeologist exploring a jungle temple: dry, deadpan, " +
    "unbothered, quietly funny. " +
    (inBag
      ? "You are looking at something in your own bag and remarking on it out loud, to yourself."
      : "You are looking at something in the room and describing what you see, out loud, to yourself.") +
    "\n\n" +
    `These facts about the ${label.toLowerCase()} are FIXED and true. Never contradict ` +
    "them, never invent a different origin, and never change what it is:\n" +
    `- What it is: ${canon.what}\n` +
    `- How it looks: ${canon.looks}\n` +
    `- ${inBag ? "Where you got it" : "Where it came from"}: ${canon.origin}\n` +
    `- The running joke: ${canon.gag}\n\n` +
    "Say ONE short line. Pick a DIFFERENT angle each time — sometimes what it is, sometimes " +
    "a physical detail, sometimes how you got it, sometimes the joke. Funny and unexpected, " +
    "delivered completely straight. " +
    `Hard limit ${MAX_INSPECT} characters; aim well under it. ` +
    "No stage directions, no emoji, no surrounding quotes, no line breaks. " +
    'Respond with JSON only: {"line": "..."}.';

  const user =
    said.length > 0
      ? `You have already said these, so say something different:\n${said.map((l) => `- ${l}`).join("\n")}`
      : "Look at it for the first time.";

  try {
    const res = await fetch("https://fal.run/openrouter/router/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // high, because the whole point is a different line on every click
        temperature: 1.15,
        max_tokens: 140,
      }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: `LLM ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json({ error: "LLM returned no content" }, { status: 502 });
    }

    const parsed = extractJson(content);
    let line = (parsed?.line ?? content).trim().replace(/\s+/g, " ").replace(/^["']|["']$/g, "");

    if (line.length > MAX_INSPECT) {
      const cut = line.slice(0, MAX_INSPECT);
      const lastSpace = cut.lastIndexOf(" ");
      line = `${(lastSpace > MAX_INSPECT * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
    }

    return NextResponse.json({ itemId, label, line });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "inspect failed" },
      { status: 502 },
    );
  }
}
