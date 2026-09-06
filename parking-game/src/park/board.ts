/**
 * The board, as constants.
 *
 * Everything in this scene is measured in **board units**, on a fixed 360 x 512 portrait field
 * that is letterboxed into whatever viewport it lands in. Nothing here is a pixel and nothing
 * scales with the window, which is the whole point: the game has to be the same game on a phone,
 * on an iPad in a keyboard case and on a desktop, or "you stopped 4 units off centre" means a
 * different thing to every player and the per-level comparison this scene was shaped around
 * cannot be made. `park-view.ts` owns the one transform that maps this space onto the canvas.
 *
 * **The scene is drawn from above.** It was side-on for a long time and that was the mistake: seen
 * from the side the action reads as *stop the truck on the mark*, which is the framing this game
 * deliberately left behind when the win condition became "the whole car between the two lines".
 * From overhead the rule needs no explaining — the gap you can see **is** the gap the car has to
 * fit into. Nothing about the geometry below changed when the camera moved; only the drawing did.
 *
 * The bands divide the 512 vertically. They are stated once, here, because three files draw into
 * them and a band that drifts is a layout that overlaps.
 */

export const BOARD_W = 360;
/**
 * 360 x 512, and it used to be 360 x 640.
 *
 * A hundred units of that went on a precision ruler above the street — the level's clearance
 * blown up to the width of the board, with a tick for where the car stopped. It was the most
 * information-dense thing on the screen and it was not legible: a second, magnified coordinate
 * space stacked over the real one, which people read as a progress bar or a loading strip. The
 * street below it says the same thing in the only frame that matters, which is the car sitting
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

/** ROUND / TOTAL OFF / BEST. */
export const HEADER_TOP = 0;
export const HEADER_BOTTOM = 92;

/** The street, seen from above: the whole scene lives between these two lines and is clipped to
 *  them, which is what lets the asphalt bleed off both sides of the board without painting over
 *  the header or the verdict. */
export const STREET_TOP = 96;
export const STREET_BOTTOM = 342;

// The street's own bands, far side first. The kerb the car parks against is the **near** one, at
// the bottom of the board, so the player looks along the street the way they would from a first
// floor window: oncoming traffic at the top, the space to park in nearest to hand.
export const BUILDING_BOTTOM = 108;
export const PAVEMENT_FAR_BOTTOM = 124;
export const KERB_FAR_BOTTOM = 129;
/** One line, two jobs: the bottom of the through lane and the top of the parking lane. Nothing
 *  ever happens in the through lane; it is there so the parking lane reads as the edge of a road
 *  rather than as a road of its own. */
export const PARKING_TOP = 203;
export const LANE_LINE_Y = 166;
/** Where the car parks, and where the bay is painted. */
export const PARKING_BOTTOM = 267;
export const KERB_NEAR_BOTTOM = 273;

/**
 * The parking lane's centreline, and so the car's own y. It was `GROUND_Y` — "where the tyres
 * touch" — while the scene was side-on; from above there is no ground line to stand on and the
 * car is drawn *around* this rather than upward from it.
 */
export const LANE_Y = 240;

/** The verdict: the rating word and the distance. */
export const VERDICT_TOP = 348;
export const VERDICT_BOTTOM = 446;

/** What to do next. */
export const PROMPT_TOP = 446;

// --- the track -------------------------------------------------------------------------------
// The road's two ends. Everything about a level's geometry is solved against these, so the
// track is never wider than the board it is painted on. **The asphalt is drawn full-bleed, 0 to
// 360** — these are where the car may be, not where the paint stops.

export const TRACK_X0 = 26;
export const TRACK_X1 = 334;

/**
 * The car is 58 long on a 360-wide board — 16% of the width, which is what "chunky toy" means in
 * numbers.
 *
 * **`CAR_HALF` is the number the whole game is sized against.** Parking means getting the *whole
 * car* between the bay's lines, so a bay narrower than `CAR_LENGTH` is one no car can ever be
 * parked in, and every bay is `CAR_HALF` plus the round's clearance either side. It was briefly
 * the tyres instead — which were narrower than the bodywork, so the bumper legitimately overhung
 * a bay the game called parked and the rule needed a sentence to explain. The car's own outline
 * needs none: you can see whether it is between the lines.
 */
export const CAR_LENGTH = 58;
export const CAR_HALF = CAR_LENGTH / 2;

/**
 * How wide the car is across the street. **This is free**: the judged axis is x and only x, so
 * the car's width is a drawing decision and nothing else — it is what makes the shape from above
 * a car rather than a stripe. 30 on a 58-long body is a little wide for a real saloon and exactly
 * right for a toy one.
 */
export const CAR_WIDTH = 30;
export const CAR_HALF_W = CAR_WIDTH / 2;

/**
 * The axles, and the tyres on them. Symmetric about the car's centre, and **both must stay
 * within `CAR_HALF`** — the body is what the bay is measured against, so a wheel poking out past
 * the bodywork would be a visible part of the car outside a bay the game called parked.
 * `dev/park.mjs` asserts it.
 *
 * `WHEEL_R` is the tyre's half-length **along the street**, which from directly above is what a
 * wheel's radius looks like. It was 11 while the scene was side-on and a wheel was a circle; a
 * 22-unit tyre on a 58-unit car reads as a tractor from overhead. `WHEEL_Y` is the axle's
 * half-track, set so the tyres straddle the body's sill.
 */
