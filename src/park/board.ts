/**
 * The board, as constants.
 *
 * Everything in this scene is measured in **board units**, on a fixed 360 x 640 portrait field
 * that is letterboxed into whatever viewport it lands in. Nothing here is a pixel and nothing
 * scales with the window, which is the whole point: the game has to be the same game on a phone,
 * on an iPad in a keyboard case and on a desktop, or "you stopped 4 units off centre" means a
 * different thing to every player and the per-level comparison this scene was shaped around
 * cannot be made. `park-view.ts` owns the one transform that maps this space onto the canvas.
 *
 * The bands below divide the 640 vertically. They are stated once, here, because three files
 * draw into them and a band that drifts is a layout that overlaps.
 */

export const BOARD_W = 360;
/**
 * 360 x 512, and it used to be 360 x 640.
 *
 * A hundred units of that went on a precision ruler above the mat — the level's clearance blown
 * up to the width of the board, with a tick for where the car stopped. It was the most
 * information-dense thing on the screen and it was not legible: a second, magnified coordinate
 * space stacked over the real one, which people read as a progress bar or a loading strip. The
 * mat below it says the same thing in the only frame that matters, which is the car sitting
 * between two painted lines.
 *
 * The board came in rather than the space being left empty, and that is worth understanding:
 * the street spans 26..334 of the 360, so **the scene's size is set by the board's width**. On a
 * phone the board is width-bound and the car is exactly as big either way — the change only
 * centres the content and letterboxes above and below it. On anything height-bound (a desktop
 * window, an iPad in landscape) a shorter board scales up, and everything is about a quarter
 * larger than it was. Making the board taller cannot make the car bigger; only making it *wider*
 * could, and that would mean re-tuning the whole ladder.
 */
export const BOARD_H = 512;

/** LEVEL / TOTAL OFF / BEST LEVEL. */
export const HEADER_TOP = 0;
export const HEADER_BOTTOM = 100;

/** The play mat: the street, the bay, the buffer block and the car. */
export const MAT_TOP = 106;
export const MAT_BOTTOM = 316;

/** The verdict: the rating word and the distance. */
export const VERDICT_TOP = 322;
export const VERDICT_BOTTOM = 450;

/** What to do next. */
export const PROMPT_TOP = 450;

// --- the track -------------------------------------------------------------------------------
// The road's two ends. Everything about a level's geometry is solved against these, so the
// track is never wider than the mat it is painted on.

export const TRACK_X0 = 26;
export const TRACK_X1 = 334;

export const ROAD_TOP = 162;
export const ROAD_BOTTOM = 258;
/** Where the tyres touch. The car is drawn upward from here, so it always sits *on* the road. */
export const GROUND_Y = 248;

/**
 * The car is 58 long on a 360-wide board — 16% of the width, which is what "chunky toy" means in
 * numbers.
 *
 * **`CAR_HALF` is the number the whole game is sized against.** Parking means getting the *whole
 * car* between the bay's lines, so a bay narrower than `CAR_LENGTH` is one no car can ever be
 * parked in, and every bay is `CAR_HALF` plus the round's clearance either side. It was briefly
 * the tyres instead — `WHEEL_X + WHEEL_R`, 27.5 — which was 1.5 units narrower than the
 * bodywork, so the bumper legitimately overhung a bay the game called parked and the rule needed
 * a sentence to explain. The car's own outline needs none: you can see whether it is between the
 * lines.
 */
export const CAR_LENGTH = 58;
export const CAR_HALF = CAR_LENGTH / 2;

/**
 * The axles, and the tyres on them. Symmetric about the car's centre, and **both must stay
 * within `CAR_HALF`** — the body is what the bay is measured against, so a wheel poking out past
 * the bodywork would be a visible part of the car outside a bay the game called parked.
 * `dev/park.mjs` asserts it.
 */
export const WHEEL_X = 16.5;
export const WHEEL_R = 11;

/**
 * Clear tarmac between the far line of the bay and the face of the buffer block. **It is as
 * small as the geometry allows, and that is the point.**
 *
 * With the whole car measured, the bumper and the judged edge are the same line, so the only
 * hard floor is "greater than nothing": park with the nose exactly on the far line and the block
 * must still be ahead of it. 4 makes that a visible sliver of tarmac rather than a rounding
 * error, and gives four units between "your nose crossed the line" and "your nose hit the wall".
 *
 * It was 24, and crashing was then almost impossible — you had to overshoot the bay by most of a
 * car length to find the block, so in practice every failure was a miss and the block was
 * scenery. At 4 the rule is simply **stop short and you miss, go past and you hit it**: four
 * units is sixteen milliseconds at round five's speed. Failing long and failing short are the
 * two real ways to lose, they cost differently (see `CRASH_PENALTY`), and the cheaper one is the
 * early tap — so the whole session is played a fraction early on purpose, which is exactly how
 * you park a real car towards a wall.
 *
 * Because the block is fixed to the bay's far line and the bay narrows every round, the space
 * you may stop in closes from the left as the session goes on, with the wall staying put.
 */
export const BLOCK_GAP = 4;

/** The bay never starts so close to the start line that the car is already sitting in it. */
export const BAY_CLEAR = 10;

/** The car starts with its tail on the start line. */
export const START_X = TRACK_X0 + CAR_HALF;

/** The buffer block at the end of the track. It stands at `failLine + CAR_HALF`, so the bumper
 *  touches it at exactly the moment the car's centre crosses the fail line: overshooting the
 *  target and crashing are then the same event, seen rather than computed. */
export const BUFFER_W = 14;

/** The furthest a fail line may be placed and still leave the block on the road. */
export const MAX_FAIL_LINE = TRACK_X1 - CAR_HALF - BUFFER_W;

// --- palette ---------------------------------------------------------------------------------
// Warm, and deliberately unlike the rest of the site. The three WebGL scenes are cold blue-grey
// with a planet in them; this is a toy on a play mat, and it should not look like it came out of
// the same box.

export const COLORS = {
  /** Outside the board — the site's own background, so the letterbox reads as the page. */
  surround: '#16181c',
  board: '#191a1e',
  mat: '#d9b98c',
  matShade: '#c9a877',
  road: '#5a5f66',
  roadEdge: '#43474d',
  dash: '#e7e3d8',
  zone: '#ffd23f',
  zoneDark: '#1b1a18',
  smoke: '#cfc7b8',
  wood: '#a8703c',
  woodDark: '#7d5029',
  body: '#e2453a',
  bodyLight: '#f26a5f',
  bodyDark: '#a52a22',
  glass: '#bfe4f5',
  tyre: '#26272b',
  hub: '#e8e6e1',
  lamp: '#ffe9a8',
  text: '#f2efe8',
  textDim: '#8a8f98',
  good: '#7fe3c0',
  bad: '#ff6b5e'
} as const;

/** A rounded rectangle without `ctx.roundRect`, which Safari only grew in 16. The iPad is a
 *  target and this is four lines. */
export function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
