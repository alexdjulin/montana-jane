/**
 * Everything in the scene the player can look at.
 *
 * "Look at" is a pure description — Jane says what she sees and the picture does
 * not change. Only Send generates video. That keeps the expensive verb explicit
 * and makes clicking around the scene free.
 *
 * Positions come from the scene bible, which is what makes fixed hotspots viable
 * at all: the merchant is always at the right-hand stall, the snake always coiled
 * to Jane's left.
 */

export type Canon = {
  /** What the thing is. */
  what: string;
  /** How it looks — the detail she can describe differently each time. */
  looks: string;
  /** Where it came from, or its history here. */
  origin: string;
  /** The running joke to circle back to. */
  gag: string;
};

export type Lookable = {
  id: string;
  label: string;
  /** Centre of the hotspot, as a percentage of the frame. */
  at: { x: number; y: number };
  /** Hotspot size, as a percentage of the frame. */
  size: { w: number; h: number };
  canon: Canon;
};

export const SCENE_LOOKABLES: Lookable[] = [
  {
    id: "jane",
    label: "Montana Jane",
    at: { x: 50, y: 56 },
    size: { w: 11, h: 34 },
    canon: {
      what: "Yourself. Archaeologist, currently underground, technically on holiday.",
      looks: "Leather jacket losing an argument with the humidity. Hat holding up better.",
      origin: "Three degrees and a strong opinion about grave robbing brought you here.",
      gag: "You are the only person in this room without a clear job description.",
    },
  },
  {
    id: "snake",
    label: "Snake",
    at: { x: 27, y: 80 },
    size: { w: 16, h: 12 },
    canon: {
      what: "An emerald-green snake, coiled on the flagstones to your left.",
      looks: "Darker green markings down its back. Unblinking. Extremely settled.",
      origin: "It was here first and has made that clear without moving.",
      gag: "You have decided it is friendly. It has decided nothing of the sort.",
    },
  },
  {
    id: "monkey",
    label: "Monkey",
    at: { x: 9, y: 30 },
    size: { w: 12, h: 16 },
    canon: {
      what: "A small brown monkey on top of a broken pillar, far left.",
      looks: "Sits with the posture of something that owns the building.",
      origin: "Followed you in three chambers ago. You have stopped questioning it.",
      gag: "It has stolen something of yours and neither of you is mentioning it.",
    },
  },
  {
    id: "parrot",
    label: "Parrot",
    at: { x: 62, y: 16 },
    size: { w: 13, h: 13 },
    canon: {
      what: "A scarlet-red parrot with blue and yellow wings, circling overhead.",
      looks: "Never lands. Flies laps of the hall like it is being paid by the hour.",
      origin: "Belongs to nobody here, which it announces regularly.",
      gag: "It repeats things you said hours ago, slightly wrong, at the worst moment.",
    },
  },
  {
    id: "keeper",
    label: "Temple keeper",
    at: { x: 61, y: 52 },
    size: { w: 9, h: 24 },
    canon: {
      what: "A robed temple keeper standing behind the stone altar.",
      looks: "Deep brown hood, face mostly shadow, hands folded with great patience.",
      origin: "Has apparently been here longer than the vines have.",
      gag: "Answers every question cryptically, then ruins it with a mundane complaint.",
    },
  },
  {
    id: "merchant",
    label: "Merchant",
    at: { x: 88, y: 52 },
    size: { w: 11, h: 26 },
    canon: {
      what: "A travelling merchant at a stall on the right, in a pale cream tunic.",
      looks: "Bearded, head wrapped, permanently mid-sales-pitch.",
      origin: "Nobody can explain how a market stall got into a sealed temple.",
      gag: "Accepts an implausible range of modern payment methods. Not cash.",
    },
  },
  {
    id: "altar",
    label: "Altar",
    at: { x: 45, y: 62 },
    size: { w: 13, h: 15 },
    canon: {
      what: "A grey stone altar in the middle of the hall.",
      looks: "Worn flat on top, carved sides, a shallow channel around the edge.",
      origin: "Older than the room built around it, which is saying something.",
      gag: "The channel is for drainage. You are choosing not to ask drainage of what.",
    },
  },
  {
    id: "stall",
    label: "Market stall",
    at: { x: 78, y: 68 },
    size: { w: 18, h: 18 },
    canon: {
      what: "A wooden market stall, its counter covered in pots and bottles.",
      looks: "Clay pots, glass bottles, small trinkets, all suspiciously well dusted.",
      origin: "Assembled inside a sealed temple by means nobody will explain.",
      gag: "Half the stock is clearly not from this century, or this continent.",
    },
  },
  {
    id: "glyphs",
    label: "Carvings",
    at: { x: 30, y: 38 },
    size: { w: 12, h: 14 },
    canon: {
      what: "Carved glyphs cut into the stone wall, glowing faintly orange.",
      looks: "Angular, deep-cut, lit from inside the stone rather than by the torches.",
      origin: "Predate every script you can read, which is a number you are proud of.",
      gag: "You can translate about a third, and that third is mostly warnings.",
    },
  },
  {
    id: "torch",
    label: "Torch",
    at: { x: 19, y: 30 },
    size: { w: 8, h: 12 },
    canon: {
      what: "A wooden torch in a wall bracket, burning warm orange.",
      looks: "Flame leans oddly, as if there is a draught from somewhere sealed.",
      origin: "Already lit when you arrived. All of them were.",
      gag: "Nobody has answered who lit them, and you have stopped asking.",
    },
  },
  {
    id: "vines",
    label: "Vines",
    at: { x: 5, y: 60 },
    size: { w: 10, h: 34 },
    canon: {
      what: "Mossy green vines swallowing the stone block walls.",
      looks: "Thick as rope near the floor, thinning to threads across the ceiling.",
      origin: "Came in through cracks and stayed, which is more than most visitors manage.",
      gag: "They are growing towards the torchlight, which should not be possible down here.",
    },
  },
];
