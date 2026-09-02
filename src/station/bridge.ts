import * as THREE from 'three';
import { MATERIALS } from './shell';
import {
  BRIDGE,
  GLOBE,
  HALL,
  STAIR,
  STAIR_INNER,
  STAIR_OUTER,
  STAIR_WELL,
  footprint
} from './layout';

/**
 * The bridge: the mezzanine across the back of the hall, the curved flight up to it, and the
 * emitter the globe stands on.
 *
 * It is a deck rather than a room — no walls of its own, no ceiling, open to the hall on its
 * front edge. That is the point: from the desk in the nose you can see the console and the
 * globe above and beyond you, and from the console you look forward down the whole hall and out
 * through the glass. A second storey that closed itself off would just be two rooms stacked.
 *
 * **The stair turns.** A quarter arc, rising on the starboard side and coming out facing aft at
 * the deck's front edge, through a well bitten out of the slab's starboard corner. It is curved
 * because the hull is: a straight flight bolted into a hall that tapers reads as scaffolding.
 * The walkable surface is the smooth ramp in `layout.ts`; everything here is what you see.
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

/** A point on the stair's arc, at radius `r` and fraction `t` along the flight. */
function onArc(r: number, t: number): THREE.Vector2 {
  const a = STAIR.fromAngle + (STAIR.toAngle - STAIR.fromAngle) * t;
  return new THREE.Vector2(
    STAIR.center.x + Math.cos(a) * r,
    STAIR.center.y + Math.sin(a) * r
  );
}

