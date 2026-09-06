import * as THREE from 'three';
import { arcDecks, flatDeck, regularRegion, type Deck } from '../regions';
import {
  NOSE_CAP_Z,
  NOSE_Z,
  Z_TAIL,
  floorOutline,
  halfWidthAt,
  outlineAt,
  roofAt,
  wallArc
} from './hull';

/**
 * The bauplan, as data.
 *
 * **One lofted hull, two storeys.** An ovoid: a closed round bulb aft where the bridge is,
 * holding its beam forward through the hall and closing into a blunt, glazed cap at the nose,
 * glazed over its whole forward two thirds. The shape itself lives in `hull.ts`; this file says
 * what is *in* it and where you may stand.
 *
 * - the **lounge** forward, in the glass: a raised dais with a U of couch open to the window,
 *   a low table in the middle of it, and the radio that switches the music on,
 * - a **staircase** running up the starboard wall, hard against it,
 * - the **bridge** aft: console at its front edge facing forward down the hall, globe behind it.
 *
 * There used to be an office in the nose — a desk, a chair and a monitor showing a miniature of
 * oskar-westmeijer.com — with the lounge sitting amidships behind it. The desk is gone and the
 * lounge has taken the window, which is the arrangement the reference sheet draws: the best seat
 * in the station is the one facing out of it.
 *
 * Bearing 0 degrees is still station **-Z** — the way the nose points and the face
 * `updateOrbit()` aims at the planet.
 *
 * Everything is authored in **station space**, which is also rig space and also the space the
 * camera walks in.
 */

export { NOSE_Z, Z_TAIL, Z_TIP } from './hull';

/** Camera height above whatever floor it is standing on. There is no body; this is the eyes. */
export const EYE_HEIGHT = 1.6;

/** How far the eye is held off a wall. Doubles as the "you have a body" fudge. */
const WALL_CLEARANCE = 0.45;

/**
 * The mezzanine: its top surface, how thick the slab is, and where its front edge falls.
 *
 * **It came down and forward.** At 3.6 in an 8.6 m hull the deck left five metres of empty air
 * over the lounge and a bridge you could not fill; at 2.75 in a 6.8 m hull the lower deck is a
 * room with a 2.5 m ceiling under the slab, and the bridge gets the taller half of the section.
 * The front edge moved from 30% of the length back to 36%, which is most of a metre more deck —
 * the one dimension the bridge was actually short of.
 */
export const BRIDGE = {
  y: 2.75,
  thickness: 0.24,
  frontZ: 1.8
};

/**
 * The staircase.
 *
 * **It hugs the starboard wall, and it is the hull that says where it goes.** `wallArc` fits a
 * circle to the hull's own floor outline between the two ends, so the flight is an arc of the
 * wall it stands against rather than a helix that happens to be near one — nothing here is a
 * position, only a length and two clearances. Move the hull and the stairs move with it.
 *
 * That circle comes out huge: 26 m of radius against a 10 m beam, because the flank of an ovoid
 * is nearly straight amidships — it bows out by 11 cm over the whole 4.8 m of the flight. (It was
 * 21 m when the nose still tapered to a point; blunting it flattened this wall further, and the
 * flight followed on its own, which is the whole reason it is fitted rather than placed.)
 * **That is the correct answer**, and the shape an
 * earlier version got wrong: a 3.4 m helix standing in the open middle of the floor, which
 * walled off the centre of the hall, put its outer rail 0.48 m through the hull the first time
 * it was drawn, and needed a well bitten out of the mezzanine to come up through.
 *
 * Running fore-and-aft pays for itself three times: a 4.65 m flight at 30.6 degrees instead of
 * 5.3 m at 34, an outer flank that *is* the hull and so carries no railing, and a top tread
 * level with the mezzanine's front edge — so there is **no stair well** at all.
 *
 * Its whole run is inside the glazing (`NOSE_Z` is its top). That is deliberate: an open flight
 * of treads with no risers hides very little, and a staircase in silhouette against the Earth is
 * worth more than the sliver of glass it costs.
 */
