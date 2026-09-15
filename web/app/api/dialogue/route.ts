import { NextResponse } from "next/server";
import { MAX_LINE, SPEAKERS, type SpeakerId } from "@/app/lib/dialogue";

/**
 * One NPC reply, via fal's OpenRouter router.
 *
 * Single turn by design: Jane says one thing, the NPC answers once, and stops.
 * No conversation state, no follow-ups, nothing to time.
 */
export const dynamic = "force-dynamic";

const LLM = "google/gemini-2.5-flash";

/** The model likes to wrap JSON in fences and occasionally adds a stray brace. */
function extractJson(raw: string): { speaker?: string; line?: string } | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  // walk to the matching brace rather than trusting the model's bracketing
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

  let said: string;
  let toId: SpeakerId;
  try {
    const body = await request.json();
    said = String(body?.line ?? "").trim();
    toId = String(body?.to ?? "merchant") as SpeakerId;
  } catch {
    return NextResponse.json({ error: "bad request body" }, { status: 400 });
  }

  const npc = SPEAKERS[toId] ?? SPEAKERS.merchant;
  if (!said) return NextResponse.json({ error: "line is required" }, { status: 400 });

  const system =
    "You voice NPCs in a comedic voxel adventure game set in an overgrown jungle temple. " +
    `You are replying as: ${npc.label}. ${npc.voice} ` +
    `Reply with exactly ONE short spoken line. Hard limit ${MAX_LINE} characters — ` +
    "aim for well under it, a single punchy sentence, so it is never cut off. " +
    "It must genuinely answer or react to what Montana Jane just said, but be funny and " +
    "unexpected — modern, anachronistic nonsense delivered completely straight works well. " +
    "No stage directions, no emoji, no surrounding quotes, no line breaks. " +
    'Respond with JSON only, in the form {"line": "..."}.';

  try {
    const res = await fetch("https://fal.run/openrouter/router/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Montana Jane says to the ${npc.label}: ${said}` },
        ],
        temperature: 1.0,
        max_tokens: 120,
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
    // fall back to the raw text if the model ignored the JSON instruction
    let line = (parsed?.line ?? content).trim().replace(/\s+/g, " ").replace(/^["']|["']$/g, "");

    // Trim on a word boundary — cutting mid-word ("Slow these da…") reads as a bug.
    if (line.length > MAX_LINE) {
      const cut = line.slice(0, MAX_LINE);
      const lastSpace = cut.lastIndexOf(" ");
      line = `${(lastSpace > MAX_LINE * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
    }

    return NextResponse.json({ speaker: npc.id, label: npc.label, line });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "dialogue failed" },
      { status: 502 },
    );
  }
}
