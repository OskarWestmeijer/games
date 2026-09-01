import * as THREE from 'three';
import {
  insetRegion,
  rectRegion,
  regularRegion,
  type Region
} from '../regions';
import { ROOM } from './office/room';

/**
 * The bauplan, as data.
 *
 * Four arms on multiples of 90° around an octagonal hub. The right angles are not a style
 * choice: they keep every footprint axis-aligned once placed, which is what lets furniture
 * stay on cheap `Box2` push-out and lets rooms be authored straight in station space.
 *
 * Bearing 0° is station **-Z**, the office arm — the same -Z the pod's window has always been
 * on, so the office needs no rotation and its tuned framing carries over untouched. The
 * planet is swung to a different arm by turning the *station*, not by moving a room.
 *
 *                              +Z
 *                       ┌────────────┐
 *                       │  airlock   │ 180°
 *                       └─────┬──────┘
 *                    ╱────────┴────────╲
 *        ┌────────┐  │                 │  ┌──────────────────┐
 *        │reserve │──┤       hub       ├──┤    navigation    │  → +X
 *        │  270°  │  │    ◉ globe      │  │  90°  cupola     │
 *        └────────┘  ╲────────┬────────╱  └──────────────────┘
 *                       ┌─────┴──────┐
 *                       │   office   │ 0°
 *                       └────────────┘
 *                              -Z
 */

/** How far the eye is held off a wall. Doubles as the "you have a body" fudge. */
const WALL_CLEARANCE = 0.45;

/** Corridors are narrow enough that full wall clearance would leave nowhere to walk. */
const CORRIDOR_CLEARANCE = 0.25;

/**
 * How far a corridor's walkable region runs past a room's, so the two share floor rather than
 * butting up edge to edge — under the player radius of 0.32 the clamp catches you on the seam
 * and the doorway does not let you through.
 *
 * Measured from the room's *walkable* edge, not from its wall, which is why the clearance is
 * in the sum. Extending by the overlap alone leaves 0.05 m of shared floor at the office and
 * airlock doors and 0.08 m at the hub — every doorway in the station a snag.
 */
const REGION_OVERLAP = 0.5;
const REGION_EXTEND = WALL_CLEARANCE + REGION_OVERLAP;

export const HUB = { radius: 4.6, height: 4.0 };
/** Distance from the centre to a facet — where the corridors start. */
export const HUB_APOTHEM = HUB.radius * Math.cos(Math.PI / 8);

export const CORRIDOR = { halfWidth: 0.9, height: 2.4 };

/**
 * Where the office module sits. Its outer wall lands at z = -11.45, and `room.ts` builds it
 * around its own centre, so the group is offset by half the room's depth past the corridor.
 */
export const OFFICE_PLACEMENT = { x: 0, z: -(6.45 + ROOM.depth / 2) };
export const OFFICE_INNER_FACE = -6.45;

export const NAV = { innerFace: 7.85, nose: 14.35, halfWidth: 3.0, noseHalfWidth: 1.7, height: 3.2 };
export const AIRLOCK = { innerFace: 5.85, outerFace: 9.35, halfWidth: 2.25, height: 2.6 };
export const RESERVE = { innerFace: -6.45, outerFace: -10.95, halfWidth: 3.0, height: 3.2 };

/** The hub's eight facets are centred on multiples of 45°, so four of them face the arms. */
export const HUB_FOOTPRINT: Region = regularRegion(0, 0, HUB.radius, 8);

/**
 * Which hub edge faces which arm. Edge `i` runs from vertex `i` to vertex `i + 1`; with
 * vertices at 22.5° + k·45°, the edge spanning -22.5°..+22.5° is the one centred on +X.
 */
export const HUB_DOOR_EDGES = { nav: 7, airlock: 1, reserve: 3, office: 5 };

/** Nose first, then round: edges 1, 2 and 3 are the glazed facets of the cupola. */
export const NAV_FOOTPRINT: Region = [
  new THREE.Vector2(NAV.innerFace, -NAV.halfWidth),
  new THREE.Vector2(11.85, -NAV.halfWidth),
  new THREE.Vector2(NAV.nose, -NAV.noseHalfWidth),
  new THREE.Vector2(NAV.nose, NAV.noseHalfWidth),
  new THREE.Vector2(11.85, NAV.halfWidth),
  new THREE.Vector2(NAV.innerFace, NAV.halfWidth)
];
export const NAV_GLAZED_EDGES = [1, 2, 3];
export const NAV_DOOR_EDGE = 5;