const STAIR_FOOT_Z = -3.0;

/**
 * How wide the flight is drawn, and how far the walkable band is held off its inner edge, clear
 * of the railing. The flight is generous because the hull leans in over the top of it: the band
 * is 1.45 m across at the foot and only 0.68 at the head, and narrowing the flight narrows the
 * head of it first.
 */
const STAIR_WIDTH = 1.8;
const STAIR_INNER_GAP = 0.12;

const STAIR_WALL = wallArc(STAIR_FOOT_Z, BRIDGE.frontZ, 1);

export const STAIR = {
  center: STAIR_WALL.center,
  fromAngle: STAIR_WALL.fromAngle,
  toAngle: STAIR_WALL.toAngle,
  /** How far the walkable surface runs past the last tread, flat, onto the deck. */
  topExtension: 0.6 / STAIR_WALL.radius,
  treads: 11
};

/** The radius at which the flight meets the hull — at floor level. Above it, the wall bulges. */
export const STAIR_OUTER = STAIR_WALL.radius;
export const STAIR_INNER = STAIR_OUTER - STAIR_WIDTH;
export const STAIR_CENTER_RADIUS = (STAIR_INNER + STAIR_OUTER) / 2;

/** A point on the flight's arc, at radius `r` and fraction `t` from foot to top. */
export function onStairArc(r: number, t: number): THREE.Vector2 {
  const a = STAIR.fromAngle + (STAIR.toAngle - STAIR.fromAngle) * t;
  return new THREE.Vector2(STAIR.center.x + Math.cos(a) * r, STAIR.center.y + Math.sin(a) * r);
}

/**
 * How far out the walkable band may reach at a fraction `t` along the flight — solved from the
 * hull, and **a function of `t` rather than one number, which is the whole point.**
 *
 * The flight climbs into the part of the hull that leans in, so the limit tightens as you go up:
 * at the foot the eye may be 4.31 out, at the head only 3.87 with the wall itself at 4.86.
 * Taking the worst of those and applying it the length of the flight — which is what this did
 * when it returned a single radius — leaves the *floor* deck reaching further outboard than the
 * stair does at the bottom, in exactly the place where the treads are ankle high. Walk along the
 * wall there and the floor claims you while the steps are around your knees, which is what "I
 * fall through the stairs" looks like from inside.
 *
 * Let it follow the lean and that strip closes: at the foot the band reaches 0.2 m *past* the
 * floor's own limit, and the strip that does open further up is honest headroom under a flight
 * two metres overhead.
 *
 * Four corrections, because the radius runs within a few degrees of X and the first recovers
 * about 97% of the error.
 */
export function stairWalkOuter(t: number): number {
  let radius = STAIR_OUTER;
  for (let i = 0; i < 4; i++) {
    const p = onStairArc(radius, t);
    radius += halfWidthAt(p.y, BRIDGE.y * t + EYE_HEIGHT) - WALL_CLEARANCE - p.x;
  }
  return radius;
}

/**
 * Where the flight's inner edge meets the mezzanine's front edge. The bridge's front railing
 * runs out to here and stops, leaving the head of the stairs open.
 */
export const STAIR_TOP_X = onStairArc(STAIR_INNER, 1).x;

