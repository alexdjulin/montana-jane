import { NextResponse } from "next/server";
import { SPEAKERS, type SpeakerId } from "@/app/lib/dialogue";
import { findCached, promptKey, record, saveRemote } from "@/app/lib/assets";

/**
 * Speech for one line of dialogue.
 *
 * A fixed preset voice per character, so a speaker sounds identical every time.
 * Cached on disk by (voice + text), so a repeated line costs nothing.
 */
export const dynamic = "force-dynamic";

const TTS_MODEL = "fal-ai/minimax/speech-2.8-turbo";

export async function POST(request: Request) {
  const key = process.env.FAL_KEY;
  if (!key) return NextResponse.json({ error: "FAL_KEY is not set" }, { status: 500 });

  let text: string;
  let who: SpeakerId;
  try {
    const body = await request.json();
    text = String(body?.text ?? "").trim();
    who = String(body?.speaker ?? "jane") as SpeakerId;
  } catch {
    return NextResponse.json({ error: "bad request body" }, { status: 400 });
  }

  const speaker = SPEAKERS[who] ?? SPEAKERS.jane;
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const cacheKey = promptKey(`${speaker.voiceId}::${text}`);
  const hit = await findCached(`voice-${who}`, cacheKey);
  if (hit) return NextResponse.json({ url: hit.file, cached: true });

  try {
    const res = await fetch(`https://fal.run/${TTS_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        voice_setting: { voice_id: speaker.voiceId, speed: 1.0 },
      }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: `tts ${res.status}: ${JSON.stringify(body)?.slice(0, 160)}` },
        { status: 502 },
      );
    }

    const remote = body?.audio?.url;
    if (typeof remote !== "string") {
      return NextResponse.json({ error: "tts returned no audio" }, { status: 502 });
    }

    const url = await saveRemote(`voice-${who}`, cacheKey, remote);
    await record({
      at: new Date().toISOString(),
      kind: `voice-${who}`,
      file: url,
      remote,
      model: TTS_MODEL,
      prompt: `[${speaker.voiceId}] ${text}`,
    });

    return NextResponse.json({ url, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "tts failed" },
      { status: 502 },
    );
  }
}
