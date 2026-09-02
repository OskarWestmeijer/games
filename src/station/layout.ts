import * as THREE from 'three';
import { arcDecks, flatDeck, rectRegion, type Deck, type Region } from '../regions';

/**
 * The bauplan, as data.
 *
 * **One hall, two storeys, slimming to a glazed nose.** Wide and square at the back where the
 * bridge is, curving in over the front third to a narrow prow that is glass on every face —
 * front, both sides, roof and floor. The office is in that nose, so the desk sits inside a
 * glass cage with the planet all round it; the bridge is at the back, up a curved flight of
 * stairs, looking forward down the length of the hall and out through the nose.
 *
 * Bearing 0° is still station **-Z** — the face the nose points and the face `updateOrbit()`
 * aims at the planet.
 *
 *                              -Z   glazed nose (front third: sides, roof, floor and window)
 *                          ╱‾‾‾‾‾‾‾‾‾╲
 *                        ╱  [desk]     ╲
 *                       │   chair       │
 *                       │                │
 *                       ├────────────────┤  ← taper starts, hull goes square
 *                       │           ⌒    │
 *                       │        ⌒stair  │     the flight curves up through a quarter
 *                       │     ⌒          │     turn and comes out at the deck's front
 *                       │  ┌─────────────┤
 *                       │  │ BRIDGE y=3.6│
 *                       │  │ ▬▬▬ console │
 *                       │  │ ◉ globe     │
 *                       └──┴─────────────┘
 *                              +Z
 *
 * Everything is authored in **station space**, which is also rig space and also the space the
 * camera walks in.
 */

/** Camera height above whatever floor it is standing on. There is no body; this is the eyes. */
export const EYE_HEIGHT = 1.6;

/** How far the eye is held off a wall. Doubles as the "you have a body" fudge. */
const WALL_CLEARANCE = 0.45;

/** The room, at its widest. Front (nose) at z = -8.5, back at +8.5. */
export const HALL = { width: 12, depth: 17, height: 7.2 };

/**
 * Where the hull stops being square and starts curving in, and how much width it loses by the
 * prow. The taper is **quadratic in the distance forward**, not linear: that leaves the sides
 * straight where they meet the square back and turns them in hardest at the very front, which
 * is what reads as a curve rather than as a chamfer. It also means the curve bows *outward* of
 * the straight chord between its ends, so a trapezoid drawn on that chord is always inside the
 * hull — which is what lets the walkable nose stay one convex region.
 *
 * `NOSE_Z` is one third of the way back, so "the front third" is one number for the taper, the
 * glazing and the office all at once.
 */
export const NOSE_Z = -HALL.depth / 2 + HALL.depth / 3;
const NOSE_TAPER = 1.5;

/** Half the hull's width at a given z. 6.0 everywhere aft of the nose, 4.5 at the prow. */
export function halfWidthAt(z: number): number {
  if (z >= NOSE_Z) return HALL.width / 2;
  const u = (NOSE_Z - z) / (NOSE_Z + HALL.depth / 2);
  return HALL.width / 2 - NOSE_TAPER * u * u;
}

/** How finely the curved sides are cut into wall panels. */
const NOSE_SEGMENTS = 7;

/**
 * The hull as a closed polygon, wound so that edge `i` runs from point `i` to point `i + 1`.
 * `hallEdges()` names which edges are which, because both the walls and the glazing are
 * driven off the same list.
 */
export function hullOutline(): Region {
  const back = HALL.depth / 2;
  const front = -HALL.depth / 2;
  const points: Region = [];

  points.push(new THREE.Vector2(-halfWidthAt(front), front));
  points.push(new THREE.Vector2(halfWidthAt(front), front));
  for (let i = 1; i <= NOSE_SEGMENTS; i++) {
    const z = front + ((NOSE_Z - front) * i) / NOSE_SEGMENTS;
    points.push(new THREE.Vector2(halfWidthAt(z), z));
  }
  points.push(new THREE.Vector2(HALL.width / 2, back));
  points.push(new THREE.Vector2(-HALL.width / 2, back));
  for (let i = NOSE_SEGMENTS; i >= 1; i--) {
    const z = front + ((NOSE_Z - front) * i) / NOSE_SEGMENTS;
    points.push(new THREE.Vector2(-halfWidthAt(z), z));
  }
  return points;
}

/**
 * The two halves of the floor plan, split at `NOSE_Z`. The roof and the floor are each built as
 * one opaque plate aft and one glass plate forward, which is what glazes the nose top and
 * bottom without punching holes in anything.
 */
