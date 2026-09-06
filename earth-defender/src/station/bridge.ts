import * as THREE from 'three';
import { MATERIALS } from './shell';
import {
  BRIDGE,
  GLOBE,
  STAIR,
  STAIR_CENTER_RADIUS,
  STAIR_INNER,
  STAIR_OUTER,
  STAIR_TOP_X,
  bridgeSlabPolygon,
  footprint,
  halfWidthAt,
  onStairArc
} from './layout';

/**
 * The bridge: the mezzanine aft, the curved flight up to it, and the emitter the globe stands on.
 *
 * It is a deck rather than a room — no walls of its own, no ceiling, open to the hall on its
 * front edge. From the office in the nose you can see the console and the globe above and beyond
 * you; from the console you look forward down the whole hall and out through the glass.
 *
 * **The hull does most of the railing's job.** The deck runs out to meet the hull on both sides,
 * and there a curved wall already stops you — so the only railing up here is along the straight
 * front edge, stopping short at the head of the stairs. That also sidesteps the trap a railing
 * along a curved hull would fall into, since the hull leans in and the rail would be outside it
 * long before the slab was.
 *
 * **The stair runs along the starboard wall and arrives at the front edge.** Its shape is the
 * hull's own: `layout.ts` fits an arc to the wall it stands against, so it curves exactly as
 * much as the wall does and no more. Two things follow from that, and both are why this is
 * cheaper than the helix it replaced — its outer flank is the hull, so it carries one railing
 * instead of two, and its top tread is level with the mezzanine's front edge, so there is no
 * well and the slab is a plain outline.
 *
 * **The wall bulges above the floor.** The arc is fitted at floor level, but the hull's widest
 * point is around y = 2, so a flight of treads all cut to the arc would touch the wall at the
 * bottom and stand 0.27 m off it in the middle. Every tread and the outer stringer are run out
 * to `halfWidthAt` at their *own* height instead — which is the whole of "hugs the wall".
 *
 * The walkable surface is the ramp in `layout.ts`; everything here is what you see.
 */

/** Railings. A top rail and one mid rail, on posts. */
const RAIL = { height: 1.06, radius: 0.03, postEvery: 1.5 };

/** The emitter under the globe: a low drum with a recessed lens in its top. */
const PLINTH = { height: 0.34, lensInset: 0.26 };

const deckMaterial = new THREE.MeshStandardMaterial({
  color: 0x1b212a,
  roughness: 0.55,
  metalness: 0.35,
  side: THREE.DoubleSide
});

/** Warm against the room's cold, and one of the two warm things in it. */
const emitterGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 0.95, 0.55) });

/** A dark, matte lens — it has to read as something a projection comes out of, not a lamp. */
const lensMaterial = new THREE.MeshStandardMaterial({
  color: 0x0c0f14,
  roughness: 0.35,
  metalness: 0.1
});

export interface Bridge {
  group: THREE.Group;
  /** Footprints on the bridge deck the player is pushed out of — the globe's plinth. */
  obstacles: THREE.Box2[];
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * The radius at which the flight meets the hull at height `y`, a fraction `t` along the run.
 *
 * `STAIR_OUTER` is where the arc meets the wall *at floor level*; the hull leans out above that
 * and back in again higher still, so a tread's own reach depends on how far up the flight it is.
 * Two or three corrections converge, because the radius runs within a few degrees of X and the
 * first step therefore recovers ~97% of the error.
 */
function wallRadiusAt(t: number, y: number): number {
  let radius = STAIR_OUTER;
  for (let i = 0; i < 3; i++) {
    const p = onStairArc(radius, t);
    radius += halfWidthAt(p.y, y) - p.x;
  }
  return radius;
}

/**
 * A straight run of railing along one axis: a top rail, a mid rail and posts. The other two
 * coordinates are fixed. Every straight railing aboard is axis-aligned, and a general one would
 * be more code for no case.
 */
function railing(axis: 'x' | 'z', from: number, to: number, fixed: number, baseY: number): THREE.Group {
  const run = new THREE.Group();
  const length = Math.abs(to - from);
  const mid = (from + to) / 2;

  for (const y of [RAIL.height, RAIL.height * 0.55]) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(RAIL.radius, RAIL.radius, length, 8),
      MATERIALS.frame
    );
    bar.rotation.z = Math.PI / 2;
    if (axis === 'z') bar.rotation.y = Math.PI / 2;
    bar.position.set(axis === 'x' ? mid : fixed, baseY + y, axis === 'x' ? fixed : mid);
    run.add(bar);
  }

  const posts = Math.max(2, Math.round(length / RAIL.postEvery) + 1);
  for (let i = 0; i < posts; i++) {
    const along = from + ((to - from) * i) / (posts - 1);
    run.add(
      box(
        0.05,
        RAIL.height,
        0.05,
        MATERIALS.strut,
        axis === 'x' ? along : fixed,
        baseY + RAIL.height / 2,
        axis === 'x' ? fixed : along
      )
    );
  }
  return run;
}

