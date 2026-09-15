"use client";

/**
 * Records the live stream to a file.
 *
 * MediaRecorder encodes the existing MediaStream in the browser's native code —
 * no canvas compositing and no per-frame JavaScript, so it costs essentially
 * nothing while the game runs. It captures what the model generates: the video
 * and its audio, not the DOM overlays drawn on top.
 */

/** First codec the browser actually supports, best first. */
function pickMimeType(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export type Recording = {
  stop: () => Promise<Blob>;
  mimeType: string;
};

export function startRecording(stream: MediaStream): Recording {
  const mimeType = pickMimeType();
  const rec = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    // modest bitrate: plenty for a 768p retro-styled stream, small files
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // a timeslice means data arrives steadily instead of in one lump at the end
  rec.start(1000);

  return {
    mimeType: rec.mimeType || mimeType || "video/webm",
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "video/webm" }));
        if (rec.state !== "inactive") rec.stop();
        else resolve(new Blob(chunks, { type: rec.mimeType || "video/webm" }));
      }),
  };
}
