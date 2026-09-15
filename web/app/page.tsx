"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DirectorSession } from "@/app/lib/director";
import { captureFrame, uploadFrame } from "@/app/lib/capture";
import { EMPTY_SLOTS, ITEMS } from "@/app/lib/items";
import {
  bubbleAlign,
  detectAddressee,
  looksLikeSpeech,
  SPEAKERS,
  toSpokenLine,
  type SpeakerId,
} from "@/app/lib/dialogue";

/** The three inputs the demo has to nail, offered as one-click chips. */
const TEST_INPUTS = ["Walk to merchant", "Look at temple", "Pet snake"];

/** How long Jane's line stays alone on screen before the NPC answers. */
const READ_TIME_MS = 2200;

type LogKind = "info" | "ok" | "warn" | "err" | "you";
type LogLine = { id: number; at: string; kind: LogKind; msg: string };

type Status = "idle" | "connecting" | "live" | "stalled" | "error";

const STATUS_LABEL: Record<Status, string> = {
  idle: "not started",
  connecting: "opening session",
  live: "live",
  stalled: "waiting for chunk",
  error: "error",
};

const STATUS_DOT: Record<Status, string> = {
  idle: "idle",
  connecting: "warn",
  live: "live",
  stalled: "warn",
  error: "bad",
};

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<LogLine[]>([]);
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [credit, setCredit] = useState<number | null>(null);
  const [creditErr, setCreditErr] = useState<string | null>(null);
  const startCreditRef = useRef<number | null>(null);
  const [spent, setSpent] = useState(0);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [framePending, setFramePending] = useState(false);
  // the still stays on screen until the live stream actually paints a frame
  const [videoLive, setVideoLive] = useState(false);
  /** A direction is in flight: sent, not yet applied by the model. */
  const [pending, setPending] = useState<string | null>(null);
  const [chunks, setChunks] = useState(0);
  const [mutedFallback, setMutedFallback] = useState(false);
  /**
   * Pin each direction to an edited keyframe built from the frame on screen.
   * Off by default: it costs ~$0.04 and ~10-15s per direction, which trades the
   * live feel for tighter continuity. Flip it on to compare.
   */
  const [lockFrame, setLockFrame] = useState(false);
  const anchorRef = useRef<string | null>(null);

  /** The single exchange currently on screen. One turn, then it clears. */
  const [bubbles, setBubbles] = useState<{ who: SpeakerId; label: string; line: string }[]>([]);
  const [talking, setTalking] = useState(false);
  const lastAddresseeRef = useRef<SpeakerId | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Item id -> icon path. Generated once, then served from disk. */
  const [icons, setIcons] = useState<Record<string, string>>({});

  const directorRef = useRef<DirectorSession | null>(null);

  const logIdRef = useRef(0);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const say = useCallback((kind: LogKind, msg: string) => {
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLog((prev) => [...prev, { id: logIdRef.current++, at, kind, msg }]);
  }, []);

  // Inventory icons are cached server-side, so this is a disk read after the
  // first run. Loaded once on mount rather than when a session starts.
  useEffect(() => {
    let live = true;
    void Promise.all(
      ITEMS.map(async (item) => {
        try {
          const res = await fetch(`/api/item?id=${item.id}`, { cache: "no-store" });
          const data = await res.json();
          return res.ok && typeof data.url === "string" ? ([item.id, data.url] as const) : null;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (!live) return;
      setIcons(Object.fromEntries(pairs.filter((p): p is readonly [string, string] => p !== null)));
    });
    return () => {
      live = false;
    };
  }, []);

  // keep the log pinned to the newest line
  useEffect(() => {
    const box = logBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [log]);

  // credit — polled from the server, which is the only side that sees FAL_KEY.
  // Polls faster while streaming, since that is when the balance actually moves.
  const pollCredit = useCallback(async () => {
    try {
      const res = await fetch("/api/credit", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setCredit(data.balance);
      setCreditErr(null);
      if (startCreditRef.current !== null) {
        setSpent(Math.max(0, startCreditRef.current - data.balance));
      }
      return data.balance as number;
    } catch (e) {
      setCreditErr(e instanceof Error ? e.message : "lookup failed");
      return null;
    }
  }, []);

  // session timer — only runs while the stream is actually open
  const running = status === "live" || status === "stalled" || status === "connecting";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    void pollCredit();
    const t = setInterval(() => void pollCredit(), running ? 10_000 : 60_000);
    return () => clearInterval(t);
  }, [pollCredit, running]);

  /**
   * Server messages from the director. Rejections and errors are surfaced in the
   * log rather than swallowed — a content-policy block is the most likely reason
   * a direction appears to do nothing.
   */
  const handleMessage = useCallback(
    (msg: Record<string, unknown>) => {
      const type = String(msg.type ?? "unknown");

      switch (type) {
        case "configured":
          setStatus("live");
          say("ok", "Scene configured — the temple is live.");
          break;

        case "chunk":
          setChunks((n) => n + 1);
          setStatus("live");
          break;

        case "prompt_pending":
          say("info", `Direction queued (v${msg.prompt_version ?? "?"}).`);
          break;

        case "prompt_applied":
          say("ok", `Direction applied (v${msg.prompt_version ?? "?"}).`);
          setPending(null);
          break;

        case "prompt_rejected":
          say("err", `Direction rejected: ${String(msg.reason ?? "unknown reason")}.`);
          setPending(null);
          break;

        case "deadline_missed":
          // H3 holds the last frame rather than blanking; mirror that in the UI
          setStatus("stalled");
          say("warn", "Chunk was late — holding the last frame.");
          break;

        case "stream_exhausted":
          // the session hit its limit; close it so nothing keeps billing, and
          // leave the last frame on screen rather than blanking
          say("warn", "Stream exhausted — session limit reached, holding last frame.");
          directorRef.current?.close();
          directorRef.current = null;
          setStatus("idle");
          setPending(null);
          break;

        case "error":
          setStatus("error");
          say("err", `Model error: ${String(msg.reason ?? msg.message ?? JSON.stringify(msg))}`);
          setPending(null);
          break;

        case "__idle_sent":
          say("info", "Idle — Jane waits in the temple.");
          break;

        default:
          say("info", `${type}${msg.reason ? `: ${String(msg.reason)}` : ""}`);
      }
    },
    [say],
  );

  /**
   * The opening still. Cached server-side, so re-starting does not re-bill.
   * Returns the fal-hosted URL, which is what the session anchors its first frame on.
   */
  const loadOpeningFrame = useCallback(async (): Promise<string | null> => {
    setFramePending(true);
    try {
      const res = await fetch("/api/opening-frame", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setFrameUrl(data.url);
      say("ok", data.cached ? "Opening frame loaded (cached)." : "Opening frame generated.");
      return typeof data.remote === "string" ? data.remote : null;
    } catch (e) {
      say("err", `Opening frame failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    } finally {
      setFramePending(false);
    }
  }, [say]);

  const start = useCallback(async () => {
    setStatus("connecting");
    setElapsed(0);
    setSpent(0);
    setVideoLive(false);
    // baseline the balance so the pill can show what this session costs
    const before = await pollCredit();
    startCreditRef.current = before;
    // the still goes up first so the frame is never black while H3 negotiates
    const anchor = await loadOpeningFrame();
    anchorRef.current = anchor;
    if (!anchor) {
      say("warn", "No anchor image — the stream will invent its own opening frame.");
    }

    setChunks(0);
    say("info", "Opening H3 Max Director session…");

    const director = new DirectorSession({
      onMedia: (stream) => {
        const el = videoRef.current;
        if (!el) return;
        el.srcObject = stream;
        say("ok", "Video track attached.");

        // Autoplay with sound is blocked in some browsers even after a click.
        // Falling back to muted playback keeps the picture moving; a silent
        // rejection here would look exactly like a frozen frame.
        void el.play().catch(() => {
          el.muted = true;
          setMutedFallback(true);
          void el.play().then(
            () => say("warn", "Autoplay with sound was blocked — playing muted."),
            (err) => say("err", `Playback blocked: ${describe(err)}`),
          );
        });
      },
      onState: (state) => {
        say("info", `Session ${state}.`);
        if (state === "live") setStatus("live");
        if (state === "failed") setStatus("error");
        if (state === "closed" && !directorRef.current) setStatus("idle");
      },
      onError: (error) => {
        setStatus("error");
        say("err", `Session error: ${describe(error)}`);
      },
      onMessage: handleMessage,
    });

    directorRef.current = director;
    director.open(anchor);
  }, [handleMessage, loadOpeningFrame, pollCredit, say]);

  const stop = useCallback(() => {
    directorRef.current?.close();
    directorRef.current = null;
    setStatus("idle");
    setVideoLive(false);
    setPending(null);
    setMutedFallback(false);
    say("info", "Session stopped.");
    // billing lags a moment behind the stream closing
    setTimeout(() => void pollCredit(), 3000);
  }, [pollCredit, say]);

  /**
   * One exchange: Jane says a line, an NPC answers once, both fade.
   *
   * The bubbles appear as soon as the LLM answers (about a second), while the
   * video steer that makes Jane turn and speak arrives with the next chunk. The
   * conversation therefore reads instantly and the picture catches up.
   */
  const speak = useCallback(
    async (text: string) => {
      const line = toSpokenLine(text);
      if (!line) return;

      const to = detectAddressee(line, lastAddresseeRef.current);
      lastAddresseeRef.current = to;

      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      setBubbles([{ who: "jane", label: SPEAKERS.jane.label, line }]);
      setTalking(true);
      setInput("");
      say("you", `Jane: ${line}`);

      // let the scene show the exchange, without waiting for it
      directorRef.current?.steer(
        `Montana Jane turns to the ${SPEAKERS[to].label.toLowerCase()} and speaks a short line; ` +
          `the ${SPEAKERS[to].label.toLowerCase()} answers her with a small gesture`,
      );

      try {
        // The LLM answers in about a second, which lands the reply on top of
        // Jane's line before it can be read. Hold the reply until her line has
        // had its moment — the wait runs alongside the request, not after it.
        const [res] = await Promise.all([
          fetch("/api/dialogue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ line, to }),
          }),
          new Promise((resolve) => setTimeout(resolve, READ_TIME_MS)),
        ]);

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

        setBubbles((prev) => [...prev, { who: to, label: data.label, line: data.line }]);
        say("ok", `${data.label}: ${data.line}`);
      } catch (e) {
        say("err", `Dialogue failed: ${describe(e)}`);
      } finally {
        setTalking(false);
        // single turn: the NPC says its piece and stops
        bubbleTimerRef.current = setTimeout(() => setBubbles([]), 9000);
      }
    },
    [say],
  );

  const send = useCallback(
    async (text: string) => {
      const line = text.trim();
      if (!line || !directorRef.current) return;

      // quoted text, or "say …", is dialogue rather than an action
      if (looksLikeSpeech(line)) {
        void speak(line);
        return;
      }

      say("you", `> ${line}`);
      setPending(line);
      setInput("");

      let endImage: string | null = null;

      if (lockFrame) {
        try {
          // "reuse the last frame of the scene before": grab what is on screen,
          // fall back to the opening still before the stream has painted.
          setPending(`${line} — composing keyframe…`);

          let source = anchorRef.current;
          const video = videoRef.current;
          if (video) {
            const shot = await captureFrame(video);
            if (shot) source = await uploadFrame(shot);
          }

          if (source) {
            const res = await fetch("/api/keyframe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ direction: line, sourceUrl: source }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
            endImage = data.remote ?? null;
            // the keyframe becomes the base for the next direction
            if (endImage) anchorRef.current = endImage;
            say("ok", data.cached ? "Keyframe reused." : "Keyframe composed.");
          }
        } catch (e) {
          say("warn", `Keyframe failed, steering with words only: ${describe(e)}`);
        }
      }

      setPending(line);
      const version = directorRef.current.steer(line, endImage);
      if (version === null) {
        say("warn", "Session is not ready yet — give it a moment.");
        setPending(null);
      }
    },
    [lockFrame, say, speak],
  );

  const started = status !== "idle";
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <main className="wrap">
      <div className="bar">
        <h1 className="title">Montana Jane</h1>

        <span className="pill">
          <i className={`dot ${STATUS_DOT[status]}`} />
          {STATUS_LABEL[status]}
        </span>

        <span className="pill">
          session <b>{mmss}</b>
        </span>

        <Link className="pill" href="/gallery">
          gallery
        </Link>

        <span className={`pill${credit !== null && credit < 5 ? " alarm" : ""}`}>
          {creditErr ? (
            <>
              credit <b title={creditErr}>unavailable</b>
            </>
          ) : (
            <>
              credit <b>{credit === null ? "…" : `$${credit.toFixed(2)}`}</b>
              {spent > 0 && <>&nbsp;· spent <b>${spent.toFixed(2)}</b></>}
            </>
          )}
        </span>
      </div>

      <div className="frame">
        {/* The opening still sits beneath the video and is revealed until the
            stream paints — that is what keeps the frame from ever going black. */}
        {frameUrl && (
          <img className={`still${videoLive ? " hidden" : ""}`} src={frameUrl} alt="" />
        )}
        <video
          ref={videoRef}
          className={videoLive ? "" : "blank"}
          autoPlay
          playsInline
          muted={false}
          onPlaying={() => setVideoLive(true)}
        />
        {framePending && (
          <div className="placeholder">
            <div className="big">Lighting the torches…</div>
          </div>
        )}

        {/* Generation feedback: H3 renders in ~10s chunks, so a direction takes a
            moment to appear. Without this the frame just looks frozen. */}
        {started && (pending !== null || status === "connecting") && (
          <div className="working">
            <div className="bead" />
            <span>
              {pending !== null ? `Directing: ${pending}` : "Opening the scene…"}
            </span>
          </div>
        )}

        {bubbles.map((b) => {
          const { x, y } = SPEAKERS[b.who].at;
          const align = bubbleAlign(x);
          // anchor the edge nearest the character so the bubble grows into the frame
          const place =
            align === "right"
              ? { right: `${Math.max(2, 100 - x - 4)}%` }
              : align === "left"
                ? { left: `${Math.max(2, x - 4)}%` }
                : { left: `${x}%` };

          return (
            <div
              key={`${b.who}-${b.line}`}
              className={`bubble ${b.who === "jane" ? "jane" : "npc"} at-${align}`}
              style={{ ...place, top: `${y}%` }}
            >
              <b>{b.label}:</b> {b.line}
            </div>
          );
        })}

        {mutedFallback && (
          <button
            className="unmute"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              el.muted = false;
              void el.play().then(() => setMutedFallback(false));
            }}
          >
            🔇 sound off — click to enable
          </button>
        )}

        {started && chunks > 0 && (
          <div className="chunkcount">{chunks} chunk{chunks === 1 ? "" : "s"}</div>
        )}
        {!started && (
          <div className="placeholder">
            <div className="big">The temple is dark</div>
            <button className="btn" onClick={start}>
              Begin the scene
            </button>
          </div>
        )}
      </div>

      <div className="inventory" aria-label="Inventory">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className="slot"
            disabled={!started}
            title={`Use the ${item.label.toLowerCase()}`}
            onClick={() => void send(`Montana Jane ${item.use}`)}
          >
            {icons[item.id] ? (
              <img src={icons[item.id]} alt={item.label} />
            ) : (
              <span className="loading" />
            )}
            <span className="name">{item.label}</span>
          </button>
        ))}

        {Array.from({ length: EMPTY_SLOTS }, (_, i) => (
          <span key={`empty-${i}`} className="slot empty" aria-hidden />
        ))}
      </div>

      <form
        className="steer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a direction…  e.g. walk to the merchant"
          disabled={!started}
          autoFocus
        />
        <button
          className="btn ghost say"
          type="button"
          disabled={!started || !input.trim() || talking}
          onClick={() => void speak(input)}
          title="Jane says this out loud"
        >
          {talking ? "…" : "Say"}
        </button>
        <button className="btn" type="submit" disabled={!started || !input.trim()}>
          {pending !== null ? "…" : "Send"}
        </button>
        {started && (
          <button className="btn ghost" type="button" onClick={stop}>
            Stop
          </button>
        )}
      </form>

      <div className="hints">
        <label className="toggle" title="Pin each direction to an edited keyframe built from the frame on screen">
          <input
            type="checkbox"
            checked={lockFrame}
            onChange={(e) => setLockFrame(e.target.checked)}
          />
          lock frame
        </label>
        <span className="note">{lockFrame ? "+$0.04 · slower, tighter" : "words only · fast"}</span>
        <span>try:</span>
        {TEST_INPUTS.map((t) => (
          <button key={t} className="chip" disabled={!started} onClick={() => void send(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="log" ref={logBoxRef}>
        <h2>Session log</h2>
        {log.length === 0 ? (
          <p className="empty">Nothing yet.</p>
        ) : (
          <ul>
            {log.map((l) => (
              <li key={l.id} className={l.kind}>
                <time>{l.at}</time>
                <span className="msg">{l.msg}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
