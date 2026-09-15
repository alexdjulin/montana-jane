import { NextResponse } from "next/server";
import { IMAGE_MODEL } from "@/app/lib/scene";
import { ITEMS, itemIconPrompt } from "@/app/lib/items";
import { findCached, promptKey, record, saveRemote } from "@/app/lib/assets";

/**
 * One inventory icon, generated once and then served from disk.
 *
 * Cached hard: an item's picture never changes, so this should bill exactly once
 * per item for the life of the project.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = process.env.FAL_KEY;
  if (!key) {
    return NextResponse.json({ error: "FAL_KEY is not set on the server" }, { status: 500 });
  }

  const id = new URL(request.url).searchParams.get("id");
  const item = ITEMS.find((i) => i.id === id);
  if (!item) return NextResponse.json({ error: `unknown item: ${id}` }, { status: 404 });

  const prompt = itemIconPrompt(item);
  const cacheKey = promptKey(prompt);

  const hit = await findCached(`item-${item.id}`, cacheKey);
  if (hit) return NextResponse.json({ id: item.id, url: hit.file, cached: true });

  try {
    const res = await fetch(`https://fal.run/${IMAGE_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspect_ratio: "1:1", num_images: 1 }),
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

    const url = await saveRemote(`item-${item.id}`, cacheKey, remote);
    await record({
      at: new Date().toISOString(),
      kind: `item-${item.id}`,
      file: url,
      remote,
      model: IMAGE_MODEL,
      prompt,
    });

    return NextResponse.json({ id: item.id, url, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "item icon failed" },
      { status: 502 },
    );
  }
}