/**
 * The lounge, forward, in the glass — the one piece of furniture left on the lower deck.
 *
 * A **U** rather than a ring, and the opening faces the window: `openAngle` of the circle is left
 * out, centred on -Z, so the couch wraps the aft three quarters and you sit or stand in the gap
 * with nothing between you and the planet. That is the reference sheet's arrangement, and it is
 * also what makes the dais worth walking onto.
 *
 * **The dais is floor now, not furniture.** It used to be one footprint you walked around,
 * because a closed couch ring left a hand's width of tread outside it and an unreachable pocket
 * inside. Opening the U reverses that: the pocket is the best standing spot in the station, so
 * the dais is a `Deck` at 0.18 — one step, well under `MAX_STEP` — and the couch is the thing
 * you are pushed out of.
 *
 * The radius is bounded by the hull. At 2.3 about z = -4.2 the forward edge lands at z = -6.5,
 * where the floor is 2.64 from the centreline; much bigger or much further forward and the dais
 * runs out through the glass.
 *
 * **`couchInner` and `tableRadius` are a clearance, not a taste.** The pocket you stand in is the
 * gap between the table and the seats, and the player is a point tested against both inflated by
 * `PLAYER_RADIUS` — so the ring is only `couchInner - tableRadius - 2 * 0.32` wide. At the first
 * numbers (1.35 and 0.5) that came to 0.21 m, and once the table's own footprint and the couch's
 * box chain had eaten their share there was nothing left: you could reach the mouth and the near
 * edge of the table and go no further, which is not a lounge you can be in. 1.45 and 0.38 give
 * 0.49 m, enough to walk round the table, and they buy it *without* growing `couchOuter` or the
 * dais — the station is meant to be tight. Change either and re-run `dev/walk.mjs`.
 */
export const LOUNGE = {
  x: 0,
  z: -4.2,
  daisRadius: 2.3,
  daisHeight: 0.18,
  couchInner: 1.45,
  couchOuter: 2.05,
  seatHeight: 0.42,
  backHeight: 0.86,
  /** How much of the circle is left out, centred on -Z. */
  openAngle: THREE.MathUtils.degToRad(100),
  tableRadius: 0.38,
  tableHeight: 0.38
};

/**
 * Where the player is standing when they arrive: **at the head of the stairs, on the bridge**,
 * looking forward down the length of the hall and out through the nose.
 *
 * This is the one viewpoint that has the whole station in it at once. From the bridge you are
 * four metres up and eleven metres back, so the hall reads as a *room* — the mezzanine's edge in
 * front of you, the flight dropping away to starboard, the lounge and its lit dais below and to
 * port, and the cap window with the planet in it dead ahead. From the lounge, where it used to
 * be, you see the window and almost nothing else of the place you are standing in.
 *
 * **Nothing here is a coordinate.** The position is one stride inboard of the flight's inner
 * edge and one stride aft of where it arrives, so it follows the staircase, which follows the
 * wall, which follows the hull. The aim is a `lookAt` at the **middle of the cap window** — which
 * is what "watching outside towards the planet" means when the window is a round one — and the
 * lounge falls into the lower left of the frame on its own, 6.5 degrees off the axis and 14 down,
 * against a vertical field of 65.
 *
 * It has to stay clear of the console, whose footprint inflated by the player radius reaches
 * x = 1.62 and z = 2.11; at x = 3.4 it is not close.
 *
 * It used to be at a desk in the nose, then on the floor behind the couch. There is no desk, and
 * the couch is better looked *at* than stood behind.
 */
const SPAWN_INBOARD = 0.35;
const SPAWN_AFT = 0.7;
const SPAWN_X = STAIR_TOP_X + SPAWN_INBOARD;
const SPAWN_Z = BRIDGE.frontZ + SPAWN_AFT;

/** The point the arriving camera is aimed at: the centre of the round window in the nose. */
const SPAWN_TARGET = { x: 0, y: roofAt(NOSE_CAP_Z) / 2, z: NOSE_CAP_Z };

/**
 * Yaw and pitch of a look from the spawn to that target. Yaw is measured the way three.js does
 * it — a camera at yaw 0 looks down -Z, and positive yaw swings that towards +X — which is why
 * the arguments come out as (eye - target) rather than the other way round.
 */
const SPAWN_REACH = Math.hypot(SPAWN_X - SPAWN_TARGET.x, SPAWN_Z - SPAWN_TARGET.z);

export const SPAWN = {
  x: SPAWN_X,
  y: BRIDGE.y,
  z: SPAWN_Z,
  yaw: Math.atan2(SPAWN_X - SPAWN_TARGET.x, SPAWN_Z - SPAWN_TARGET.z),
  pitch: Math.atan2(SPAWN_TARGET.y - (BRIDGE.y + EYE_HEIGHT), SPAWN_REACH),
  level: 1
};