export function aftPolygon(): Region {
  return rectRegion(-HALL.width / 2, NOSE_Z, HALL.width / 2, HALL.depth / 2);
}

export function nosePolygon(): Region {
  const front = -HALL.depth / 2;
  const points: Region = [];
  points.push(new THREE.Vector2(-halfWidthAt(front), front));
  points.push(new THREE.Vector2(halfWidthAt(front), front));
  for (let i = 1; i <= NOSE_SEGMENTS; i++) {
    const z = front + ((NOSE_Z - front) * i) / NOSE_SEGMENTS;
    points.push(new THREE.Vector2(halfWidthAt(z), z));
  }
  for (let i = NOSE_SEGMENTS; i >= 1; i--) {
    const z = front + ((NOSE_Z - front) * i) / NOSE_SEGMENTS;
    points.push(new THREE.Vector2(-halfWidthAt(z), z));
  }
  return points;
}

/** The z of each seam between nose wall panels, for the mullion ribs. */
export function noseRibs(): number[] {
  const front = -HALL.depth / 2;
  const zs: number[] = [];
  for (let i = 1; i < NOSE_SEGMENTS; i++) zs.push(front + ((NOSE_Z - front) * i) / NOSE_SEGMENTS);
  return zs;
}

/** Which edge of `hullOutline()` is what. The front wall is edge 0 and carries the window. */
export function hallEdges() {
  const n = NOSE_SEGMENTS;
  const glazed: number[] = [];
  for (let i = 1; i <= n; i++) glazed.push(i);
  for (let i = n + 4; i <= 2 * n + 3; i++) glazed.push(i);
  return { front: 0, glazed, rightWall: n + 1, back: n + 2, leftWall: n + 3 };
}

/**
 * The window in the prow. 7.6 x 6.4 in a wall that is only 9.0 wide and 7.2 tall, so it leaves
 * 0.7 at the sides and 0.2 / 0.6 top and bottom — and it runs the full height of the hall, so
 * both storeys look out of it.
 *
 * The horizon lands at `horizon` degrees above the optical axis (`pitchFor` in `flight.ts`) and
 * the pitch is solved for it every frame, so it holds its framing at any altitude. What it does
 * *not* hold is its framing at any eye height:
 *
 * - **From the desk** — eye 1.6, ~2.8 m off the glass — the default 9.4° detent ("high") puts
 *   the limb mid-window, which is where it has always been.
 * - **From the bridge** — eye 5.2, ~13 m off it — the same 9.4° puts it above the window head.
 *   The console's own horizon key ("level", "low") brings it back down.
 *
 * That is a property of a two-storey room rather than a bug: the two decks want different
 * framing, and there is already a control for it.
 */
export const WINDOW = { width: 7.6, height: 6.4, centerY: 3.4, cornerRadius: 0.8 };

/** The mezzanine: its top surface, how thick the slab is, and how much floor it covers. */
export const BRIDGE = {
  y: 3.6,
  thickness: 0.3,
  frontZ: 3.6,
  backZ: HALL.depth / 2
};

/**
 * The stair well: the bite taken out of the deck's front edge where the flight comes up. The
 * top tread lands flush on its back edge, so no landing is needed.
 */
export const STAIR_WELL = { minX: 4.2, maxX: HALL.width / 2, backZ: 4.2 };

/**
 * The staircase: a quarter turn, rising from the hall floor on the starboard side and coming
 * out facing aft at the deck's front edge.
 *
 * It is an arc rather than a straight run because the hull is no longer a box — a straight
 * flight bolted to a curving hull reads as scaffolding. The centre is placed so the outermost
 * tread stops short of the hull (`center.x + outerRadius` = 5.3, against a walkable edge of
 * 5.55), and the radius is set by the pitch: 3.5 m of centreline radius over a quarter turn is
 * 5.5 m of going for 3.6 m of rise, or about 33° — steep-ish, and the price of keeping the
 * flight out of the middle of the floor.
 */
export const STAIR = {
  center: new THREE.Vector2(1.4, 4.2),
  centerRadius: 3.5,
  halfWidth: 0.5,
  /**
   * Foot pointing dead ahead (-Z) from the centre, top pointing to starboard (+X), so the
   * flight turns to port as it climbs and delivers you facing aft at the deck edge.
   *
   * Written as -90°..0° rather than the equivalent 270°..360° so the sweep never straddles the
   * ±180° branch cut of `atan2`, which `arcDecks` deliberately does not unwrap.
   */
  fromAngle: THREE.MathUtils.degToRad(-90),
  toAngle: 0,
  /** How far the walkable surface runs past the last tread, flat, onto the deck. */
  topExtension: THREE.MathUtils.degToRad(17),
  treads: 12
};

