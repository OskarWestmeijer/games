/**
 * The level ladder.
 *
 * **Nothing in this file may call `Math.random()`.** Level *n* is a pure function of *n* — the
 * speed, the bay's size and where on the street it sits all come out of two curves and an integer
 * hash of the level number. That is not tidiness: the point of this scene is eventually to be
 * able to say "here is how close you got on level 7, and here is how close everybody else got",
 * and that question only exists if everybody's level 7 is the same level 7. A single
 * `Math.random()` in here quietly deletes the feature.
 *
 * The same property is what makes a round reproducible across a reload, across a device and
 * across a browser — and it is what lets `SESSION` below be "the same five bays for everyone,
 * forever" without a server, a seed or a download.
 *
 * **There is one bay on the street and nothing else.** It briefly had oil slicks on the approach
 * and a small high-value bay beyond the main one at 3x, and both are gone: they gave the player
 * two more things to read in the half-second before a tap that is only ever about one of them.
 *
 * **The ladder is built out of `clearance`, not out of the bay's width, and that is the whole
 * shape of the file.** Parking means getting the whole car between the bay's two lines, so every
 * bay is `CAR_HALF` — fixed, a property of the car — plus however much room the round is willing
 * to give you either side of it. The clearance is what shrinks, 36 units down to 4; the bay
 * itself only ever goes from 130 units wide to 67, because a bay shorter than the car is not a
 * hard bay, it is an impossible one. An earlier ladder shrank the *bay* to ±4 and judged the
 * car's centre alone, which worked only because the car's own size was not in the question.
 *
 * Both curves still asymptote, because the whole approach has to stay visible from the moment
 * the car launches — the tap this game is made of is a judgement about a gap you can see, not a
 * reaction to something arriving. That is also why there is no scrolling camera; see
 * `park-view.ts`.
 */

import { BAY_CLEAR, BLOCK_GAP, CAR_HALF, MAX_FAIL_LINE, START_X } from './board';

/** The painted bay. Its `half` is `CAR_HALF + clearance`, always. */
export interface Bay {
  centre: number;
  half: number;
}

export interface LevelSpec {
  level: number;
  /** Board units per second. */
  speed: number;
  bay: Bay;
  /**
   * How far the car's centre may be from the bay's centre with the whole car still inside it —
   * `bay.half - CAR_HALF`. This is the number that is scored against; the bay's own width is the
   * thing you look at on the street.
   */
  clearance: number;
  /** The car's centre past this has put the bumper into the block. */
  failLine: number;
}

// --- the two curves --------------------------------------------------------------------------

const SPEED_BASE = 105;
const SPEED_GAIN = 155;
const SPEED_TAU = 6;

/** Clearance either side of the tyres: 36 units at level 1, settling at 4. */
const CLEAR_FLOOR = 4;
const CLEAR_GAIN = 32;
const CLEAR_TAU = 4.5;

/** At least this much rolling before the car's centre reaches the bay, at that level's speed.
 *  Under about half a second there is no time to *aim*, only to flinch. */
export const MIN_ROLL_SECONDS = 0.6;

/**
 * A session is these five rungs of the ladder, in this order, for everybody, forever.
 *
 * **The fixed length is what makes a score comparable.** There are only two structures that
 * produce a number two strangers can hold up against each other: a *variable* length whose score
 * *is* the length (Flappy Bird — a count of pipes, comparable because the unit repeats), or a
 * *fixed* length scored on quality (this). The game spent a while being neither — endless with
 * one life, scored on total distance with lower being better — under which quitting on round one
 * with a tidy stop beat a flawless run to round twenty. A fixed denominator is the whole fix.
 *
 * The rungs are spread across the ladder rather than taken from the bottom of it, so one session
 * runs from roomy to almost impossible: 686 ms of tap window down to 34 ms. Five is enough to
 * make a bad round hurt and few enough that a session is under a minute.
 */
export const SESSION = [1, 4, 8, 14, 22] as const;
export const ROUND_COUNT = SESSION.length;

/** The spec for round `i` of a session, 0-based. */
export const roundSpec = (round: number) => levelSpec(SESSION[round]);

export const speedFor = (level: number) =>
  SPEED_BASE + SPEED_GAIN * (1 - Math.exp(-(level - 1) / SPEED_TAU));

export const clearanceFor = (level: number) =>
  CLEAR_FLOOR + CLEAR_GAIN * Math.exp(-(level - 1) / CLEAR_TAU);

/**
 * A 32-bit integer mix (the finalizer from MurmurHash3) folded to 0..1. Deterministic, cheap,
 * and — unlike a seeded PRNG object — stateless, so `levelSpec(7)` can be asked for at any time
 * in any order and always answers the same thing.
 */
function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function levelSpec(level: number): LevelSpec {
  const speed = speedFor(level);
  const clearance = clearanceFor(level);
  const half = CAR_HALF + clearance;

  // Two near limits, and the binding one changes down the ladder. The roll limit buys the player
  // a look at the gap and binds once the car is quick; the bay limit keeps the car from starting
  // inside the bay, and binds at the low levels, where the bay is nearly half the street wide.
  const minCentre = Math.max(
    START_X + speed * MIN_ROLL_SECONDS,
    START_X + CAR_HALF + half + BAY_CLEAR
  );
  // The far limit is the block: the bumper must still have somewhere to be.
  const maxCentre = MAX_FAIL_LINE - half - BLOCK_GAP + CAR_HALF;
  // The curves keep this window open at every level; the guard is here so a future tweak to
  // either of them fails loudly in `dev/park.mjs` rather than quietly placing a bay off the end.
  const centre =
    maxCentre <= minCentre ? maxCentre : minCentre + (maxCentre - minCentre) * hash01(level);

  return {
    level,
    speed,
    bay: { centre, half },
    clearance,
    failLine: centre + half + BLOCK_GAP - CAR_HALF
  };
}

/** Where the buffer block's face is, for a given fail line. */
export const bufferX = (failLine: number) => failLine + CAR_HALF;
