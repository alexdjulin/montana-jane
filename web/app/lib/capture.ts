"use client";

import { createFalClient } from "@fal-ai/client";

/**
 * Grabs the frame currently on screen.
 *
 * This is "the last frame of the scene before": whatever the stream is showing
 * at the moment the player types. Returned as a PNG blob.
 */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null; // no frames yet

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/**
 * Puts a captured frame somewhere fal can fetch it.
 *
 * fal cannot reach our localhost copy, so the frame goes to fal storage. The
 * upload runs through our proxy, so FAL_KEY still never reaches the browser.
 */
export async function uploadFrame(blob: Blob): Promise<string> {
  const fal = createFalClient({ proxyUrl: "/api/fal/proxy" });
  const file = new File([blob], `frame-${Date.now()}.png`, { type: "image/png" });
  return await fal.storage.upload(file);
}
