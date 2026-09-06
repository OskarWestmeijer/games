/**
 * Everything this scene draws.
 *
 * All of it in board units (see `board.ts`), on a context `park-view.ts` has already transformed,
 * so nothing in here knows about pixels, device pixel ratios or the size of the window. The
 * split is the same one `station/` draws between form and placement: this file knows what a car
 * looks like from above, and nothing about when it moves.
 *
 * **Drawn from overhead.** The scene was side-on until it wasn't, and the move is the whole
 * redesign: from above, "the whole car between the two lines" needs no explaining, because the
 * gap you can see is the gap the car has to fit into. Two consequences run through this file —
 * there is no gravity in a plan view, so nothing arcs; and the car's *width* is free while its
 * *length* is the thing the game is scored on, which is why every transform applied to the car
 * touches y and never x.
 *
 * The look is chunky on purpose — fat rounded corners, flat fills, no gradients thinner than a
 * whole panel, no hairlines. A precision game read at arm's length on a phone has to be legible
 * before it is pretty, and a toy is the one thing that gets to be both.
 */

import {
  BOARD_H,
  BOARD_W,
  BUILDING_BOTTOM,
  CAR_HALF,
  CAR_HALF_W,
  COLORS,
  HEADER_BOTTOM,
  KERB_FAR_BOTTOM,
  KERB_NEAR_BOTTOM,
  LANE_LINE_Y,
  LANE_Y,
  PARKING_BOTTOM,
  PARKING_TOP,
  PAVEMENT_FAR_BOTTOM,
  PROMPT_TOP,
  STREET_BOTTOM,
  STREET_TOP,
  VERDICT_TOP,
  WHEEL_R,
  WHEEL_X,
  WHEEL_Y,
  rrect
} from './board';
import { bufferX, ROUND_COUNT, type Bay, type LevelSpec } from './levels';
import type { Effects } from './effects';

export type Phase = 'ready' | 'rolling' | 'judging' | 'results';
/** The three that score the distance, and the two that score `MISS_PENALTY`. None ends the
 *  session: every session plays all five bays. */
export type Rating = 'PERFECT' | 'GREAT' | 'CLOSE' | 'MISSED' | 'CRASHED';

/** What one round of the session ended up being worth. */
export interface RoundScore {
  /** What it added to the total. The distance for a park, `MISS_PENALTY` for a failure. */
  score: number;
  rating: Rating;
  /** Whether it beat the stored best for this round. */
  best: boolean;
}

/** What one stop was worth. `error` *is* what it was worth — see `judge()` in `park-view.ts`. */
export interface StopResult {
  round: number;
  stopX: number;
  /** Distance from the bay's centre, in board units. The score, and the comparable number. */
  error: number;
  /** The word on the screen. Feedback, derived from `error`; it is not a second score. */
  rating: Rating;
  personalBest: boolean;
  bayCentre: number;
  /** The band the car's centre had to land in for the whole car to be inside the bay. */
  clearance: number;
}

/** Everything the drawing needs, and nothing it can change. */
export interface Scene {
  phase: Phase;
  phaseTime: number;
  spec: LevelSpec;
  carX: number;
  /** How much the body is splayed sideways under the brakes. **Lateral and only lateral** — see
   *  `drawCar`. */
  carSquash: number;
  rolling: boolean;
  /** Which round is up, 0-based. */
  round: number;
  /** The session's total so far. Lower is better. */
  totalOff: number;
  /** The best session total ever, or null before one has been finished. */
  bestTotal: number | null;
  /** Whether the session that just finished was a new best. */
  sessionBest: boolean;
  /** One entry per round played so far, for the results screen. */
  scores: RoundScore[];
  result: StopResult | null;
  /** Whether the primary pointer is a touchscreen — the prompt's wording, drawn rather than
   *  swapped in CSS, because it has to live inside the letterboxed board. */
  coarse: boolean;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** Letter-spaced small caps, drawn a glyph at a time: `ctx.letterSpacing` is too new to rely on
 *  with an iPad in the target list, and these labels want the spacing to read as labels. */
function spaced(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  gap: number,
  align: 'left' | 'center' | 'right' = 'left'
) {
  const chars = [...str];
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width + gap, -gap);
  let cx = align === 'left' ? x : align === 'center' ? x - width / 2 : x - width;
  const prior = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + gap;
  }
  ctx.textAlign = prior;
}

