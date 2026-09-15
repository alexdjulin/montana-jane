import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { record } from "@/app/lib/assets";

/**
 * Stores a recording of the live stream.
 *
 * The stream is WebRTC, so there is no URL to download — the only way to keep it
 * is to record it in the browser and post the bytes here. Saved alongside every
 * other generated asset so it shows up in /gallery, which already renders video.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "empty recording" }, { status: 400 });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `recording-${stamp}.webm`;
    const dir = path.join(process.cwd(), "public", "generated");

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);

    const url = `/generated/${name}`;
    await record({
      at: new Date().toISOString(),
      kind: "recording",
      file: url,
      model: "minimax/h3-max/director",
      prompt: "Live session recording (captured in the browser from the WebRTC stream).",
    });

    return NextResponse.json({ url, bytes: buf.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "could not save recording" },
      { status: 500 },
    );
  }
}
