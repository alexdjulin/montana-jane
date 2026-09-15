import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Generated media is saved under `public/generated/` and served from there.
 *
 * On disk rather than in memory because every generation is billed: a dev-server
 * restart should not cost another image. The prompt hash is in the filename, so
 * editing a prompt naturally produces a new file instead of serving a stale one.
 *
 * Every generation is also appended to `manifest.jsonl` with the prompt that produced
 * it, so the run can be reviewed afterwards — see /gallery.
 */
const DIR = path.join(process.cwd(), "public", "generated");

export function promptKey(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 12);
}

/**
 * An already-saved asset for this kind+key, if one survived a restart.
 * Returns the local path plus the fal URL it came from, when recorded.
 */
export async function findCached(
  kind: string,
  key: string,
): Promise<{ file: string; remote?: string } | null> {
  try {
    const files = await readdir(DIR);
    const hit = files.find((f) => f.startsWith(`${kind}-${key}.`));
    if (!hit) return null;

    const file = `/generated/${hit}`;
    const remote = (await history()).find((r) => r.file === file)?.remote;
    return { file, remote };
  } catch {
    return null; // directory does not exist yet
  }
}

/** Downloads a fal media URL and stores it next to the app. Returns a public path. */
export async function saveRemote(kind: string, key: string, url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`could not download generated media (${res.status})`);

  const ext = (new URL(url).pathname.split(".").pop() || "bin").toLowerCase();
  const name = `${kind}-${key}.${ext}`;

  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, name), Buffer.from(await res.arrayBuffer()));

  return `/generated/${name}`;
}


export type AssetRecord = {
  at: string;
  kind: string;
  /** Local path we serve from. */
  file: string;
  /**
   * The fal-hosted URL this came from. Kept because fal cannot fetch our
   * localhost copy — anchoring a session's first frame needs a public URL.
   */
  remote?: string;
  model: string;
  prompt: string;
};

const MANIFEST = path.join(DIR, "manifest.jsonl");

/** Appends one line per generation, so nothing generated is lost to scrollback. */
export async function record(entry: AssetRecord): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await appendFile(MANIFEST, `${JSON.stringify(entry)}\n`, "utf8");
}

/** Every recorded generation, newest first. */
export async function history(): Promise<AssetRecord[]> {
  try {
    const raw = await readFile(MANIFEST, "utf8");
    const rows = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as AssetRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is AssetRecord => r !== null);
    return rows.reverse();
  } catch {
    return [];
  }
}
