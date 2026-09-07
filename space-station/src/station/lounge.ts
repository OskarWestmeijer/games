import * as THREE from 'three';
import { MATERIALS } from './shell';
import { LOUNGE, footprint } from './layout';
import { buildRadio, type Radio } from './radio';

/**
 * The lounge: a raised dais in the point of the nose, a **U of couch open to the window**, a low
 * table in the middle of it, and the radio on the table.
 *
 * This is the whole of the lower deck's furniture, and it is the only room in the station that is
 * *upholstered* rather than built. Everything else aboard is hull, frame and deck plate; here
 * there is fabric, leather, cushions and a plant, because the contrast is the brief — see "Real
 * outside, warm inside" in CLAUDE.md.
 *
 * **The opening faces -Z**, which is the way the nose points and the way `updateOrbit()` aims the
 * station at the planet. So the couch wraps the aft three quarters of the circle and the mouth of
 * it looks straight out of the glass, with the arms either side of you. That is the arrangement
 * the reference sheet draws, and it replaced a closed ring amidships behind a desk.
 *
 * **The dais is floor, and the couch is the obstacle.** The other way round — which is how this
 * was built while the ring was closed — there was a hand's width of tread outside the couch and
 * an unreachable pocket inside, so the whole assembly was one box you walked around. Opening the
 * U makes the pocket the best standing spot in the station, so it has to be reachable: the dais
 * is a `Deck` in `layout.ts` and the ring below is what pushes you out.
 *
 * ### How it is built
 *
 * **Annular sectors, not lathes.** A `LatheGeometry` of a C-shaped profile is one draw and does
 * make a couch-shaped thing, but everything it makes is one surface with one material — no seam
 * between the seat and the back, no division between cushions, and no way to put a rolled arm on
 * the end. Extruding a `THREE.Shape` built from two `absarc`s gives a solid annular sector with a
 * bevel, which is exactly a cushion; a row of them with a degree of gap between is exactly a
 * bench. That division is most of what makes it read as furniture rather than as a moulding.
 */

/** Where the mouth of the U points, as an angle in the shape plane: -Z. */
const GAP_CENTER = -Math.PI / 2;

/** How the seat is divided. Each cushion is one extruded sector; the gaps show the joins. */
const CUSHIONS = 9;
const CUSHION_GAP = THREE.MathUtils.degToRad(1.6);

/** How deep the back is, measured in from `couchOuter`. */
const BACK_DEPTH = 0.26;

/** Cushions, in the pale warm grey the reference sheet uses against the dark leather. */
const cushionMaterial = new THREE.MeshStandardMaterial({
  color: 0x8d857a,
  roughness: 0.95,
  metalness: 0
});

/** Base, back and arms: dark, faintly sheened, so the pale seat sits *in* something. */
const leatherMaterial = new THREE.MeshStandardMaterial({
  color: 0x2b2b30,
  roughness: 0.62,
  metalness: 0.06
});

/** Throw pillows. Two colours, alternating: one that recedes and one that does not. */
const pillowMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.96, metalness: 0 }),
  new THREE.MeshStandardMaterial({ color: 0x7a4632, roughness: 0.96, metalness: 0 })
];

/**
 * Matte, unlike `MATERIALS.strut`: a metal top here throws a specular starburst off its cap.
 *
 * **Warm, and that is the whole reason it is not the near-black it started as.** The table's top
 * face and the dais it stands on are the two big upward-facing surfaces in the lounge, so they
 * both catch the cold blue fill off the planet and almost nothing else — at 0x24211e against the
 * dais's 0x272d38 they came out the same washed pale grey and the table stopped existing. A warm
 * brown is the one thing in the room the earthlight cannot flatten into the floor.
 */
const tableMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a3626,
  roughness: 0.68,
  metalness: 0.04
});

const daisMaterial = new THREE.MeshStandardMaterial({
  color: 0x272d38,
  roughness: 0.6,
  metalness: 0.25
});

