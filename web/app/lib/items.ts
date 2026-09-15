/**
 * Jane's inventory.
 *
 * Icons are generated in the same voxel style as the scene, then cached on disk
 * like every other asset — an item is the same picture every time, so it is
 * generated once and reused.
 */

export type Item = {
  id: string;
  label: string;
  /** What the icon shows. */
  look: string;
  /**
   * Fixed facts. Jane improvises a different line every time she looks at an item,
   * but she must never improvise a different STORY — so the canon is authored here
   * rather than left to the model, which would happily invent a new provenance on
   * every call. The model riffs; these facts do not move.
   */
  canon: {
    /** What the thing actually is. */
    what: string;
    /** Its condition and quirks — the details she can describe differently each time. */
    looks: string;
    /** Where she got it. This is the fact that must never change. */
    from: string;
    /** The running joke to keep circling back to. */
    gag: string;
  };
};

export const ITEMS: Item[] = [
  {
    id: "rope",
    label: "Rope",
    look: "a coiled brown hemp rope lasso",
    canon: {
      what: "Forty feet of hemp rope she insists on calling a lasso.",
      looks: "Frayed at one end, scorched at the other, knotted in the middle where it snapped once.",
      from: "Came free with a tent she bought in Marrakesh. She kept the rope and lost the tent.",
      gag: "She has never once successfully lassoed anything, and will not be taking questions.",
    },
  },
  {
    id: "phone",
    label: "Phone",
    look: "a modern black smartphone with a glowing screen",
    canon: {
      what: "A smartphone. In a temple with no signal, for the last nine days.",
      looks: "Cracked top-left corner, screen permanently at three percent battery.",
      from: "Left behind by a tourist on a bus outside Cairo. She fully intends to return it.",
      gag: "One bar appears only when she is somewhere genuinely dangerous.",
    },
  },
  {
    id: "chicken",
    label: "Chicken",
    look: "a bright yellow rubber chicken toy",
    canon: {
      what: "A rubber chicken. Squeaks. Yellow, aggressively so.",
      looks: "One eye rubbed off, beak slightly melted from being left near a campfire.",
      from: "A leaving present from a colleague who thought it was funny. It was.",
      gag: "It has solved more archaeological puzzles than her doctorate has.",
    },
  },
  {
    id: "hoverboard",
    label: "Hoverboard",
    look: "a hot-pink hoverboard with a yellow underside and no wheels",
    canon: {
      what: "A hot-pink board that hovers. No wheels. Do not ask how.",
      looks: "Yellow underside, scuffed deck, covered in stickers from places that do not exist yet.",
      from: "Traded a kid in a car park for it. He seemed in a tremendous hurry.",
      gag: "It point-blank refuses to hover over water, which she found out the hard way.",
    },
  },
  {
    id: "cube",
    label: "Cube",
    look: "a colourful three-by-three twisting puzzle cube",
    canon: {
      what: "A three-by-three twisting puzzle cube. Six colours. One correct state.",
      looks: "Corner sticker peeling, green face almost done, has been almost done for years.",
      from: "Airport gift shop, 1987. She has been working on it in transit ever since.",
      gag: "She has never solved it, and at least one sticker has been relocated by hand.",
    },
  },
  {
    id: "pearl",
    label: "Pearl",
    look: "a large glowing golden pearl",
    canon: {
      what: "A golden pearl the size of a plum that glows from the inside.",
      looks: "Warm to the touch, faintly humming, brighter whenever something bad is about to happen.",
      from: "Prised out of a stone idol two temples ago. The idol did not consent.",
      gag: "Almost certainly cursed. She is choosing not to think about that.",
    },
  },
];

/** Jane's remarks run a little longer than NPC replies, but still fit two lines. */
export const MAX_INSPECT = 90;

/** Empty slots, so the bar reads as an inventory rather than a toolbar. */
export const EMPTY_SLOTS = 3;

/** Icon prompt — matched to the scene's look so items belong to the same world. */
export function itemIconPrompt(item: { label: string; look: string }): string {
  return (
    `A single game inventory item icon: ${item.look}. ` +
    "Centred, filling most of the frame, seen straight on. " +
    "Chunky stylized near-pixel voxel look, low-resolution retro adventure-game aesthetic, " +
    "warm torchlight, on a plain flat very dark brown background. " +
    "No hands, no characters, no background scenery. " +
    "No text, no lettering, no numbers, no border, no frame, no UI."
  );
}
