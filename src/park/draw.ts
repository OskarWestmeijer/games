/**
 * Everything this scene draws.
 *
 * All of it in board units (see `board.ts`), on a context `park-view.ts` has already transformed,
 * so nothing in here knows about pixels, device pixel ratios or the size of the window. The
 * split is the same one `station/` draws between form and placement: this file knows what a toy
 * car looks like, and nothing about when it moves.
 *
 * The look is chunky on purpose — fat rounded corners, flat fills, no gradients thinner than a
 * whole panel, no hairlines. A precision game read at arm's length on a phone has to be legible
 * before it is pretty, and a toy is the one thing that gets to be both.
 */

import {
  BOARD_H,
  BOARD_W,
  BUFFER_W,
  CAR_HALF,
  COLORS,
  GROUND_Y,
  HEADER_BOTTOM,
  MAT_BOTTOM,
  MAT_TOP,
  PROMPT_TOP,
  ROAD_BOTTOM,
  ROAD_TOP,
  WHEEL_R,
  WHEEL_X,
  TRACK_X0,
  TRACK_X1,
  VERDICT_TOP,
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
  /** The stage record *before* this stop. Read live off `best`, the ruler would show the stop
   *  it has just written as the mark it is being compared against, which is always a draw. */
  bayCentre: number;
  /** The band the car's centre had to land in for both tyres to be inside the bay. */
  clearance: number;
}

/** Everything the drawing needs, and nothing it can change. */
export interface Scene {
  phase: Phase;
  phaseTime: number;
  spec: LevelSpec;
  carX: number;
  carTilt: number;
  wheelAngle: number;
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

  // The results are their own screen, not a panel over the mat. A summary laid on top of the
  // parked car covers the one thing worth looking at — that mistake has been made here once
  // already; see the note in CLAUDE.md. By the time this shows, the last round's verdict has
  // been and gone, so there is nothing underneath left to see.
  if (scene.phase === 'results') {
    drawResults(ctx, scene);
    drawPrompt(ctx, scene);
    return;
  }

  drawHeader(ctx, scene);
  drawMat(ctx, scene, effects);
  drawVerdict(ctx, scene);
  drawPrompt(ctx, scene);
}

// --- header ----------------------------------------------------------------------------------

function drawHeader(ctx: CanvasRenderingContext2D, scene: Scene) {
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = COLORS.textDim;
  setFont(ctx, 12);
  spaced(ctx, 'ROUND', 24, 42, 2.4);
  // "TOTAL OFF", not "SCORE": the number under it is a distance, and it is the one thing on the
  // board where smaller is better. A label that reads as an amount of *error* says which way
  // round it goes without a line of text explaining it.
  spaced(ctx, 'TOTAL OFF', BOARD_W - 24, 42, 2.4, 'right');

  ctx.fillStyle = COLORS.text;
  setFont(ctx, 42, 800);
  ctx.textAlign = 'left';
  // "3/5", not "3": the denominator is the whole reason the score means anything, so it is on
  // screen the entire time rather than only at the end.
  ctx.fillText(`${scene.round + 1}/${ROUND_COUNT}`, 24, 80);
  ctx.textAlign = 'right';
  ctx.fillText(scene.totalOff.toFixed(1), BOARD_W - 24, 80);

  ctx.fillStyle = COLORS.textDim;
  setFont(ctx, 12, 600);
  ctx.textAlign = 'center';
  if (scene.bestTotal !== null) {
    spaced(ctx, `BEST ${scene.bestTotal.toFixed(1)}`, BOARD_W / 2, 78, 1.6, 'center');
  }
  ctx.textAlign = 'left';

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, HEADER_BOTTOM - 8);
  ctx.lineTo(BOARD_W - 24, HEADER_BOTTOM - 8);
  ctx.stroke();
}

// --- the ruler -------------------------------------------------------------------------------
// Before the tap this band carries the level's numbers; after it, the same band blows the target
// up to the full width of the board so a two-unit miss is something you can see. The magnified
// view is the answer to "how close was that, really" — the only question this game asks.

// --- the play mat ----------------------------------------------------------------------------

function drawMat(ctx: CanvasRenderingContext2D, scene: Scene, effects: Effects) {
  ctx.fillStyle = COLORS.mat;
  rrect(ctx, 12, MAT_TOP, BOARD_W - 24, MAT_BOTTOM - MAT_TOP, 14);
  ctx.fill();

  // A few faint boards across the mat, so it reads as a surface rather than a swatch.
  ctx.fillStyle = 'rgba(0,0,0,0.045)';
  for (let y = MAT_TOP + 14; y < MAT_BOTTOM - 6; y += 26) ctx.fillRect(14, y, BOARD_W - 28, 3);

  // The road stops at the block. Drawn to `TRACK_X1` regardless, the track would carry on past
  // the thing that ends it, and the block would read as an obstacle in the middle of a road
  // rather than as the end of one. It also means the track visibly lengthens with the level.
  const roadEnd = Math.min(TRACK_X1, bufferX(scene.spec.failLine) + BUFFER_W + 6);

  // Which side of the bay the car hangs over, or 0 if the round is still open or was parked.
  // -1 is the tail over the near line, +1 the nose over the far one; a crash is always +1
  // because the block is only ever ahead.
  const failure = scene.result && failed(scene.result.rating) ? scene.result : null;
  const outside: -1 | 1 | 0 = failure ? (failure.stopX < failure.bayCentre ? -1 : 1) : 0;

  drawRoad(ctx, roadEnd);
  drawBay(ctx, scene.spec.bay, outside);
  drawBuffer(ctx, scene);
  // Under the car rather than over it: dust off the tyres and smoke off a stop belong beneath
  // the thing that threw them, and drawn on top they read as mud on the paintwork.
  effects.draw(ctx);
  drawCar(ctx, scene, outside);
}