export const WHEEL_X = 16.5;
export const WHEEL_R = 5.5;
export const WHEEL_Y = 12.5;

/**
 * Clear tarmac between the far line of the bay and the rear bumper of the car parked in front.
 * **It is as small as the geometry allows, and that is the point.**
 *
 * With the whole car measured, the bumper and the judged edge are the same line, so the only
 * hard floor is "greater than nothing": park with the nose exactly on the far line and the car
 * ahead must still be beyond it. 4 makes that a visible sliver of tarmac rather than a rounding
 * error, and gives four units between "your nose crossed the paint" and "your nose is in
 * somebody's boot".
 *
 * It was 24, and crashing was then almost impossible — you had to overshoot the bay by most of a
 * car length, so in practice every failure was a miss and the thing at the end was scenery. At 4
 * the rule is simply **stop short and you miss, go past and you hit it**: four units is sixteen
 * milliseconds at round five's speed. Failing long and failing short are the two real ways to
 * lose, they cost differently (see `CRASH_PENALTY`), and the cheaper one is the early tap — so
 * the whole session is played a fraction early on purpose, which is exactly how you park a real
 * car towards the one in front.
 *
 * Because the car ahead is fixed to the bay's far line and the bay narrows every round, the space
 * you may stop in closes from the left as the session goes on, with the obstacle staying put.
 */
export const BLOCK_GAP = 4;

/** The bay never starts so close to the start line that the car is already sitting in it. */
export const BAY_CLEAR = 10;

/** The car starts with its tail on the left end of the track. */
export const START_X = TRACK_X0 + CAR_HALF;

/**
 * The judged footprint of the obstacle at the end of the bay, and **not how much of it is
 * drawn**. Its face stands at `failLine + CAR_HALF`, so the bumper touches it at exactly the
 * moment the car's centre crosses the fail line: overshooting the bay and hitting something are
 * then the same event, seen rather than computed.
 *
 * Only the face is ever judged, so the car parked there is drawn a full 58 units long from that
 * face and clipped to the board — which is why the asphalt has to run to the edges. Making this
 * a real car length instead would cost 44 units of usable track, move every bay through
 * `hash01()` and invalidate every stored record for the sake of a number nothing reads.
 */
export const BUFFER_W = 14;

/** The furthest a fail line may be placed and still leave the obstacle on the road. */
export const MAX_FAIL_LINE = TRACK_X1 - CAR_HALF - BUFFER_W;

// --- palette ---------------------------------------------------------------------------------
// Warm daylight on a city street, and deliberately unlike the rest of the site. The three WebGL
// scenes are cold blue-grey with a planet in them; this is a sunny kerbside at eleven in the
// morning, and it should not look like it came out of the same box.
//
// Two rules hold the whole palette together:
//
//  - **The bay's paint is white.** It used to be the same yellow as the car, which is two ways of
//    saying nothing; the two lines have to be the loudest thing on the board because they are the
//    only question it asks.
//  - **Red is reserved for failure.** No red cars, no postbox, no red awning. The crossed line and
//    the verdict word are the only red on the street, which is the entire reason they read.

export const COLORS = {
  /** Outside the board — the site's own background, so the letterbox reads as the page. */
  surround: '#16181c',
  board: '#1b1a18',

  asphalt: '#6e6a64',
  asphaltDark: '#5d5952',
  asphaltLight: '#7c7871',
  /** The dashed line down the through lane. Dimmer than the bay's paint, always. */
  lanePaint: '#e6dfcf',
  /** The bay: two bold lines and a wash between them. */
  bayPaint: '#f8f3e7',
  skid: '#3c3934',

  kerb: '#cec5b3',
  kerbEdge: '#a29885',
  pavement: '#c5baa5',
  pavementSeam: '#b0a48d',
  building: '#8c8171',
  buildingDark: '#71685b',
  roofCap: '#9e9280',
  bench: '#8a7c66',
  benchDark: '#6b5f4c',

  /** The taxi. */
  body: '#f5c433',
  bodyLight: '#ffd964',
  bodyDark: '#d09b14',
  trim: '#2c2823',
  chequer: '#f6f1e4',
  glass: '#a9cee0',
  sign: '#fdf6e3',
  lamp: '#fff0c2',
  /** Tail lights are amber rather than red, because red is spoken for. */
  tail: '#d2761f',
  hub: '#e3ded4',
  tyre: '#2a2724',

  /** The car parked in front — the thing you crash into. Teal, so it can never be mistaken for
   *  the one you are driving. */
  ahead: '#336f6b',
  aheadDark: '#24534f',
  aheadGlass: '#8fbccb',

  tree: '#5f8a54',
  treeDark: '#4a6c42',
  furniture: '#5a6068',
  bird: '#5c6470',

  smoke: '#d8d2c6',
  /** Grit off the tyres. */
  grit: '#9a948a',

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
