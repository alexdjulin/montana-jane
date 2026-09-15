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
  /** What Jane does when the player uses it, fed to the director as an action. */
  use: string;
};

export const ITEMS: Item[] = [
  {
    id: "rope",
    label: "Rope",
    look: "a coiled brown hemp rope lasso",
    use: "takes a coiled rope from her satchel and swings it like a lasso",
  },
  {
    id: "phone",
    label: "Phone",
    look: "a modern black smartphone with a glowing screen",
    use: "pulls a modern smartphone from her pocket and holds it up to take a photo",
  },
  {
    id: "chicken",
    label: "Chicken",
    look: "a bright yellow rubber chicken toy",
    use: "produces a bright yellow rubber chicken and waves it around",
  },
  {
    id: "pearl",
    label: "Pearl",
    look: "a large glowing golden pearl",
    use: "holds up a large glowing golden pearl, its light filling the hall",
  },
];

/** Empty slots, so the bar reads as an inventory rather than a toolbar. */
export const EMPTY_SLOTS = 3;

/** Icon prompt — matched to the scene's look so items belong to the same world. */
export function itemIconPrompt(item: Item): string {
  return (
    `A single game inventory item icon: ${item.look}. ` +
    "Centred, filling most of the frame, seen straight on. " +
    "Chunky stylized near-pixel voxel look, low-resolution retro adventure-game aesthetic, " +
    "warm torchlight, on a plain flat very dark brown background. " +
    "No hands, no characters, no background scenery. " +
    "No text, no lettering, no numbers, no border, no frame, no UI."
  );
}