const potMaterial = new THREE.MeshStandardMaterial({ color: 0x6b5540, roughness: 0.8, metalness: 0.05 });
const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x3f6b41, roughness: 0.85, metalness: 0 });

export interface Lounge {
  group: THREE.Group;
  /** Footprints in station-space XZ the player is pushed out of. */
  obstacles: THREE.Box2[];
  /** The radio's aiming volume, for `station/index.ts` to hand to `interaction.ts`. */
  radioTarget: THREE.Object3D;
  setRadioLit(lit: boolean): void;
}

/**
 * A solid annular sector: the region between two radii and two angles, `thickness` deep, with its
 * **top** face at `top`.
 *
 * `ExtrudeGeometry` lies in XY and extrudes towards +Z; rotating by +π/2 about X sends shape-Y to
 * world +Z and the extrusion down to -Y, so the shape's coordinates read straight as (x, z) and
 * the solid hangs below `top`. The same idiom as the bridge slab.
 */
function sector(
  innerRadius: number,
  outerRadius: number,
  fromAngle: number,
  toAngle: number,
  top: number,
  thickness: number,
  material: THREE.Material,
  bevel = 0
): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, fromAngle, toAngle, false);
  shape.absarc(0, 0, innerRadius, toAngle, fromAngle, true);
  shape.closePath();

  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, thickness - bevel * 2),
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      curveSegments: 48
    }),
    material
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = top - bevel;
  return mesh;
}