export const STAIR_INNER = STAIR.centerRadius - STAIR.halfWidth;
export const STAIR_OUTER = STAIR.centerRadius + STAIR.halfWidth;

/**
 * Where the office furniture sits. Kept as a placement offset rather than re-authoring the desk
 * in station space, so `office/desk.ts` and `office/radio.ts` need no edits at all.
 *
 * The desk lands at z = -7.85, its front edge 0.14 clear of the window frame — which stands
 * `FRAME_DEPTH` proud of a wall at -8.5. The spawn comes out at z = -5.7, about 2.8 m off the
 * glass and well inside the glazed nose.
 */
export const OFFICE_PLACEMENT = { x: 0, z: -5.85 };

/**
 * The navigation console: on the bridge, forward and central. The stair well is off in the
 * starboard corner, so the console keeps the middle of the deck and the sightline down the
 * hall. Long axis along X, facing -Z — you work it looking over the office and out through the
 * nose, with the globe at your back.
 */
export const CONSOLE = { x: 0, z: 4.6, width: 3.0, depth: 0.8, top: 1.05 };

/** Where the globe floats: behind the console, at the back of the bridge deck. */
export const GLOBE = {
  x: CONSOLE.x,
  z: 7.2,
  y: BRIDGE.y + 1.7,
  radius: 0.85,
  plinthRadius: 0.9
};

/**
 * The walkable floor.
 *
 * **The order is load-bearing.** `deckAt` is first-match, and the stair shares its XZ with the
 * hall floor it curves over — listed the other way round you would walk *under* the treads at
 * ground level instead of up them. The flank of the flight is then held by the step guard in
 * `fpv-controls.ts` rather than by a region boundary, which is why the railings matter: they
 * are what makes that invisible wall visible.
 *
 * Level 0 is the hall floor, level 1 the bridge. The stair belongs to both, and crossing its
 * midpoint swaps which set is clamped against.
 */
export const DECKS: Deck[] = [
  ...arcDecks({
    center: STAIR.center,
    innerRadius: STAIR_INNER,
    outerRadius: STAIR_OUTER,
    fromAngle: STAIR.fromAngle,
    toAngle: STAIR.toAngle,
    fromY: 0,
    toY: BRIDGE.y,
    levels: [0, 1],
    segments: 10,
    topExtension: STAIR.topExtension
  }),
  // The hall floor, aft of the nose. Runs all the way under the bridge — the soffit is at 3.3,
  // so the sheltered back of the room is walkable and is meant to be.
  flatDeck(rectRegion(-5.5, NOSE_Z - 0.4, 5.5, HALL.depth / 2 - WALL_CLEARANCE), 0, 0),
  // The nose. A trapezoid on the chord of the curving hull, which the quadratic taper keeps
  // strictly inside the hull — see `halfWidthAt`.
  flatDeck(
    [
      new THREE.Vector2(-(HALL.width / 2 - WALL_CLEARANCE), NOSE_Z + 0.4),
      new THREE.Vector2(HALL.width / 2 - WALL_CLEARANCE, NOSE_Z + 0.4),
      new THREE.Vector2(
        halfWidthAt(-HALL.depth / 2) - NOSE_TAPER * 0.3 - WALL_CLEARANCE,
        -HALL.depth / 2 + WALL_CLEARANCE
      ),
      new THREE.Vector2(
        -(halfWidthAt(-HALL.depth / 2) - NOSE_TAPER * 0.3 - WALL_CLEARANCE),
        -HALL.depth / 2 + WALL_CLEARANCE
      )
    ],
    0,
    0
  ),
  // The bridge, in two convex pieces around the stair well in its starboard corner. The
  // forward piece stops short of the flight, and the starboard piece starts aft of the well —
  // the only place either touches the arc is where the arc is already at deck height.
  flatDeck(rectRegion(-5.5, BRIDGE.frontZ + WALL_CLEARANCE, 4.2, BRIDGE.backZ - WALL_CLEARANCE), BRIDGE.y, 1),
  flatDeck(rectRegion(3.6, STAIR_WELL.backZ + WALL_CLEARANCE, 5.5, BRIDGE.backZ - WALL_CLEARANCE), BRIDGE.y, 1)
];

/** An axis-aligned footprint about a centre. `Box2` carries z in `.y`. */
export function footprint(x: number, z: number, w: number, d: number): THREE.Box2 {
  return new THREE.Box2(
    new THREE.Vector2(x - w / 2, z - d / 2),
    new THREE.Vector2(x + w / 2, z + d / 2)
  );
}
