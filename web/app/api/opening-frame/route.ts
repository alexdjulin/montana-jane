import { NextResponse } from "next/server";
import { IMAGE_MODEL, OPENING_FRAME_PROMPT } from "@/app/lib/scene";
import { findCached, promptKey, record, saveRemote } from "@/app/lib/assets";

/**
 * Generates the still that fills the video frame before the live stream arrives,
 * so the player never stares at a black box.
 *
 * The result is written to `public/generated/` and reused on later starts —
 * every generation is billed, and the opening frame is the same picture each time.
 * `?fresh=1` forces a reroll while tuning the prompt.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = process.env.FAL_KEY;
  if (!key) {
    return NextResponse.json({ error: "FAL_KEY is not set on the server" }, { status: 500 });
  }

  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const id = promptKey(OPENING_FRAME_PROMPT);

  if (!fresh) {
    const hit = await findCached("opening", id);
    // only reuse if we still know the fal URL — the session needs it to anchor
    if (hit?.remote) {
      return NextResponse.json({ url: hit.file, remote: hit.remote, cached: true });
    }
  }

  try {
    const res = await fetch(`https://fal.run/${IMAGE_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: OPENING_FRAME_PROMPT,
        aspect_ratio: "16:9",
        num_images: 1,
      }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail ?? body);
      return NextResponse.json({ error: `image model ${res.status}: ${detail}` }, { status: 502 });
    }

    const remote = body?.images?.[0]?.url;
    if (typeof remote !== "string") {
      return NextResponse.json({ error: "image model returned no image" }, { status: 502 });
    }

    // fal media URLs expire; keep our own copy
    const url = await saveRemote("opening", fresh ? `${id}-${Date.now()}` : id, remote);
    await record({
      at: new Date().toISOString(),
      kind: "opening",
      file: url,
      remote,
      model: IMAGE_MODEL,
      prompt: OPENING_FRAME_PROMPT,
    });
    return NextResponse.json({ url, remote, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "opening frame failed" },
      { status: 502 },
    );
  }
}
