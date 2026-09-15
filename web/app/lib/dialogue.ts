/**
 * Dialogue is drawn as an overlay, not generated into the video.
 *
 * The video model cannot render clean legible text — we explicitly forbid lettering
 * in every prompt — and baking words into 10-second chunks would put the line's
 * timing at the mercy of generation latency. An overlay is crisp, instant, and
 * needs no timing work at all.
 */

export type SpeakerId = "jane" | "merchant" | "keeper" | "monkey" | "parrot" | "snake";

export type Speaker = {
  id: SpeakerId;
  /** Name shown in the bubble. */
  label: string;
  /**
   * Where the character stands, as a percentage of the frame.
   *
   * These are fixed because the scene bible fixes them: the merchant is always at
   * the right-hand stall, the keeper always behind the centre altar. The bubble is
   * anchored to the character's head rather than floated in a corner.
   */
  at: { x: number; y: number };
  /** How the LLM should voice them. */
  voice: string;
  /**
   * Preset TTS voice. A fixed id per character, so a speaker sounds the same
   * every single time — a generated or randomised voice would not.
   */
  voiceId: string;
};

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  jane: {
    id: "jane",
    voiceId: "Calm_Woman",
    label: "Jane",
    at: { x: 50, y: 36 },
    voice: "Montana Jane, the player's archaeologist: dry, unbothered, deadpan.",
  },
  merchant: {
    id: "merchant",
    voiceId: "Friendly_Person",
    label: "Merchant",
    at: { x: 86, y: 36 },
    voice:
      "A travelling merchant at a market stall on the right. Warm, chatty, always selling " +
      "something absurdly anachronistic, and very particular about payment methods.",
  },
  keeper: {
    id: "keeper",
    voiceId: "Patient_Man",
    label: "Keeper",
    at: { x: 61, y: 40 },
    voice:
      "A hooded temple keeper behind the altar. Solemn and cryptic, but keeps letting slip " +
      "mundane modern complaints.",
  },
  monkey: {
    id: "monkey",
    voiceId: "Lively_Girl",
    label: "Monkey",
    at: { x: 9, y: 18 },
    voice: "A small brown monkey on a pillar. Speaks in short smug chirps. Steals things.",
  },
  parrot: {
    id: "parrot",
    voiceId: "Exuberant_Girl",
    label: "Parrot",
    at: { x: 62, y: 12 },
    voice: "A scarlet parrot overhead. Repeats things wrong, confidently.",
  },
  snake: {
    id: "snake",
    voiceId: "Elegant_Man",
    label: "Snake",
    at: { x: 27, y: 66 },
    voice: "An emerald snake on the floor. Sibilant, anxious, deeply unimpressed.",
  },
};

/** NPCs the player can actually get an answer from. */
export const NPCS: SpeakerId[] = ["merchant", "keeper", "monkey", "parrot", "snake"];

/**
 * Who is Jane talking to? Named in the line if possible, otherwise whoever was
 * addressed last, otherwise the merchant — who is the most talkative.
 */
export function detectAddressee(line: string, previous: SpeakerId | null): SpeakerId {
  const said = line.toLowerCase();
  const hit = NPCS.find((id) => said.includes(id));
  if (hit) return hit;
  if (said.includes("shopkeeper") || said.includes("trader")) return "merchant";
  if (said.includes("priest") || said.includes("monk")) return "keeper";
  return previous ?? "merchant";
}

/**
 * Is this meant as speech rather than an action?
 *
 * Quoted text is speech, and so is anything the player sends with the Say button.
 */
export function looksLikeSpeech(text: string): boolean {
  const t = text.trim();
  return /^["'].*["']$/.test(t) || /^(say|ask|tell|greet)\b/i.test(t);
}

/** Strips the quotes or the leading verb, leaving the words Jane actually says. */
export function toSpokenLine(text: string): string {
  let t = text.trim();
  t = t.replace(/^(say|ask|tell|greet)\b[:,]?\s*/i, "");
  t = t.replace(/^["'](.*)["']$/, "$1");
  return t.trim();
}

/** Keep a reply to at most two comfortable lines in the bubble. */
export const MAX_LINE = 70;

/**
 * Which way a bubble grows.
 *
 * A bubble centred on a character near the frame edge runs off it — the merchant
 * stands at 86% across, so a centred bubble would be clipped. Characters near an
 * edge anchor that edge instead and grow inward.
 */
export function bubbleAlign(x: number): "left" | "center" | "right" {
  if (x >= 66) return "right";
  if (x <= 34) return "left";
  return "center";
}