function drawRoad(ctx: CanvasRenderingContext2D, roadEnd: number) {
  ctx.fillStyle = COLORS.roadEdge;
  rrect(ctx, TRACK_X0 - 4, ROAD_TOP - 4, roadEnd - TRACK_X0 + 8, ROAD_BOTTOM - ROAD_TOP + 8, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.road;
  rrect(ctx, TRACK_X0, ROAD_TOP, roadEnd - TRACK_X0, ROAD_BOTTOM - ROAD_TOP, 8);
  ctx.fill();

  // The dashes are fixed to the track, not scrolled past the car: this is a fixed field seen
  // whole, and a road that slid under a car standing still would be a different game.
  ctx.fillStyle = 'rgba(231,227,216,0.35)';
  for (let x = TRACK_X0 + 12; x < roadEnd - 16; x += 26) ctx.fillRect(x, ROAD_TOP + 9, 14, 3);

  // The start line, hatched.
  ctx.fillStyle = COLORS.dash;
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = i % 2 === 0 ? 0.8 : 0.25;
    ctx.fillRect(TRACK_X0 + 2, ROAD_TOP + 6 + i * 14, 7, 14);
  }
  ctx.globalAlpha = 1;
}

/**
 * The parking bay: a painted box with a bold line at each end, and the car has to get both tyres
 * between them.
 *
 * It used to be a solid block of hazard chevrons, which was the right picture while the win
 * condition was "put the middle of the car on the mark" — a target you aim at. It is the wrong
 * picture for a bay you have to *fit into*: what matters now is the two lines and the gap between
 * them, so the fill is dropped back to a wash and the ends carry the weight. The tick in the
 * middle is the only thing left of the old mark, and it is what a perfect stop is measured from.
 */
