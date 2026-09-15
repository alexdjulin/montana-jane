import { NextResponse } from "next/server";
import { EDIT_MODEL, keyframeEditPrompt } from "@/app/lib/scene";
import { findCached, promptKey, record, saveRemote } from "@/app/lib/assets";

/**
 * Builds a keyframe: the opening still, edited so only the action changes.
 *
 * This is the strongest continuity lock the director exposes. H3 has no mask or
 * region control — it cannot regenerate part of a frame — but `end_image_url`
 * pins the exact final frame of a chunk. So we edit the still (which preserves
 * the background, the cast and the style by construction) and make the model
 * land on it, instead of hoping words alone hold the scene together.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const key = process.env.FAL_KEY;
  if (!key) {
    return NextResponse.json({ error: "FAL_KEY is not set on the server" }, { status: 500 });
  }

  let direction: string;
  let sourceUrl: string;
  try {
    const body = await request.json();
    direction = String(body?.direction ?? "").trim();
    sourceUrl = String(body?.sourceUrl ?? "").trim();
  } catch {
    return NextResponse.json({ error: "bad request body" }, { status: 400 });
  }

  if (!direction || !sourceUrl) {
    return NextResponse.json({ error: "direction and sourceUrl are required" }, { status: 400 });
  }

  const prompt = keyframeEditPrompt(direction);
  const id = promptKey(`${sourceUrl}::${prompt}`);

  // the same direction from the same frame is the same keyframe — do not re-bill
  const hit = await findCached("keyframe", id);
  if (hit?.remote) {
    return NextResponse.json({ url: hit.file, remote: hit.remote, cached: true });
  }

  try {
    const res = await fetch(`https://fal.run/${EDIT_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        image_urls: [sourceUrl],
        aspect_ratio: "16:9",
        num_images: 1,
      }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail ?? body);
      return NextResponse.json({ error: `edit model ${res.status}: ${detail}` }, { status: 502 });
    }

    const remote = body?.images?.[0]?.url;
    if (typeof remote !== "string") {
      return NextResponse.json({ error: "edit model returned no image" }, { status: 502 });
    }

    const url = await saveRemote("keyframe", id, remote);
    await record({
      at: new Date().toISOString(),
      kind: "keyframe",
      file: url,
      remote,
      model: EDIT_MODEL,
      prompt,
    });

    return NextResponse.json({ url, remote, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "keyframe failed" },
      { status: 502 },
    );
  }
}