/**
 * A straight run of railing along one axis: a top rail, a mid rail and posts. The other two
 * coordinates are fixed. Every straight railing in the hall is axis-aligned, and a general one
 * would be more code for no case.
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
    const p = onArc(radius, t);
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
      // The cylinder is built along its own Y; aim it at the next post.
      bar.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + y, (a.z + b.z) / 2);
      bar.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize()
      );
      run.add(bar);
    }
  }
  return run;
}

export function buildBridge(): Bridge {
  const group = new THREE.Group();
  const half = HALL.width / 2;
  const deckCenterZ = (BRIDGE.frontZ + BRIDGE.backZ) / 2;

  // --- the slab -----------------------------------------------------------------------------
  // Extruded rather than a box, because it has a bite taken out of its starboard corner for the
  // stair well. `ExtrudeGeometry` lies in XY and extrudes towards +Z; rotating by +π/2 about X
  // sends shape-Y to world +Z and the extrusion to world -Y, so the slab hangs *down* from
  // `BRIDGE.y` and gets its soffit and the well's inner faces for free.
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-half, BRIDGE.frontZ);
  deckShape.lineTo(STAIR_WELL.minX, BRIDGE.frontZ);
  deckShape.lineTo(STAIR_WELL.minX, STAIR_WELL.backZ);
  deckShape.lineTo(STAIR_WELL.maxX, STAIR_WELL.backZ);
  deckShape.lineTo(STAIR_WELL.maxX, BRIDGE.backZ);
  deckShape.lineTo(-half, BRIDGE.backZ);
  deckShape.closePath();

  const slab = new THREE.Mesh(
    new THREE.ExtrudeGeometry(deckShape, { depth: BRIDGE.thickness, bevelEnabled: false }),
    deckMaterial
  );
  slab.rotation.x = Math.PI / 2;
  slab.position.y = BRIDGE.y;
  group.add(slab);

  // The strip along the slab's front edge. This is the line that says "there is a floor up
  // there" from anywhere on the ground, and the only lighting the underside gets that is
  // visible from across the room.
  group.add(
    box(
      STAIR_WELL.minX + half - 0.4,
      0.06,
      0.06,
      MATERIALS.led,
      (STAIR_WELL.minX - half) / 2,
      BRIDGE.y - BRIDGE.thickness - 0.05,
      BRIDGE.frontZ
    )
  );

  // --- railings -----------------------------------------------------------------------------
  // Along the deck's front edge as far as the well, then round the two exposed sides of the
  // well itself. The well's edge is also where the step guard in `fpv-controls.ts` stops you
  // walking into the drop, so the railing is what makes that limit visible.
  group.add(railing('x', -half + 0.2, STAIR_WELL.minX, BRIDGE.frontZ, BRIDGE.y));
  group.add(railing('z', BRIDGE.frontZ, STAIR_WELL.backZ, STAIR_WELL.minX, BRIDGE.y));

  // --- the staircase --------------------------------------------------------------------------
  // Treads only, on two curved stringers. There are no risers: at 33° the gap between treads is
  // barely visible from the floor, and a closed flight would wall off the starboard side.
  //
  // The walkable surface is the ramp in `layout.ts`, not these steps, so mid-tread the eye rides
  // half a rise — 15 cm — below the tread it is nominally on, and half a rise above it at each
  // nosing. That is the usual approximation and it is invisible with no body to look at, where
  // stepping the eye instead would put a 30 cm jolt in it twelve times a flight.
  const rise = BRIDGE.y / STAIR.treads;
  const sweep = STAIR.toAngle - STAIR.fromAngle;
  const going = (STAIR.centerRadius * Math.abs(sweep)) / STAIR.treads;
  const width = STAIR_OUTER - STAIR_INNER;

  for (let i = 0; i < STAIR.treads; i++) {
    const t = (i + 0.5) / STAIR.treads;
    const angle = STAIR.fromAngle + sweep * t;
    const p = onArc(STAIR.centerRadius, t);
    const tread = box(width, 0.06, going, deckMaterial, p.x, rise * (i + 1) - 0.03, p.y);
    // Local +X points along `(cos φ, 0, -sin φ)` after `rotation.y = φ`, and the tread's width
    // has to run radially — outwards is `(cos a, 0, sin a)`, so `φ = -a`.
    tread.rotation.y = -angle;
    group.add(tread);
  }

  // Stringers: a chain of short boxes under the nosings at each radius, following the arc up.
  for (const radius of [STAIR_INNER + 0.05, STAIR_OUTER - 0.05]) {
    const steps = STAIR.treads;
    for (let i = 0; i < steps; i++) {
      const a = onArc(radius, i / steps);
      const b = onArc(radius, (i + 1) / steps);
      const ya = (BRIDGE.y * i) / steps;
      const yb = (BRIDGE.y * (i + 1)) / steps;
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

  // **Both** flanks. A curved flight standing free in the middle of a floor is exposed on the
  // inside and the outside alike, and the railings are not decoration here: the step guard in
  // `fpv-controls.ts` will let you board the flight only where it is under `MAX_STEP` off the
  // ground and will refuse to let you step off sideways once you are above that, so without a
  // rail on each side there is an invisible wall along the whole length of the stairs with
  // nothing to explain it.
  //
  // They start a little way up (`RAIL_START`), which leaves the bottom of the flight open on
  // both sides — the same stretch the guard actually lets you walk on from the floor.
  const RAIL_START = 0.08;
  group.add(arcRailing(STAIR_INNER - 0.06, STAIR.treads, 0, BRIDGE.y, RAIL_START));
  group.add(arcRailing(STAIR_OUTER + 0.06, STAIR.treads, 0, BRIDGE.y, RAIL_START));

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
  // The back of the hall is roofed over at 3.3 and the hall's own lamps are at 6.7, so without
  // these the deepest part of the floor is simply black. Warm, because it is the sheltered part
  // of the room — and the contrast with the cold glass forward is the whole brief.
  for (const x of [-3.2, 3.2]) {
    const lamp = new THREE.PointLight(0xffc79a, 1.6, 9, 2);
    lamp.position.set(x, BRIDGE.y - BRIDGE.thickness - 0.3, deckCenterZ);
    group.add(lamp);
  }

  for (const x of [-3.0, 3.0]) {
    const lamp = new THREE.PointLight(0x66d9ff, 2.2, 12, 2);
    lamp.position.set(x, HALL.height - 0.5, deckCenterZ);
    group.add(lamp);
  }

  return {
    group,
    // Square rather than octagonal, which lets you get a little closer at the corners than the
    // drum actually allows — nobody has ever noticed this in a room.
    obstacles: [footprint(GLOBE.x, GLOBE.z, GLOBE.plinthRadius * 2, GLOBE.plinthRadius * 2)]
  };
}