// --- the whole board -------------------------------------------------------------------------

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, effects: Effects) {
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  // The results are their own screen, not a panel over the street. A summary laid on top of the
  // parked car covers the one thing worth looking at — that mistake has been made here once
  // already; see the note in CLAUDE.md. By the time this shows, the last round's verdict has
  // been and gone, so there is nothing underneath left to see.
  if (scene.phase === 'results') {
    drawResults(ctx, scene);
    drawPrompt(ctx, scene);
    return;
  }

  drawHeader(ctx, scene);
  drawStreet(ctx, scene, effects);
  drawVerdict(ctx, scene);
  drawPrompt(ctx, scene);
}

// --- header ----------------------------------------------------------------------------------

function drawHeader(ctx: CanvasRenderingContext2D, scene: Scene) {
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = COLORS.textDim;
  setFont(ctx, 12);
  spaced(ctx, 'ROUND', 24, 38, 2.4);
  // "TOTAL OFF", not "SCORE": the number under it is a distance, and it is the one thing on the
  // board where smaller is better. A label that reads as an amount of *error* says which way
  // round it goes without a line of text explaining it.
  spaced(ctx, 'TOTAL OFF', BOARD_W - 24, 38, 2.4, 'right');

  ctx.fillStyle = COLORS.text;
  setFont(ctx, 42, 800);
  ctx.textAlign = 'left';
  // "3/5", not "3": the denominator is the whole reason the score means anything, so it is on
  // screen the entire time rather than only at the end.
  ctx.fillText(`${scene.round + 1}/${ROUND_COUNT}`, 24, 76);
  ctx.textAlign = 'right';
  ctx.fillText(scene.totalOff.toFixed(1), BOARD_W - 24, 76);

  ctx.fillStyle = COLORS.textDim;
  setFont(ctx, 12, 600);
  ctx.textAlign = 'center';
  if (scene.bestTotal !== null) {
    spaced(ctx, `BEST ${scene.bestTotal.toFixed(1)}`, BOARD_W / 2, 74, 1.6, 'center');
  }
  ctx.textAlign = 'left';

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, HEADER_BOTTOM - 8);
  ctx.lineTo(BOARD_W - 24, HEADER_BOTTOM - 8);
  ctx.stroke();
}

// --- the street ------------------------------------------------------------------------------

/**
 * The scene, in draw order, clipped to its own band.
 *
 * **The asphalt runs the full width of the board and off both edges**, which reverses an earlier
 * rule that drew the road only as far as the obstacle at the end of it. That rule existed because
 * a wooden block standing in the middle of a road reads as an obstacle rather than as the end of
 * one — but the thing at the end is a parked car now, and a street that carries on past a parked
 * car is the most ordinary sight there is. It is also what lets that car be drawn a full length
 * long and simply run out of frame, instead of being cut off by a road that stops around it.
 */
function drawStreet(ctx: CanvasRenderingContext2D, scene: Scene, effects: Effects) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, STREET_TOP, BOARD_W, STREET_BOTTOM - STREET_TOP);
  ctx.clip();

  // Which side of the bay the car hangs over, or 0 if the round is still open or was parked.
  // -1 is the tail over the near line, +1 the nose over the far one; a crash is always +1
  // because the car in front is only ever ahead.
  const failure = scene.result && failed(scene.result.rating) ? scene.result : null;
  const outside: -1 | 1 | 0 = failure ? (failure.stopX < failure.bayCentre ? -1 : 1) : 0;

  drawPavements(ctx);
  // Before the asphalt, so nothing on the pavement can creep onto the road.
  drawProps(ctx);
  drawAsphalt(ctx);
  // Rubber goes under the paint. In life it would be the other way round, but the two lines are
  // the only question this picture asks and nothing is allowed to dim them.
  drawSkids(ctx, scene);
  drawBay(ctx, scene.spec.bay, outside);
  drawAhead(ctx, scene);
  drawStreaks(ctx, scene);
  // Under the car rather than over it: grit off the tyres and smoke off a stop belong beneath
  // the thing that threw them, and drawn on top they read as dirt on the paintwork.
  effects.draw(ctx);
  drawCar(ctx, scene, outside);

  ctx.restore();
}