/**
 * A railing following the stair's arc at one radius, climbing with it.
 *
 * Built as a chain of short straight bars between posts rather than as a swept curve: the bars
 * are under half a metre each, and at that length the chord is indistinguishable from the arc
 * while the geometry stays two primitives instead of a lathe.
 */
function arcRailing(
  radius: number,
  steps: number,
  fromY: number,
  toY: number,
  fromT = 0
): THREE.Group {
  const run = new THREE.Group();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = fromT + ((1 - fromT) * i) / steps;
    const p = onStairArc(radius, t);
    points.push(new THREE.Vector3(p.x, fromY + (toY - fromY) * t, p.y));
  }

  for (const point of points) {
    run.add(box(0.05, RAIL.height, 0.05, MATERIALS.strut, point.x, point.y + RAIL.height / 2, point.z));
  }

  for (let i = 0; i < steps; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (const y of [RAIL.height, RAIL.height * 0.55]) {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(RAIL.radius, RAIL.radius, a.distanceTo(b), 8),
        MATERIALS.frame
      );
      bar.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + y, (a.z + b.z) / 2);
      bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      run.add(bar);
    }
  }
  return run;
}

export function buildBridge(): Bridge {
  const group = new THREE.Group();
  const railY = BRIDGE.y + RAIL.height;

  // --- the slab -----------------------------------------------------------------------------
  // `ExtrudeGeometry` lies in XY and extrudes towards +Z; rotating by +π/2 about X sends shape-Y
  // to world +Z and the extrusion to world -Y, so the slab hangs *down* from `BRIDGE.y` and gets
  // its soffit and the well's inner faces for free.
  const outline = bridgeSlabPolygon();
  const deckShape = new THREE.Shape();
  deckShape.moveTo(outline[0].x, outline[0].y);
  for (let i = 1; i < outline.length; i++) deckShape.lineTo(outline[i].x, outline[i].y);
  deckShape.closePath();

  const slab = new THREE.Mesh(
    new THREE.ExtrudeGeometry(deckShape, { depth: BRIDGE.thickness, bevelEnabled: false }),
    deckMaterial
  );
  slab.rotation.x = Math.PI / 2;
  slab.position.y = BRIDGE.y;
  group.add(slab);

  // --- railings -----------------------------------------------------------------------------
  // One run, along the front edge, from the port side to the head of the stairs. Its port end is
  // clamped to the hull at *railing* height, not at deck height; the slab reaches further out
  // than this on both sides, and that leftover strip is a coaming with the hull behind it.
  const frontLimit = halfWidthAt(BRIDGE.frontZ, railY) - 0.25;
  group.add(railing('x', -frontLimit, STAIR_TOP_X, BRIDGE.frontZ, BRIDGE.y));

  // The strip along the slab's front edge. This is the line that says "there is a floor up
  // there" from anywhere on the ground. It runs the *whole* edge, past the head of the stairs to
  // the hull, because it is the edge it draws, not the railing.
  //
  // On `ledFloor` with the rest of the deck edges: blooming, thirteen metres of strip straight
  // across the middle of the frame was a glare bar between you and the window from anywhere aft.
  // The pair of lamps under the slab light that space; this only has to draw the edge.
  const ledFrom = -frontLimit;
  const ledTo = halfWidthAt(BRIDGE.frontZ, BRIDGE.y) - 0.1;
  group.add(
    box(
      ledTo - ledFrom,
      0.06,
      0.06,
      MATERIALS.ledFloor,
      (ledFrom + ledTo) / 2,
      BRIDGE.y - BRIDGE.thickness - 0.05,
      BRIDGE.frontZ
    )
  );

  // --- the staircase --------------------------------------------------------------------------
  // Treads only, on two curved stringers. There are no risers: at 31° the gap between treads is
  // barely visible from the floor, and — since the flight now stands inside the glazing — a
  // closed one would be a 5 m wall across the starboard window instead of a row of slats.
  //
  // The walkable surface is the ramp in `layout.ts`, not these steps, so mid-tread the eye rides
  // half a rise — 12 cm — below the tread it is nominally on, and half a rise above it at each
  // nosing. That is the usual approximation and it is invisible with no body to look at, where
  // stepping the eye instead would put a 25 cm jolt in it eleven times a flight.
  const rise = BRIDGE.y / STAIR.treads;
  const sweep = STAIR.toAngle - STAIR.fromAngle;
  const going = (STAIR_CENTER_RADIUS * Math.abs(sweep)) / STAIR.treads;

  for (let i = 0; i < STAIR.treads; i++) {
    const t = (i + 0.5) / STAIR.treads;
    const angle = STAIR.fromAngle + sweep * t;
    const top = rise * (i + 1);
    // Run out to the hull at this tread's own height, not to the arc. The wall is up to 0.27 m
    // further out in the middle of the flight than it is at the floor, and a tread that stopped
    // short of it would leave a slot you could see the planet through.
    const outer = wallRadiusAt(t, top);
    const p = onStairArc((STAIR_INNER + outer) / 2, t);
    const tread = box(outer - STAIR_INNER, 0.06, going, deckMaterial, p.x, top - 0.03, p.y);
    // Local +X points along `(cos φ, 0, -sin φ)` after `rotation.y = φ`, and the tread's width
    // has to run radially — outwards is `(cos a, 0, sin a)`, so `φ = -a`.
    tread.rotation.y = -angle;
    group.add(tread);
  }

  // Two stringers under the treads: one inboard, carrying the railing, and one against the wall,
  // which has to follow the same bulge the treads do.
  const stringers: Array<(t: number, y: number) => number> = [
    () => STAIR_INNER + 0.05,
    (t, y) => wallRadiusAt(t, y) - 0.05
  ];
  for (const radiusAt of stringers) {
    const steps = STAIR.treads;
    for (let i = 0; i < steps; i++) {
      const ta = i / steps;
      const tb = (i + 1) / steps;
      const ya = (BRIDGE.y * i) / steps;
      const yb = (BRIDGE.y * (i + 1)) / steps;
      const a = onStairArc(radiusAt(ta, ya), ta);
      const b = onStairArc(radiusAt(tb, yb), tb);
      const from = new THREE.Vector3(a.x, ya - 0.18, a.y);
      const to = new THREE.Vector3(b.x, yb - 0.18, b.y);
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.26, from.distanceTo(to)),
        MATERIALS.strut
      );
      segment.position.copy(from).add(to).multiplyScalar(0.5);
      segment.lookAt(to);
      group.add(segment);
    }
  }

  // **One** railing, on the inboard flank. The outboard flank is the hull, which is the whole
  // point of putting the flight against it — the old freestanding helix was exposed on both
  // sides and needed a rail on each.
  //
  // It is not trim. The step guard in `fpv-controls.ts` lets you board the flight only where it
  // is under `MAX_STEP` off the ground and refuses to let you step off sideways once you are
  // above that, so without this rail there is a 5 m invisible wall down the middle of the hall
  // with nothing to explain it. It starts a little way up, which leaves open exactly the stretch
  // at the foot the guard actually lets you walk on from the floor.
  group.add(arcRailing(STAIR_INNER + 0.08, STAIR.treads, 0, BRIDGE.y, 0.07));

  // --- the emitter ----------------------------------------------------------------------------
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(
      GLOBE.plinthRadius * 0.88,
      GLOBE.plinthRadius,
      PLINTH.height,
      8,
      1,
      false,
      Math.PI / 8
    ),
    MATERIALS.strut
  );
  plinth.position.set(GLOBE.x, BRIDGE.y + PLINTH.height / 2, GLOBE.z);
  group.add(plinth);

  const lensRadius = GLOBE.plinthRadius * 0.88 - PLINTH.lensInset;
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(lensRadius, lensRadius, 0.05, 8, 1, false, Math.PI / 8),
    lensMaterial
  );
  lens.position.set(GLOBE.x, BRIDGE.y + PLINTH.height - 0.02, GLOBE.z);
  group.add(lens);

  const emitterRing = new THREE.Mesh(
    new THREE.TorusGeometry(lensRadius + 0.05, 0.016, 8, 40),
    emitterGlow
  );
  emitterRing.rotation.x = Math.PI / 2;
  emitterRing.position.set(GLOBE.x, BRIDGE.y + PLINTH.height + 0.005, GLOBE.z);
  group.add(emitterRing);

  const emitterLamp = new THREE.PointLight(0xffb877, 1.4, 4.5, 2);
  emitterLamp.position.set(GLOBE.x, BRIDGE.y + PLINTH.height + 0.25, GLOBE.z);
  group.add(emitterLamp);

  // --- lighting -------------------------------------------------------------------------------
  // The back of the hall is roofed over at 3.3 by the slab, so without these the deepest part of
  // the floor is simply black. Warm, because it is the sheltered part of the room — and the
  // contrast with the cold glass forward is the whole brief.
  for (const x of [-2.4, 2.4]) {
    const lamp = new THREE.PointLight(0xffc79a, 6, 9, 2);
    lamp.position.set(x, BRIDGE.y - BRIDGE.thickness - 0.3, 4.6);
    group.add(lamp);
  }

  // Two more over the deck. Hung at a fixed height above it rather than under the crown: the
  // roof over the bridge is 6.7, and a lamp up there is four metres from the floor it is meant
  // to light. Warm, like the rest — the cold in this room comes in through the glass, and having
  // the lamps be cold as well left the whole interior reading blue.
  for (const [x, z] of [
    [-2.2, 4.2],
    [2.2, 4.2]
  ]) {
    const lamp = new THREE.PointLight(0xffc39a, 9, 11, 2);
    lamp.position.set(x, BRIDGE.y + 1.9, z);
    group.add(lamp);
  }

  return {
    group,
    // Square rather than octagonal, which lets you get a little closer at the corners than the
    // drum actually allows — nobody has ever noticed this in a room.
    obstacles: [footprint(GLOBE.x, GLOBE.z, GLOBE.plinthRadius * 2, GLOBE.plinthRadius * 2)]
  };
}
