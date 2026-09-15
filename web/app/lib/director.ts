"use client";

import { createFalClient } from "@fal-ai/client";
import type { ManagedRealtimeSession } from "@fal-ai/client/realtime";
import { wma, type WmaRealtimeSession } from "@fal-ai/client/realtime";
import { composeDirection, IDLE_PROMPT, OPENING_SCENE_PROMPT } from "./scene";

export const DIRECTOR_ENDPOINT = "minimax/h3-max/director";

/** Seconds of silence before Jane is told to settle into a calm idle. */
export const IDLE_AFTER_MS = 8000;

export type DirectorEvents = {
  onMedia: (stream: MediaStream) => void;
  onState: (state: string) => void;
  onError: (error: unknown) => void;
  /** A parsed server message. */
  onMessage: (msg: Record<string, unknown>) => void;
};

/**
 * One H3 Max Director session.
 *
 * The protocol is deliberately untyped by the client (`WmaControlMessage = object`),
 * so the message shapes here come from the model's AsyncAPI contract, not from types.
 *
 * The one rule that bites: `prompt_version` must strictly increase on every message,
 * starting at 1 for `configure`. A repeated or stale value is rejected outright, so the
 * counter lives here rather than in component state, where a re-render could double-send.
 */
export class DirectorSession {
  private session: ManagedRealtimeSession<WmaRealtimeSession> | null = null;
  private version = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleSent = false;
  private closed = false;

  constructor(private readonly events: DirectorEvents) {}

  /**
   * Public URL of the still to pin as the exact first frame. Must be reachable by
   * fal, so it is the fal-hosted URL rather than our local copy.
   */
  private imageUrl: string | null = null;

  open(imageUrl?: string | null) {
    this.imageUrl = imageUrl ?? null;
    const fal = createFalClient({ proxyUrl: "/api/fal/proxy" });

    this.session = fal.realtime.open(wma(DIRECTOR_ENDPOINT), {
      receive: ["video", "audio"],
      onMedia: (stream: MediaStream) => this.events.onMedia(stream),
      onState: (state: string) => this.events.onState(state),
      onError: (error: unknown) => this.events.onError(error),
      onData: (raw: string) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(raw);
        } catch {
          this.events.onMessage({ type: "unparseable", raw });
          return;
        }
        this.events.onMessage(msg);
      },
    });

    // Sends issued while the session is still opening are queued and flushed in
    // order once it is live, so the opening scene goes out now rather than
    // depending on a particular state callback firing.
    this.configure();
  }

  private configure() {
    if (this.version > 0) return; // configure exactly once per session
    this.version = 1;
    this.send({
      type: "configure",
      protocol_version: 1,
      prompt_version: this.version,
      prompt: OPENING_SCENE_PROMPT,
      aspect_ratio: "16:9",
      resolution: "768p",
      // Max context. The default of 12 prior segment prompts is what lets the
      // scene drift; 50 is the documented ceiling and holds the world together.
      memory: 50,
      // The exact first frame. Without it the session invents its own opening
      // and the cut from the still to the stream is visible.
      ...(this.imageUrl ? { image_url: this.imageUrl } : {}),
    });
    this.armIdle();
  }

  /**
   * Sends a player direction. Returns the version used, or null if not ready.
   *
   * `endImageUrl` pins the exact frame the chunk must land on. It is the hardest
   * continuity lock available in-session: `image_url` (the exact FIRST frame) can
   * only be set at `configure` time, so re-anchoring the opening of every
   * direction would mean a new session — and a new 60-second minimum charge —
   * each time. Pinning where the action ENDS achieves the same continuity within
   * one session, because the next chunk continues from that frame.
   */
  steer(prompt: string, endImageUrl?: string | null): number | null {
    if (!this.session || this.version === 0 || this.closed) return null;
    this.version += 1;
    // the player's words alone would replace the whole scene description
    this.send({
      type: "prompt",
      prompt_version: this.version,
      prompt: composeDirection(prompt),
      replan: true,
      ...(endImageUrl ? { end_image_url: endImageUrl } : {}),
    });
    this.idleSent = false;
    this.armIdle();
    return this.version;
  }

  /**
   * After a quiet spell, nudge Jane into a waiting loop so the scene does not
   * drift off on the last direction. Sent once per quiet spell, never repeatedly.
   */
  private armIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.closed || this.idleSent) return;
      this.idleSent = true;
      this.version += 1;
      this.send({
        type: "prompt",
        prompt_version: this.version,
        prompt: composeDirection(IDLE_PROMPT),
        replan: false,
      });
      this.events.onMessage({ type: "__idle_sent", prompt_version: this.version });
    }, IDLE_AFTER_MS);
  }

  private send(message: object) {
    try {
      // the managed handle queues until the control channel is open
      this.session?.send(message);
    } catch (e) {
      this.events.onError(e);
    }
  }

  close() {
    this.closed = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    try {
      this.session?.send({ type: "stop" });
    } catch {
      // the session may already be gone; closing below is what matters
    }
    this.session?.close();
    this.session = null;
  }
}