function drawPavements(ctx: CanvasRenderingContext2D) {
  // The far side of the street is **roofs**, because from directly overhead that is what a row of
  // buildings is. It was drawn as shopfronts first, which is what you would see standing in the
  // road and nonsense from up here — it read as a keyboard laid along the top of the board.
  const roofH = BUILDING_BOTTOM - STREET_TOP;
  for (let i = 0, x = -18; x < BOARD_W; x += 47, i++) {
    // Neighbours are not the same colour, which is the whole of what makes this read as a row of
    // buildings rather than as one long band. Vents are shadow rather than paint: anything
    // saturated up here becomes a stripe across the top of the board and pulls the eye off the
    // only place it should be.
    ctx.fillStyle = i % 2 === 0 ? COLORS.building : COLORS.buildingDark;
    ctx.fillRect(x, STREET_TOP, 45, roofH);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x + 11, STREET_TOP + 2, 13, 4);
    ctx.fillRect(x + 31, STREET_TOP + 3, 6, 5);
  }
  // The parapet: the cap of the front wall, catching the light. It is what gives the roofs an
  // edge rather than letting them bleed into the pavement.
  ctx.fillStyle = COLORS.roofCap;
  ctx.fillRect(0, BUILDING_BOTTOM - 4, BOARD_W, 4);

  ctx.fillStyle = COLORS.pavement;
  ctx.fillRect(0, BUILDING_BOTTOM, BOARD_W, PAVEMENT_FAR_BOTTOM - BUILDING_BOTTOM);
  ctx.fillStyle = COLORS.kerb;
  ctx.fillRect(0, PAVEMENT_FAR_BOTTOM, BOARD_W, KERB_FAR_BOTTOM - PAVEMENT_FAR_BOTTOM);
  ctx.fillStyle = COLORS.kerbEdge;
  ctx.fillRect(0, KERB_FAR_BOTTOM - 1.5, BOARD_W, 1.5);

  // The near kerb, which is the one the bay is against.
  ctx.fillStyle = COLORS.kerb;
  ctx.fillRect(0, PARKING_BOTTOM, BOARD_W, KERB_NEAR_BOTTOM - PARKING_BOTTOM);
  ctx.fillStyle = COLORS.kerbEdge;
  ctx.fillRect(0, PARKING_BOTTOM, BOARD_W, 1.5);
  ctx.fillStyle = COLORS.pavement;
  ctx.fillRect(0, KERB_NEAR_BOTTOM, BOARD_W, STREET_BOTTOM - KERB_NEAR_BOTTOM);

  // Slabs. One line every 30 units and two across, faint: enough to give the pavement a scale,
  // not enough to compete with anything.
  ctx.fillStyle = COLORS.pavementSeam;
  ctx.globalAlpha = 0.5;
  for (let x = 10; x < BOARD_W; x += 30) {
    ctx.fillRect(x, KERB_NEAR_BOTTOM, 1, STREET_BOTTOM - KERB_NEAR_BOTTOM);
    ctx.fillRect(x, BUILDING_BOTTOM, 1, PAVEMENT_FAR_BOTTOM - BUILDING_BOTTOM);
  }
  for (const y of [KERB_NEAR_BOTTOM + 23, KERB_NEAR_BOTTOM + 46]) ctx.fillRect(0, y, BOARD_W, 1);
  ctx.globalAlpha = 1;
}

function drawAsphalt(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLORS.asphalt;
  ctx.fillRect(0, KERB_FAR_BOTTOM, BOARD_W, PARKING_BOTTOM - KERB_FAR_BOTTOM);

  // Gutters: the tarmac goes darker where it meets each kerb, which is most of what stops the
  // road reading as a flat grey band.
  ctx.fillStyle = COLORS.asphaltDark;
  ctx.fillRect(0, KERB_FAR_BOTTOM, BOARD_W, 5);
  ctx.fillRect(0, PARKING_BOTTOM - 5, BOARD_W, 5);

  // The centre line. Fixed to the street, not scrolled past the car: this is a fixed field seen
  // whole, and a road that slid under a car standing still would be a different game.
  ctx.fillStyle = COLORS.lanePaint;
  ctx.globalAlpha = 0.5;
  for (let x = 8; x < BOARD_W; x += 34) ctx.fillRect(x, LANE_LINE_Y - 1.5, 18, 3);
  ctx.globalAlpha = 1;
}

/**
 * The depot became a street, and this is what fills it.
 *
 * All of it is **on the two pavements** and none of it moves, because the tarmac between where
 * the car starts and where the bay is has to stay empty — that is settled, twice over. From
 * above the rule costs nothing: a pavement is exactly where a bin and a tree belong.
 */