/**
 * The glass floor: an octagon about 3 m across, out in the nose.
 *
 * This is the one window whose view does not depend on which way the station is turned. The
 * angle from a floor panel to the nadir is `90° - pitch` — there is no bearing term in it at
 * all — so navigation sees the planet at every rotation, where a wall window only sees it
 * when its arm happens to be aimed the right way.
 */
export const NAV_GLASS_FLOOR: Region = regularRegion(12.9, 0, 1.55, 8);

export const AIRLOCK_FOOTPRINT: Region = rectRegion(
  -AIRLOCK.halfWidth,
  AIRLOCK.innerFace,
  AIRLOCK.halfWidth,
  AIRLOCK.outerFace
);
export const AIRLOCK_DOOR_EDGE = 0;

export const RESERVE_FOOTPRINT: Region = rectRegion(
  RESERVE.outerFace,
  -RESERVE.halfWidth,
  RESERVE.innerFace,
  RESERVE.halfWidth
);
export const RESERVE_DOOR_EDGE = 1;

/**
 * Corridors are drawn short and walked long.
 *
 * The *geometry* runs from the hub facet to the module's inner face, which is where the walls
 * actually are. The *region* runs half a metre further into the rooms at both ends, so the
 * walkable union overlaps rather than butting up edge to edge. Building the geometry to the
 * longer figure would push corridor walls out into the middle of both rooms.
 */
export interface CorridorSpec {
  /** Where the walls go. */
  geometry: Region;
  /** Where you may stand. Overlaps the rooms at both ends. */
  region: Region;
  /** Which two edges are the open ends. */
  openEdges: [number, number];
}

function corridorAlongZ(fromZ: number, toZ: number): CorridorSpec {
  const h = CORRIDOR.halfWidth;
  const w = h - CORRIDOR_CLEARANCE;
  return {
    geometry: rectRegion(-h, Math.min(fromZ, toZ), h, Math.max(fromZ, toZ)),
    region: rectRegion(
      -w,
      Math.min(fromZ, toZ) - REGION_EXTEND,
      w,
      Math.max(fromZ, toZ) + REGION_EXTEND
    ),
    openEdges: [0, 2]
  };
}

function corridorAlongX(fromX: number, toX: number): CorridorSpec {
  const h = CORRIDOR.halfWidth;
  const w = h - CORRIDOR_CLEARANCE;
  return {
    geometry: rectRegion(Math.min(fromX, toX), -h, Math.max(fromX, toX), h),
    region: rectRegion(
      Math.min(fromX, toX) - REGION_EXTEND,
      -w,
      Math.max(fromX, toX) + REGION_EXTEND,
      w
    ),
    openEdges: [1, 3]
  };
}

export const CORRIDORS = {
  office: corridorAlongZ(OFFICE_INNER_FACE, -HUB_APOTHEM),
  nav: corridorAlongX(HUB_APOTHEM, NAV.innerFace),
  airlock: corridorAlongZ(HUB_APOTHEM, AIRLOCK.innerFace),
  reserve: corridorAlongX(RESERVE.innerFace, -HUB_APOTHEM)
};

/**
 * The walkable floor: every room inset by wall clearance, plus the corridors that overlap
 * them. `clampToRegions` holds the player inside the union of these.
 */
export const WALKABLE: Region[] = [
  insetRegion(HUB_FOOTPRINT, WALL_CLEARANCE),
  // The office's own bounds, translated out to where the module sits.
  rectRegion(
    -ROOM.width / 2 + WALL_CLEARANCE,
    OFFICE_PLACEMENT.z - ROOM.depth / 2 + WALL_CLEARANCE,
    ROOM.width / 2 - WALL_CLEARANCE,
    OFFICE_PLACEMENT.z + ROOM.depth / 2 - WALL_CLEARANCE
  ),
  insetRegion(NAV_FOOTPRINT, WALL_CLEARANCE),
  insetRegion(AIRLOCK_FOOTPRINT, WALL_CLEARANCE),
  insetRegion(RESERVE_FOOTPRINT, WALL_CLEARANCE),
  CORRIDORS.office.region,
  CORRIDORS.nav.region,
  CORRIDORS.airlock.region,
  CORRIDORS.reserve.region
];

/** Where the globe floats, and how big it is. */
export const GLOBE = { radius: 1.15, centerY: 1.95, plinthRadius: 1.2 };

/** The navigation console: a canted desk on the inboard side, facing out over the glass. */
export const CONSOLE = { x: 8.75, width: 3.0, depth: 0.8, top: 1.05 };