/**
 * The navigation console: on the bridge, forward and central. The stairs arrive at the deck's
 * starboard end, so the console keeps the middle of it and the sightline down the hall.
 */
export const CONSOLE = { x: 0, z: 2.8, width: 2.6, depth: 0.75, top: 1.05 };

/** Where the globe floats: behind the console, at the back of the bridge deck. */
export const GLOBE = {
  x: CONSOLE.x,
  z: 5.6,
  y: BRIDGE.y + 1.5,
  radius: 0.72,
  plinthRadius: 0.78
};

/**
 * The slab's own outline.
 *
 * Taken at **deck height** so it runs right out to meet the hull and leaves no gap to see
 * through — the walkable region below is a different, much smaller shape, and that difference is
 * deliberate (see the note on `DECKS`). It is a plain outline: the staircase arrives at the front
 * edge from below rather than through the deck, so there is no well to bite out.
 */
export function bridgeSlabPolygon(): THREE.Vector2[] {
  return outlineAt(BRIDGE.y, BRIDGE.frontZ, Z_TAIL, 0);
}

/**
 * The walkable floor.
 *
 * **The order is load-bearing.** `deckAt` is first-match. The stair shares its XZ with the hall
 * floor it climbs over — listed the other way round you would walk *under* the treads at ground
 * level instead of up them — and the dais shares its XZ with the floor it stands on. The flanks
 * of the flight are held by the step guard in `fpv-controls.ts` rather than by a region boundary,
 * which is why its inner railing matters: it is what makes that invisible wall visible. The outer
 * flank needs nothing, because it is the hull.
 *
 * **Each deck's outline is taken at the height of the player's head, not their feet.** On the
 * lower floor the two agree closely enough — the hull's widest point is a little above eye height
 * — so the floor's own outline serves. On the bridge they do not: at z = 4 the hull is 4.86 wide
 * at the deck and 4.28 at 4.35 m, and by z = 6.5 it is 3.2 against 2.1. A deck laid out on the
 * slab's own edge would walk you head-first into the roof well before you ran out of floor, and
 * aft, where the bulb closes, *badly* before.
 */
export const DECKS: Deck[] = [
  ...arcDecks({
    center: STAIR.center,
    innerRadius: STAIR_INNER + STAIR_INNER_GAP,
    outerRadius: stairWalkOuter,
    fromAngle: STAIR.fromAngle,
    toAngle: STAIR.toAngle,
    fromY: 0,
    toY: BRIDGE.y,
    levels: [0, 1],
    segments: 10,
    topExtension: STAIR.topExtension
  }),
  // The dais. A regular polygon rather than a circle, because a region *is* a polygon — sixteen
  // sides is smooth enough that nobody feels the corners at 0.18 m off the floor.
  flatDeck(regularRegion(LOUNGE.x, LOUNGE.z, LOUNGE.daisRadius, 16), LOUNGE.daisHeight, 0),
  // The whole lower floor, as one convex region. It can be one because the hull's profile is
  // concave — see the note in `hull.ts`. It runs under the bridge too: the soffit is at 2.51, so
  // the sheltered back of the room is walkable and is meant to be.
  flatDeck(floorOutline(WALL_CLEARANCE), 0, 0),
  flatDeck(outlineAt(BRIDGE.y + EYE_HEIGHT, BRIDGE.frontZ, Z_TAIL, WALL_CLEARANCE), BRIDGE.y, 1)
];

/** An axis-aligned footprint about a centre. `Box2` carries z in `.y`. */
export function footprint(x: number, z: number, w: number, d: number): THREE.Box2 {
  return new THREE.Box2(
    new THREE.Vector2(x - w / 2, z - d / 2),
    new THREE.Vector2(x + w / 2, z + d / 2)
  );
}

/** Re-exported so the rest of the station can place things against a hull that is not a box. */
export { halfWidthAt, roofAt, floorOutline, outlineAt };