function drawProps(ctx: CanvasRenderingContext2D) {
  // A street tree in its pit. Three overlapping circles rather than one, because a single circle
  // is a green dot and three are a canopy.
  ctx.fillStyle = COLORS.buildingDark;
  rrect(ctx, 50, 294, 26, 26, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.tree;
  for (const [cx, cy, r] of [
    [63, 307, 15],
    [54, 301, 10],
    [72, 302, 10]
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.treeDark;
  ctx.beginPath();
  ctx.arc(68, 312, 11, 0, Math.PI * 2);
  ctx.fill();

  // A lamp post: from above it is a base, an arm reaching out over the kerb, and the lamp on the
  // end of it. Three shapes, and the one that says which way is up.
  ctx.fillStyle = COLORS.furniture;
  ctx.beginPath();
  ctx.arc(150, 332, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(148.5, 300, 3, 32);
  rrect(ctx, 143, 290, 15, 11, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.lamp;
  rrect(ctx, 145.5, 292.5, 10, 6, 2);
  ctx.fill();

  // A bench, slatted, in something warmer than the ironmongery around it.
  ctx.fillStyle = COLORS.bench;
  rrect(ctx, 194, 304, 34, 13, 2);
  ctx.fill();
  ctx.fillStyle = COLORS.benchDark;
  for (let i = 0; i < 3; i++) ctx.fillRect(196, 306.5 + i * 4, 30, 1.4);

  // A litter bin.
  ctx.fillStyle = COLORS.furniture;
  ctx.beginPath();
  ctx.arc(258, 308, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.buildingDark;
  ctx.beginPath();
  ctx.arc(258, 308, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // Two bollards along the kerb.
  ctx.fillStyle = COLORS.furniture;
  for (const x of [104, 336]) {
    ctx.beginPath();
    ctx.arc(x, KERB_NEAR_BOTTOM + 7, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // A pigeon, walking along the pavement. It is five shapes and it is the only living thing in
  // the scene, which is most of why it is worth the five shapes.
  const bx = 300;
  const by = 300;
  ctx.fillStyle = COLORS.bird;
  ctx.beginPath();
  ctx.ellipse(bx, by, 6.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx + 6, by - 1.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bx - 5, by - 2.5);
  ctx.lineTo(bx - 11, by - 4.5);
  ctx.lineTo(bx - 5, by + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.lamp;
  ctx.fillRect(bx + 8.6, by - 2.2, 2.6, 1.4);
}

/**
 * The parking bay: a wash of colour between two bold lines, and the whole car has to get between
 * them.
 *
 * It used to be a solid block of hazard chevrons, which was the right picture while the win
 * condition was "put the middle of the car on the mark" — a target you aim at. It is the wrong
 * picture for a bay you have to *fit into*: what matters is the two lines and the gap between
 * them. The tick in the middle is the only thing left of the old mark, and it is what a perfect
 * stop is measured from.
 */
function drawBay(ctx: CanvasRenderingContext2D, bay: Bay, crossed: -1 | 1 | 0) {
  const x = bay.centre - bay.half;
  const w = bay.half * 2;
  const top = PARKING_TOP + 3;
  const h = PARKING_BOTTOM - PARKING_TOP - 8;

  ctx.fillStyle = COLORS.bayPaint;
  ctx.globalAlpha = 0.17;
  ctx.fillRect(x, top, w, h);
  ctx.globalAlpha = 1;

  // The two lines, painted **outside** the bay rather than inside it, so the gap between their
  // inner edges is exactly the space the car has to be in. Drawn inward — which they were — the
  // paint ate five units off each end, so "between the lines" was ten units narrower than what
  // the judge measured and a marginal call could look wrong in either direction.
  const bar = 5;
  ctx.fillStyle = COLORS.bayPaint;
  ctx.fillRect(x - bar, top, bar, h);
  ctx.fillRect(x + w, top, bar, h);

  // The line the car went over, called out. Without this a marginal failure is unreadable: at the
  // last round's 4.3 units of clearance, missing by a tenth of a unit puts the bodywork a tenth
  // of a *pixel* past the paint, and the honest verdict looks like a bug.
  if (crossed !== 0) {
    ctx.fillStyle = COLORS.bad;
    ctx.fillRect(crossed < 0 ? x - bar - 2 : x + w, top - 3, bar + 2, h + 6);
  }

  // Dead centre, faint: it is what the score is measured from, not what you have to hit.
  ctx.strokeStyle = COLORS.bayPaint;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(bay.centre, top + 4);
  ctx.lineTo(bay.centre, top + h - 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

// --- the cars --------------------------------------------------------------------------------
// Both of them are the same hull with a different skin on it, drawn from above at their own
// origin with the nose at +x, so placing one is a single translate.

interface Skin {
  body: string;
  light: string;
  dark: string;
  glass: string;
  lamp: string;
  tail: string;
}

const TAXI: Skin = {
  body: COLORS.body,
  light: COLORS.bodyLight,
  dark: COLORS.bodyDark,
  glass: COLORS.glass,
  lamp: COLORS.lamp,
  tail: COLORS.tail
};

const AHEAD: Skin = {
  body: COLORS.ahead,
  light: COLORS.ahead,
  dark: COLORS.aheadDark,
  glass: COLORS.aheadGlass,
  lamp: COLORS.lamp,
  tail: COLORS.tail
};

/**
 * The outline, and the one rule that governs everything drawn inside it: **nothing may exceed
 * ±`CAR_HALF` along the street, ever.** The bay is measured against this shape, so a mirror or a
 * bumper past 29 units would be a visible part of the car outside a bay the game calls parked.
 *
 * Both quadratics have their control point *on* ±`CAR_HALF` and a Bézier stays inside the hull of
 * its control points, so the curve can round the corners off without the outline ever reaching
 * past the bumper line. `dy` offsets the whole path down the board, for the shadow.
 */
function hullPath(ctx: CanvasRenderingContext2D, dy = 0) {
  const half = CAR_HALF;
  const w = CAR_HALF_W;
  const nose = w - 3.5;
  const tail = w - 1.5;
  ctx.beginPath();
  ctx.moveTo(-half + 6, -tail + dy);
  ctx.lineTo(half - 16, -w + dy);
  ctx.quadraticCurveTo(half, -w + dy, half, -nose + dy);
  ctx.lineTo(half, nose + dy);
  ctx.quadraticCurveTo(half, w + dy, half - 16, w + dy);
  ctx.lineTo(-half + 6, tail + dy);
  ctx.quadraticCurveTo(-half, tail + dy, -half, tail - 4 + dy);
  ctx.lineTo(-half, -tail + 4 + dy);
  ctx.quadraticCurveTo(-half, -tail + dy, -half + 6, -tail + dy);
  ctx.closePath();
}

/** Body, glass and lights — everything both cars share. */
function drawHull(ctx: CanvasRenderingContext2D, skin: Skin) {
  const half = CAR_HALF;
  const w = CAR_HALF_W;

  // The shadow is offset **down the board only**. Any offset along x would put a dark edge past
  // the bumper, and the player judges "is it between the lines" on exactly that edge.
  ctx.fillStyle = 'rgba(0,0,0,0.17)';
  hullPath(ctx, 4);
  ctx.fill();

  // Tyres, poking out past the sill. Their reach along the street is `WHEEL_X + WHEEL_R`, which
  // `dev/park.mjs` asserts stays inside `CAR_HALF`.
  ctx.fillStyle = COLORS.tyre;
  for (const wx of [-WHEEL_X, WHEEL_X]) {
    for (const wy of [-WHEEL_Y, WHEEL_Y]) {
      rrect(ctx, wx - WHEEL_R, wy - 4, WHEEL_R * 2, 8, 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = skin.body;
  hullPath(ctx);
  ctx.fill();

  // The bumpers, dark, sitting exactly on ±CAR_HALF. This is not trim: it makes the two edges the
  // game actually measures the most definite thing on the car.
  ctx.fillStyle = skin.dark;
  rrect(ctx, half - 4, -w + 4, 4, (w - 4) * 2, 2);
  ctx.fill();
  rrect(ctx, -half, -w + 4.5, 4, (w - 4.5) * 2, 2);
  ctx.fill();

  // The greenhouse is one block of glass with the roof panel laid on top of it, so the
  // windscreen, the rear window and the side glass are a single shape and cannot drift apart.
  // **The roof is offset aft**, which leaves a windscreen half again as deep as the rear window
  // — from overhead that asymmetry is most of what says which way the car is pointing, and a
  // car whose front cannot be told from its back is unplayable in a game about its bumpers.
  ctx.fillStyle = skin.glass;
  rrect(ctx, -17, -11, 32, 22, 6);
  ctx.fill();
  ctx.fillStyle = skin.light;
  rrect(ctx, -12, -7.5, 19, 15, 4.5);
  ctx.fill();

  // Bonnet and boot seams.
  ctx.fillStyle = skin.dark;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(19, -w + 5, 1.2, (w - 5) * 2);
  ctx.fillRect(-21, -w + 5.5, 1.2, (w - 5.5) * 2);
  ctx.globalAlpha = 1;

  // Headlights are wide and pale, tail lights narrow and amber — never red, which is spoken for.
  ctx.fillStyle = skin.lamp;
  rrect(ctx, half - 10, -11.5, 5.5, 5.5, 1.5);
  ctx.fill();
  rrect(ctx, half - 10, 6, 5.5, 5.5, 1.5);
  ctx.fill();
  ctx.fillStyle = skin.tail;
  rrect(ctx, -half + 5, -11, 4, 5, 1.5);
  ctx.fill();
  rrect(ctx, -half + 5, 6, 4, 5, 1.5);
  ctx.fill();

  // Wing mirrors, outboard. Free: across the street is the axis nothing is scored on.
  ctx.fillStyle = skin.dark;
  rrect(ctx, 6, -w - 3, 6, 3.2, 1.5);
  ctx.fill();
  rrect(ctx, 6, w - 0.2, 6, 3.2, 1.5);
  ctx.fill();
}

/**
 * The two things that make it a taxi, and they cost almost nothing: a chequer band along each
 * sill and a sign on the roof.
 *
 * The sign is also the crash's punchline — it comes off. That is how the "a load you can lose"
 * beat survives the delivery van it was invented for: something visibly leaves the car when you
 * hit somebody, and it is not a scoring event.
 */
function drawTaxiTrim(ctx: CanvasRenderingContext2D, sign: boolean) {
  const w = CAR_HALF_W;
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i % 2 === 0 ? COLORS.trim : COLORS.chequer;
    const x = -18 + i * 4;
    ctx.fillRect(x, -w + 0.8, 4, 3.2);
    ctx.fillRect(x, w - 4, 4, 3.2);
  }

  if (!sign) return;
  // Small, cream, and sat towards the front of the roof where a real one is. It was half again
  // this size in black, and at that weight it stopped being a sign and became the car's face.
  ctx.fillStyle = COLORS.trim;
  rrect(ctx, -4.6, -4, 12, 8, 2.4);
  ctx.fill();
  ctx.fillStyle = COLORS.sign;
  rrect(ctx, -3.8, -3.2, 10.4, 6.4, 2);
  ctx.fill();
  ctx.fillStyle = COLORS.bodyDark;
  rrect(ctx, -1.8, -1.1, 6, 2.2, 1);
  ctx.fill();
}

/**
 * The car parked in front: the thing at the end of the bay, and what you crash into.
 *
 * Only its **face** is judged — `BUFFER_W` of it — so the rest is drawn a full car length beyond
 * that and simply runs off the board when the bay sits far down the street. Nudged and skewed
 * after an impact, and the skew is legal here for the reason it is forbidden on the taxi: nothing
 * about this car is measured.
 */
function drawAhead(ctx: CanvasRenderingContext2D, scene: Scene) {
  const centre = bufferX(scene.spec.failLine) + CAR_HALF;
  const crashed = scene.result?.rating === 'CRASHED';
  ctx.save();
  ctx.translate(centre + (crashed ? 6 : 0), LANE_Y);
  if (crashed) ctx.rotate(-0.07);
  drawHull(ctx, AHEAD);
  ctx.restore();
}

/**
 * The taxi.
 *
 * **The brake squash is lateral, and that is a correctness fix carried over from the side-on
 * scene.** The bay is measured against the car's outline, so anything that changes its drawn
 * length is a scoring bug: the player checks "is it between the lines" by eye, and a drawing that
 * shortens under the brakes puts a car genuinely over a line inside it. Side-on the answer was a
 * vertical shear, which preserved every point's x; from above the answer is a scale in y alone —
 * `transform(1, 0, 0, 1 + k, 0, 0)` maps (x, y) to (x, y(1 + k)). The body splays out on its
 * springs, and the footprint is provably untouched at any value of k.
 */
function drawCar(ctx: CanvasRenderingContext2D, scene: Scene, outside: -1 | 1 | 0) {
  const lostSign = scene.result?.rating === 'CRASHED';

  ctx.save();
  ctx.translate(scene.carX, LANE_Y);

  ctx.save();
  ctx.transform(1, 0, 0, 1 + scene.carSquash, 0, 0);
  drawHull(ctx, TAXI);
  drawTaxiTrim(ctx, !lostSign);
  ctx.restore();

  // The end of the car that is over a line, called out. Drawn outside the squash so it marks the
  // footprint the scoring actually used.
  //
  // White, straddling the edge: yellow on a yellow taxi against white paint is three ways of
  // saying nothing. This has to read at a tenth of a unit of overhang, which is the whole reason
  // it exists.
  if (outside !== 0) {
    // Backed in dark before it is drawn in white, because the line it has crossed is painted red
    // and a white bar on red paint on a yellow car is one contrast too few. The backing is what
    // makes the mark survive landing on top of the crossed-line mark, which is exactly where it
    // lands whenever the overhang is small — the only case it exists for.
    ctx.fillStyle = COLORS.trim;
    rrect(ctx, outside * CAR_HALF - 2.8, -CAR_HALF_W - 5, 5.6, CAR_HALF_W * 2 + 10, 2.5);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    rrect(ctx, outside * CAR_HALF - 1.5, -CAR_HALF_W - 3.6, 3, CAR_HALF_W * 2 + 7.2, 1.5);
    ctx.fill();
  }

  ctx.restore();
}

/** Two black lines out of the back of a car that has just stopped hard. There is no braking
 *  curve in this game — the stop is instantaneous — so these are the only thing that says the
 *  brakes were ever applied. */
function drawSkids(ctx: CanvasRenderingContext2D, scene: Scene) {
  if (scene.phase !== 'judging') return;
  const fade = Math.max(0, 1 - scene.phaseTime / 1.1);
  if (fade <= 0) return;

  const len = 22 + scene.spec.speed * 0.09;
  ctx.globalAlpha = 0.3 * fade;
  ctx.fillStyle = COLORS.skid;
  for (const wy of [-WHEEL_Y, WHEEL_Y]) {
    rrect(ctx, scene.carX - WHEEL_X - len, LANE_Y + wy - 2, len, 4, 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Speed lines off the tail while it rolls. From above there is no wheel to see turning and the
 *  street may not scroll, so the car needs something of its own that says "moving". */
function drawStreaks(ctx: CanvasRenderingContext2D, scene: Scene) {
  if (!scene.rolling) return;
  const len = 12 + scene.spec.speed * 0.1;
  ctx.fillStyle = COLORS.asphaltLight;
  for (const [dy, k] of [
    [-9, 0.7],
    [0, 1],
    [9, 0.55]
  ] as [number, number][]) {
    ctx.globalAlpha = 0.3 * k;
    rrect(ctx, scene.carX - CAR_HALF - 4 - len * k, LANE_Y + dy - 1.2, len * k, 2.4, 1.2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- verdict and prompt ----------------------------------------------------------------------

const RATING_COLOR: Record<Rating, string> = {
  PERFECT: COLORS.good,
  GREAT: COLORS.good,
  CLOSE: COLORS.body,
  // Both of these cost a flat penalty, so both are red — and red is not used anywhere else on
  // the board, which is what makes them read.
  MISSED: COLORS.bad,
  CRASHED: COLORS.bad
};

function drawVerdict(ctx: CanvasRenderingContext2D, scene: Scene) {
  const result = scene.result;
  ctx.textAlign = 'center';

  if (result && scene.phase !== 'ready') {
    // A stamp: it lands slightly oversized and settles, which is most of why a perfect stop
    // feels like anything at all.
    const settle = Math.min(1, scene.phaseTime / 0.18);
    const scale = 1 + (1 - settle) * 0.5;
    ctx.save();
    ctx.translate(BOARD_W / 2, VERDICT_TOP + 50);
    ctx.scale(scale, scale);
    ctx.fillStyle = RATING_COLOR[result.rating];
    setFont(ctx, 38, 800);
    spaced(ctx, result.rating, 0, 0, 3, 'center');
    ctx.restore();

    // The distance *is* the score, so it is the number, large, under the word. There used to be
    // a points figure here — 1000 times a squared falloff plus a perfect bonus — with the
    // distance relegated to the small line. One number that means one thing beat it.
    if (result.rating !== 'CRASHED') {
      ctx.fillStyle = COLORS.text;
      setFont(ctx, 30, 800);
      ctx.fillText(result.error.toFixed(1), BOARD_W / 2, VERDICT_TOP + 84);

      ctx.fillStyle = COLORS.textDim;
      setFont(ctx, 12, 600);
      const tail = result.personalBest ? 'OFF CENTRE   ·   YOUR BEST HERE' : 'OFF CENTRE';
      spaced(ctx, tail, BOARD_W / 2, VERDICT_TOP + 106, 1.6, 'center');
    }
  } else if (scene.phase === 'ready') {
    ctx.fillStyle = COLORS.textDim;
    setFont(ctx, 13, 600);
    spaced(ctx, 'GET THE WHOLE CAR IN THE BAY', BOARD_W / 2, VERDICT_TOP + 34, 1.6, 'center');
  }

  ctx.textAlign = 'left';
}

function drawPrompt(ctx: CanvasRenderingContext2D, scene: Scene) {
  // Nothing during the verdict: the stop has just landed and the eye belongs on it.
  if (scene.phase === 'judging') return;

  const done = scene.phase === 'results';
  const verb = scene.phase === 'ready' ? 'LAUNCH' : 'STOP';
  const line = done
    ? scene.coarse
      ? 'TAP TO PLAY AGAIN'
      : 'TAP OR PRESS SPACE TO PLAY AGAIN'
    : scene.coarse
      ? `TAP TO ${verb}`
      : `TAP OR PRESS SPACE TO ${verb}`;

  // Breathes, so an idle board does not look like a frozen one.
  ctx.globalAlpha = 0.55 + 0.35 * Math.sin(scene.phaseTime * 3.4);
  ctx.fillStyle = COLORS.text;
  setFont(ctx, done ? 13 : 15, 700);
  ctx.textAlign = 'center';
  spaced(ctx, line, BOARD_W / 2, PROMPT_TOP + 36, done ? 1.9 : 2.2, 'center');
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

// --- the results ------------------------------------------------------------------------------

/**
 * The end of a session, and the point of the whole thing: one number over five bays that everyone
 * plays, so it is a number two people can hold up against each other. Under it, what each round
 * cost — because a total of 14 built from five tidy stops and a total of 14 built from four
 * perfect stops and a crash are very different sessions, and the breakdown is what tells you
 * which round to go back for.
 */
function drawResults(ctx: CanvasRenderingContext2D, scene: Scene) {
  ctx.textAlign = 'center';

  ctx.fillStyle = COLORS.textDim;
  setFont(ctx, 12);
  spaced(ctx, 'TOTAL OFF CENTRE', BOARD_W / 2, 74, 2.4, 'center');

  ctx.fillStyle = scene.sessionBest ? COLORS.good : COLORS.text;
  setFont(ctx, 64, 800);
  ctx.fillText(scene.totalOff.toFixed(1), BOARD_W / 2, 138);

  setFont(ctx, 12, 700);
  if (scene.sessionBest) {
    ctx.fillStyle = COLORS.good;
    spaced(ctx, 'YOUR BEST SESSION', BOARD_W / 2, 166, 2.2, 'center');
  } else if (scene.bestTotal !== null) {
    ctx.fillStyle = COLORS.textDim;
    spaced(ctx, `BEST ${scene.bestTotal.toFixed(1)}`, BOARD_W / 2, 166, 2.2, 'center');
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(78, 196);
  ctx.lineTo(BOARD_W - 78, 196);
  ctx.stroke();

  scene.scores.forEach((entry, i) => {
    const y = 232 + i * 32;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textDim;
    setFont(ctx, 14, 700);
    ctx.fillText(String(i + 1), 82, y);

    ctx.textAlign = 'center';
    setFont(ctx, 11, 700);
    ctx.fillStyle = RATING_COLOR[entry.rating];
    spaced(ctx, entry.rating, BOARD_W / 2, y, 1.6, 'center');

    ctx.textAlign = 'right';
    setFont(ctx, 16, 700);
    ctx.fillStyle = failed(entry.rating) ? COLORS.bad : COLORS.text;
    ctx.fillText(entry.score.toFixed(1), BOARD_W - 82, y);
  });

  ctx.textAlign = 'left';
}

const failed = (rating: Rating) => rating === 'MISSED' || rating === 'CRASHED';
