/**
 * The scene bible.
 *
 * One canonical description of the world, reused by the opening still, the H3
 * session, every steer and every keyframe edit. It is deliberately specific about
 * COLOUR and POSITION: a bare noun like "a parrot" gets re-rolled on every
 * generation — one chunk returns a red parrot, the next a blue one — and the same
 * goes for a snake, a robe or a stall. Naming the attribute pins it.
 *
 * Positions are given relative to Montana Jane so they survive camera movement.
 */

/** Who is in the scene, exactly. Every entry names a colour and a place. */
const CAST =
  "Montana Jane is a young female archaeologist in a worn dark-brown leather jacket, " +
  "a tan wide-brimmed explorer hat, khaki trousers and brown boots, standing in the middle " +
  "of the hall. " +
  "An emerald-green snake with darker green markings is coiled on the stone floor to her LEFT, " +
  "in the foreground. " +
  "A small brown monkey sits on top of a broken grey stone pillar on the FAR LEFT. " +
  "A scarlet-red parrot with blue and yellow wing feathers flies in the air ABOVE her, " +
  "slightly to the right. " +
  "A temple keeper in a long hooded brown robe stands behind a grey stone altar in the CENTRE, " +
  "beyond Jane. " +
  "A bearded travelling merchant in a pale cream tunic and head wrap stands at a wooden market " +
  "stall on the RIGHT, its counter covered with clay pots, glass bottles and small trinkets.";

/** Where it happens, equally pinned. */
const SETTING =
  "The setting is the torchlit rectangular stone hall of an ancient overgrown jungle temple: " +
  "grey stone block walls covered in mossy green vines, glowing orange carved glyphs on the walls, " +
  "wooden wall torches with warm orange flames, and worn stone floor slabs.";

/** How it looks. Restated everywhere, because style drifts fastest of all. */
const LOOK =
  "Chunky stylized near-pixel voxel look, low-resolution retro adventure-game aesthetic, " +
  "warm flickering torchlight, floating dust motes, cinematic.";

/**
 * The model happily paints fake game chrome — hearts, an inventory bar, subtitles —
 * which collides with our own UI. Say no explicitly.
 */
/**
 * The scene's own soundtrack is a generated ambience loop that plays continuously
 * in the page, so the model must supply diegetic sound only. Left to itself it
 * scores the video, and its music starts and stops with each chunk — which is
 * what made the audio come and go.
 */
const SOUND =
  "Diegetic sound only: crackling torches, footsteps on stone, distant dripping water, " +
  "birds and animal calls, faint wind through the temple. " +
  "No music, no soundtrack, no score, no singing, no instruments of any kind.";

const NO_HUD =
  "Clean cinematic frame with no interface: no HUD, no health bar, no hearts, no inventory bar, " +
  "no icons, no subtitles, no captions, no text or lettering anywhere in the image.";

/** Prompt for the still that fills the frame before the stream arrives. */
export const OPENING_FRAME_PROMPT =
  `A continuous cinematic third-person adventure. ${CAST} ${SETTING} ${LOOK} ${NO_HUD}`;

/** Prompt for the H3 realtime session (`configure`). */
export const OPENING_SCENE_PROMPT =
  `A continuous cinematic third-person adventure. ${CAST} ${SETTING} ` +
  `Slow tracking camera. ${LOOK} ${NO_HUD} ${SOUND}`;

/** Sent once after a few idle seconds so Jane waits naturally instead of drifting. */
export const IDLE_PROMPT =
  "Montana Jane stands still and looks around the temple, waiting, calm idle, " +
  "gentle torchlight flicker, slow subtle camera drift.";

/**
 * Re-asserted on EVERY steer.
 *
 * A `prompt` message replaces the direction outright — it is not appended to the
 * opening scene. Sending the bare words "Pet snake" therefore describes a snake
 * and nothing else, and the model happily renders a photoreal snake in a void.
 * Restating the whole bible on each direction is what keeps the shot continuous.
 */
const CONTINUITY =
  "Continue the same unbroken shot, in the same place, with the same characters, " +
  "all of them keeping exactly the appearance described here. " +
  `${CAST} ${SETTING} ` +
  "Hold the exact same camera: the same position, angle, height, focal length and framing as the " +
  "frame before, as one single continuous locked-off take. " +
  "Do not cut, do not change shot, do not jump to a new angle, do not zoom or re-frame, and do not " +
  "restart the scene. Do not recolour or redesign any character, prop or costume. " +
  "Do not change the art style and do not become photorealistic or live-action.";

/**
 * Wraps a player's words into a full direction.
 *
 * The player types "Pet snake"; the model needs the whole world restated around it.
 */
export function composeDirection(direction: string): string {
  const said = direction.trim().replace(/\s+/g, " ");
  return (
    `${CONTINUITY} ` +
    `Now, as one clear continuous beat of action: ${said}. ` +
    `Montana Jane performs this visibly and deliberately, staying in frame. ` +
    `${LOOK} ${NO_HUD} ${SOUND}`
  );
}

/**
 * Turns a player direction into an edit instruction for the CURRENT frame.
 *
 * The edit model keeps everything it is not told to change, which is the whole
 * point: the background, the cast and the voxel style survive by construction
 * rather than by persuasion. The result is then pinned as the exact frame the
 * video chunk must land on.
 */
export function keyframeEditPrompt(direction: string): string {
  const said = direction.trim().replace(/\s+/g, " ");
  return (
    `Edit this frame so that: ${said}. ` +
    "Change ONLY what that action requires — the pose and position of the characters involved. " +
    "Keep the camera in the exact same position and angle, with the same framing and perspective. " +
    "Keep the background pixel-identical: the same stone hall, the same vines, glyphs, torches, " +
    "altar and market stall, in the same places, with the same lighting. " +
    "Every character keeps exactly this appearance, with no recolouring and no redesign. " +
    `${CAST} ` +
    `${NO_HUD} ` +
    "Keep the identical chunky near-pixel voxel art style. Do not make it photorealistic."
  );
}

export const IMAGE_MODEL = "fal-ai/nano-banana-2";
export const EDIT_MODEL = "fal-ai/nano-banana-pro/edit";