function drawBay(ctx: CanvasRenderingContext2D, bay: Bay, crossed: -1 | 1 | 0) {
  const x = bay.centre - bay.half;
  const w = bay.half * 2;
  const top = ROAD_TOP + 4;
  const h = ROAD_BOTTOM - ROAD_TOP - 8;

  ctx.fillStyle = COLORS.zone;
  ctx.globalAlpha = 0.16;
  rrect(ctx, x, top, w, h, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  // The two lines, painted **outside** the bay rather than inside it, so the gap between their
  // inner edges is exactly the space the tyres have to be in. Drawn inward — which they were —
  // the paint ate five units off each end, so "between the lines" was ten units narrower than
  // what the judge measured and a marginal call could look wrong in either direction.
  const bar = 5;
  ctx.fillStyle = COLORS.zone;
  rrect(ctx, x - bar, top, bar, h, 2);
  ctx.fill();
  rrect(ctx, x + w, top, bar, h, 2);
  ctx.fill();

  // The line a tyre went over, called out. Without this a marginal failure is unreadable: at the
  // last round's 4.3 units of clearance, missing by a tenth of a unit puts the rubber a tenth of
  // a *pixel* past the paint, and the honest verdict looks like a bug.
  if (crossed !== 0) {
    ctx.fillStyle = COLORS.bad;
    rrect(ctx, crossed < 0 ? x - bar - 2 : x + w, top - 3, bar + 2, h + 6, 2);
    ctx.fill();
  }

  // Dead centre, faint: it is what the score is measured from, not what you have to hit.
  ctx.strokeStyle = COLORS.text;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(bay.centre, top + 3);
  ctx.lineTo(bay.centre, top + h - 3);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawBuffer(ctx: CanvasRenderingContext2D, scene: Scene) {
  const x = bufferX(scene.spec.failLine);
  const crashed = scene.result?.rating === 'CRASHED';
  const h = 46;
  ctx.save();
  if (crashed) {
    // Knocked over, and it stays knocked over for as long as the wreck is on screen.
    ctx.translate(x + BUFFER_W / 2, GROUND_Y);
    ctx.rotate(0.5);
    ctx.translate(-BUFFER_W / 2, -h);
  } else {
    ctx.translate(x, GROUND_Y - h);
  }
  ctx.fillStyle = COLORS.woodDark;
  rrect(ctx, 0, 0, BUFFER_W, h, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.wood;
  rrect(ctx, 0, 0, BUFFER_W, h * 0.55, 3);
  ctx.fill();
  ctx.restore();
}

// --- the car ---------------------------------------------------------------------------------
// Drawn from the ground up at its own origin, so the whole thing is one translate away from
// wherever it has stopped, and a nose-dip is one rotate about the front axle.

function drawCar(ctx: CanvasRenderingContext2D, scene: Scene, outside: -1 | 1 | 0) {
  const { carX, carTilt, wheelAngle } = scene;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(carX, GROUND_Y + 3, CAR_HALF + 2, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(carX, GROUND_Y);

  // Wheels first, and level: they sit on the road while the body pitches on the suspension.
  for (const wx of [-WHEEL_X, WHEEL_X]) drawWheel(ctx, wx, -WHEEL_R, wheelAngle);

  /*
   * **The dip is a vertical shear, not a rotation, and that is a correctness fix.**
   *
   * The bay is measured against the car's own outline, so anything that changes the car's drawn
   * *width* is a scoring bug: the player checks "is it between the lines" by eye, and if the
   * drawing narrows under the brakes then a car genuinely over a line is drawn inside it. A
   * rotation does exactly that — it used to swing the axles in by 1.7 units at the crash tilt,
   * which was 40% of the last round's clearance, and "it said missed and the car was in" was the
   * entirely reasonable conclusion.
   *
   * `transform(1, k, 0, 1, 0, 0)` maps (x, y) to (x, y + kx): every point keeps its x. The nose
   * drops, the tail lifts, and the footprint is provably untouched at any tilt.
   */
  ctx.save();
  ctx.transform(1, carTilt, 0, 1, 0, 0);

  // Body.
  ctx.fillStyle = COLORS.bodyDark;
  rrect(ctx, -CAR_HALF, -32, CAR_HALF * 2, 24, 9);
  ctx.fill();
  ctx.fillStyle = COLORS.body;
  rrect(ctx, -CAR_HALF, -34, CAR_HALF * 2, 22, 9);
  ctx.fill();
  ctx.fillStyle = COLORS.bodyLight;
  rrect(ctx, -CAR_HALF + 4, -33, CAR_HALF * 2 - 8, 6, 3);
  ctx.fill();

  // Cabin, set back from the nose so the car has a front.
  ctx.fillStyle = COLORS.body;
  rrect(ctx, -16, -50, 28, 20, 7);
  ctx.fill();
  ctx.fillStyle = COLORS.glass;
  rrect(ctx, -12, -47, 20, 12, 4);
  ctx.fill();

  // Headlight, and the nose bumper it sits over — the part that meets the buffer block.
  ctx.fillStyle = COLORS.lamp;
  rrect(ctx, CAR_HALF - 7, -29, 6, 7, 2);
  ctx.fill();
  ctx.fillStyle = COLORS.hub;
  rrect(ctx, CAR_HALF - 3, -22, 4, 9, 2);
  ctx.fill();

  // The mark the game is actually judged on. A car is 58 units long and the target can be 16;
  // without this you would be eyeballing the middle of a large object against a small one.
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -54);
  ctx.lineTo(0, -30);
  ctx.stroke();

  ctx.restore();

  // The end of the car that is over a line, called out. Drawn outside the shear so it marks the
  // footprint the scoring actually used, and it is the *bodywork* now rather than a tyre —
  // whichever end crossed is the end you can see sticking out.
  //
  // White, straddling the edge: red on a red car against a red line is three ways of saying
  // nothing. This has to read at a tenth of a unit of overhang, which is the whole reason it
  // exists.
  if (outside !== 0) {
    ctx.fillStyle = COLORS.text;
    rrect(ctx, outside * CAR_HALF - 1.5, -38, 3, 32, 1.5);
    ctx.fill();
  }

  ctx.restore();
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.fillStyle = COLORS.tyre;
  ctx.beginPath();
  ctx.arc(x, y, WHEEL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.hub;
  ctx.beginPath();
  ctx.arc(x, y, WHEEL_R * 0.42, 0, Math.PI * 2);
  ctx.fill();
  // One spoke. A wheel with no mark on it is a wheel that never turns, however fast it is going.
  ctx.strokeStyle = COLORS.hub;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle) * 3, y + Math.sin(angle) * 3);
  ctx.lineTo(x + Math.cos(angle) * (WHEEL_R - 2), y + Math.sin(angle) * (WHEEL_R - 2));
  ctx.stroke();
}

// --- verdict and prompt ----------------------------------------------------------------------

const RATING_COLOR: Record<Rating, string> = {
  PERFECT: COLORS.good,
  GREAT: COLORS.good,
  CLOSE: COLORS.zone,
  // Both of these end the run, so both are red. A miss used to be dim grey, back when it was
  // merely a poor score.
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
    spaced(ctx, 'BOTH TYRES INSIDE THE BAY', BOARD_W / 2, VERDICT_TOP + 56, 1.6, 'center');
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