export function buildLounge(): Lounge {
  const group = new THREE.Group();
  group.position.set(LOUNGE.x, 0, LOUNGE.z);

  const dais = LOUNGE.daisHeight;
  const from = GAP_CENTER + LOUNGE.openAngle / 2;
  const to = GAP_CENTER + Math.PI * 2 - LOUNGE.openAngle / 2;
  const backInner = LOUNGE.couchOuter - BACK_DEPTH;

  // --- the dais -------------------------------------------------------------------------------
  // Slightly conical, so it reads as a plinth set into the floor rather than as a disc lying on
  // it. Two segments' worth of taper is enough; any more and it looks like a wedding cake.
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(LOUNGE.daisRadius, LOUNGE.daisRadius + 0.08, dais, 48),
    daisMaterial
  );
  plinth.position.y = dais / 2;
  group.add(plinth);

  // Two rings let into it: one at the outer edge and one tucked against the foot of the couch.
  // The same trick as the rim in the nose — but on `MATERIALS.ledFloor`, below the bloom
  // threshold. Blooming, two full circles of strip a metre and a half below the eye were the
  // brightest thing in every frame taken from the mouth of the U, which put a glare across the
  // one view the lounge exists for. They mark the step now; the planet lights the room.
  for (const [radius, y] of [
    [LOUNGE.daisRadius + 0.02, dais - 0.03],
    [LOUNGE.couchOuter + 0.05, dais + 0.03]
  ]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 8, 72), MATERIALS.ledFloor);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }

  // --- the couch ------------------------------------------------------------------------------
  // Base: a dark drum under the seat, held in from the outer edge so the light ring above washes
  // across it and the couch reads as sitting a little proud of the dais.
  group.add(
    sector(LOUNGE.couchInner + 0.04, LOUNGE.couchOuter - 0.03, from, to, LOUNGE.seatHeight - 0.10, LOUNGE.seatHeight - 0.10 - dais - 0.02, leatherMaterial)
  );

  // Seat cushions, one sector each with a degree of gap between them and a soft bevel.
  const span = (to - from) / CUSHIONS;
  for (let i = 0; i < CUSHIONS; i++) {
    group.add(
      sector(
        LOUNGE.couchInner,
        backInner + 0.02,
        from + i * span + CUSHION_GAP / 2,
        from + (i + 1) * span - CUSHION_GAP / 2,
        LOUNGE.seatHeight,
        0.13,
        cushionMaterial,
        0.035
      )
    );
  }

  // The back, and the roll along the top of it. A torus is the honest shape for a rolled edge and
  // it costs one mesh; without it the back is a wall with a square top, which is the single
  // clearest tell that a couch was made out of boxes.
  group.add(
    sector(backInner, LOUNGE.couchOuter, from, to, LOUNGE.backHeight - 0.09, LOUNGE.backHeight - 0.09 - LOUNGE.seatHeight + 0.16, leatherMaterial)
  );
  const roll = new THREE.Mesh(
    new THREE.TorusGeometry(LOUNGE.couchOuter - BACK_DEPTH / 2, BACK_DEPTH / 2, 10, 72, to - from),
    leatherMaterial
  );
  // `TorusGeometry` starts its arc on +X and runs anticlockwise in its own XY plane; laying it
  // down with -π/2 about X puts that plane on the floor with the arc running the same way the
  // sectors do, so `from` lines up without a sign flip.
  roll.rotation.x = -Math.PI / 2;
  roll.rotation.z = from;
  roll.position.y = LOUNGE.backHeight - 0.09;
  group.add(roll);

  // The arms: the two cut ends of the U, capped with the same roll turned upright so the couch
  // finishes rather than stops.
  for (const angle of [from, to]) {
    const mid = (LOUNGE.couchInner + LOUNGE.couchOuter) / 2;
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, LOUNGE.couchOuter - LOUNGE.couchInner, 16, 1, false),
      leatherMaterial
    );
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = -angle;
    arm.position.set(Math.cos(angle) * mid, LOUNGE.seatHeight + 0.19, Math.sin(angle) * mid);
    group.add(arm);
    group.add(
      sector(
        LOUNGE.couchInner,
        LOUNGE.couchOuter,
        angle - 0.05,
        angle + 0.05,
        LOUNGE.seatHeight + 0.19,
        LOUNGE.seatHeight + 0.19 - dais,
        leatherMaterial
      )
    );
  }

  // Throw pillows, propped against the back. Boxes, tilted out of true and alternating in colour
  // — at this distance the eye reads "somebody lives here" off the untidiness, not the shape.
  //
  // **Each one is a mesh inside a turned group, and both halves of that matter.** The group takes
  // the facing and the mesh takes the tilt. A radial thing — the arm cylinders above — faces the
  // right way at `rotation.y = -angle`, and a pillow copied from them does not: that maps its
  // *width* to the radius and stands its 0.14 m edge across the seat, so seven of them read as
  // thin slabs planted in the cushions rather than as anything soft. The facing a flat-fronted
  // object wants is `PI/2 - angle`. Then the tilts have to be applied *under* that rotation or
  // they are taken about the world axes, and "leaning back into the couch" becomes "toppling
  // sideways" everywhere except the two ends of the U where the two happen to agree.
  for (let i = 0; i < 7; i++) {
    const angle = from + ((to - from) * (i + 0.5)) / 7 + (i % 3 === 1 ? 0.06 : -0.04);
    const radius = backInner - 0.08;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * radius, LOUNGE.seatHeight + 0.18, Math.sin(angle) * radius);
    pivot.rotation.y = Math.PI / 2 - angle;
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.30, 0.16),
      pillowMaterials[i % pillowMaterials.length]
    );
    // Tipped back onto the roll, and rolled a little out of true. Alternating the sign is what
    // keeps a row of seven from reading as a repeat.
    pillow.rotation.x = -0.30;
    pillow.rotation.z = i % 2 ? 0.15 : -0.11;
    pivot.add(pillow);
    group.add(pivot);
  }

  // --- the table ------------------------------------------------------------------------------
  const tableTop = dais + LOUNGE.tableHeight;
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(LOUNGE.tableRadius, LOUNGE.tableRadius, 0.055, 40),
    tableMaterial
  );
  top.position.y = tableTop - 0.027;
  group.add(top);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, LOUNGE.tableHeight - 0.06, 20), tableMaterial);
  stem.position.y = dais + (LOUNGE.tableHeight - 0.06) / 2;
  group.add(stem);

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.04, 28), tableMaterial);
  foot.position.y = dais + 0.02;
  group.add(foot);

  // A plant on it. The cheapest possible "somebody lives here" — CLAUDE.md's roadmap wants a
  // hydroponics tray out of `ai-assets/` eventually; this is three primitives standing in.
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.1, 14), potMaterial);
  pot.position.set(-0.16, tableTop + 0.05, 0.1);
  group.add(pot);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), leafMaterial);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(-0.16 + Math.cos(a) * 0.07, tableTop + 0.16 + (i % 2) * 0.05, 0.1 + Math.sin(a) * 0.07);
    leaf.scale.set(1, 0.45, 1);
    group.add(leaf);
  }

  // The radio, on the window side of the table so it is in reach from the mouth of the U.
  const radio: Radio = buildRadio();
  radio.group.position.set(0.2, tableTop, -0.26);
  radio.group.rotation.y = 0.35;
  group.add(radio.group);

  // A warm pool over the table — with the desk lamp gone this is the warmest thing on the lower
  // deck, and the one that says the room is inhabited rather than merely lit. Kept modest: the
  // planet through the glass is meant to carry the room, not this.
  const lamp = new THREE.PointLight(0xffc79a, 4, 6, 2);
  lamp.position.set(0, dais + 1.5, 0);
  group.add(lamp);

  // --- obstacles ------------------------------------------------------------------------------
  // The couch ring, as a chain of axis-aligned boxes round the U rather than one box over the
  // whole dais. That is what leaves the mouth open: a single footprint would fence off the pocket
  // the U exists to make.
  //
  // **The chunk count is a clearance, not a level of detail.** Each box is the bounding box of one
  // sector's four corners, so it bulges *inboard* of the arc by the sagitta — and the player is a
  // point tested against boxes already inflated by `PLAYER_RADIUS`, so that bulge comes straight
  // off the walkable ring inside the U. At 12 chunks over this 260° arc it came to ~0.55 m, which
  // is more than the ring is wide: the pocket sealed itself, and `dev/walk.mjs` wedged in the two
  // slivers left between chunk corners with no way out, because the push-out is two passes and not
  // a solver. 32 brings it under 8 cm. Widen the couch or the arc and this wants checking again.
  const obstacles: THREE.Box2[] = [];
  const chunks = 32;
  for (let i = 0; i < chunks; i++) {
    const a0 = from + ((to - from) * i) / chunks;
    const a1 = from + ((to - from) * (i + 1)) / chunks;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const a of [a0, a1]) {
      for (const r of [LOUNGE.couchInner, LOUNGE.couchOuter]) {
        const x = LOUNGE.x + Math.cos(a) * r;
        const z = LOUNGE.z + Math.sin(a) * r;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
    }
    obstacles.push(new THREE.Box2(new THREE.Vector2(minX, minZ), new THREE.Vector2(maxX, maxZ)));
  }
  // The table is round, and one square over it is not a cheap approximation of that — it is a
  // *worse* shape in the only place that matters. Its corners sit at r·sqrt2, so a 0.38 m table
  // inflated by the player reached 0.99 into a ring whose inner face is at 1.13, and pinched the
  // pocket shut on all four diagonals while looking correct on the axes. Two crossed boxes are an
  // octagon: the same table, corners at 1.23·r instead of 1.41·r, and the ring stays open.
  const tR = LOUNGE.tableRadius;
  obstacles.push(footprint(LOUNGE.x, LOUNGE.z, tR * 2, tR * 1.414));
  obstacles.push(footprint(LOUNGE.x, LOUNGE.z, tR * 1.414, tR * 2));

  return { group, obstacles, radioTarget: radio.target, setRadioLit: radio.setLit };
}
