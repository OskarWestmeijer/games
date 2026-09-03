import * as THREE from 'three';
import { MATERIALS } from './shell';
import {
  NOSE_CAP_FRACTION,
  NOSE_CAP_Z,
  NOSE_Z,
  Z_TIP,
  buildHullSurface,
  floorHalfWidthAt,
  floorOutline,
  halfWidthAt,
  ringAt,
  ringPoint,
  roofAt,
  sectionRing,
  stations,
  zForProfile
} from './hull';
import type { Region } from '../regions';

/**
 * The hall: the hull surface, the floor it stands on, the canopy's frames and the lit rim.
 *
 * The form itself is `hull.ts` — this file only builds it. What is left here is the four things
 * that make a lofted surface read as a room rather than as a bag:
 *
 * - **The floor**, an oval plate meeting the hull exactly where the rings end.
 * - **The frames**, the structure over the glazing. These are the single most recognisable thing
 *   in the reference sheet, and they are cheap. Without them a continuous sheet of glass has no
 *   scale and no depth — you cannot tell a 4 m canopy from a 40 m one, which now matters a great
 *   deal more, because the canopy is 13 m long and wraps the hull from floor line to floor line.
 * - **The lit rim**, a glowing line where the glass meets the floor down both sides. This is
 *   what replaces the glass floor of an earlier pass: it draws the edge of the deck against the
 *   planet, which is the thing the glass floor was really doing.
 * - **The roof strips**, aft only.
 *
 * Nothing is mounted in the glazing but the rim. It is glass on every face above the floor, so
 * there is nowhere to put a lamp and nothing that should compete with what is outside it — the
 * hall is lit from the floor line, and from the furniture's own lamps.
 */

/**
 * How thick the frames are. 0.075 was a 15 cm tube, which at this scale read as tree branches
 * laid over the glass; the reference's members are slim, dark, and mostly seen in silhouette.
 *
 * **There are three weights, and the hierarchy is the point.** A canopy framed in one thickness
 * reads as a net thrown over the hull; `space_station_outside.jpeg` has a clear primary structure
 * — the collar where the metal ends, one heavy ring across the middle of the glass, and the
 * collar round the nose cap — with lighter hoops between and lighter longerons again running
 * through them all. Reading that order is most of what makes the canopy look built rather than
 * drawn on, and it costs nothing but two more numbers.
 */
const HOOP_RADIUS = 0.06;
const LONGERON_RADIUS = 0.045;
const MAJOR_RADIUS = 0.095;

/**
 * **Where the longerons stop: the cap collar, not the tip.**
 *
 * They used to run all the way to `Z_TIP`, where the profile reaches zero and `ringPoint`
 * collapses every ring parameter onto the same point, so all seven met at an apex. As geometry
 * that is tidy. As a *window* it was wrong, and looking through it was how you found out: seven
 * members converging on one point at the floor line turn the front of the ship into a spider's
 * web. The reference does the opposite — its canopy frames **die on the collar**, and what is
 * inside the ring is four big panes and nothing else. A circle you can see the whole of is the
 * entire effect, and a fan of spokes across it is the one thing that destroys it.
 *
 * The old objection to stopping them short — rounded tube caps hanging in mid-air, which is what
 * -9.0 and -9.45 both looked like — does not apply to stopping them *on a member*. The collar is
 * 0.26 m of band with a lip each side; a longeron ending in the middle of it ends inside it.
 */
const FRAME_TIP_Z = NOSE_CAP_Z;

/**
 * The nose cap: a round window closing the front of the hull, with a collar round its base and a
 * **cross** inside it. Four panes, which is what the reference draws.
 *
 * **This is the single most recognisable thing about the reference's exterior**, and until the
 * hull stopped tapering to a point there was nowhere to put it. `NOSE_CAP_FRACTION` (in
 * `hull.ts`, since `SPAWN` aims at the middle of the cap too) is where the collar goes, given as
 * a fraction of full beam rather than a z, so it is *derived from the hull* the way the staircase
 * is derived from the wall. At 0.62 it lands at z = -6.6, leaving a cap 6.3 m across.
 *
 * The two mullions are the surface's own lines rather than bars laid over it:
 *
 * - the **upright** is the crown line, `ringPoint(z, 0.5)` from the top of the collar forward to
 *   the tip. Seen from inside it runs from the top of the ring straight down to the floor —
 *   because the section's centre sits `FLOOR_DROP` up and that drops to zero as the section
 *   vanishes, so the tip lands *on* the floor plane, at the bottom of everything you can see.
 * - the **crossbar** is the hull cut by a horizontal plane at half the cap's own height: the
 *   curve `x = ±halfWidthAt(z, h)`, port side forward, round the nose, starboard side back. It
 *   pinches to a point at `zForProfile(NOSE_CAP_FRACTION / 2)`, where the crown of the hull comes
 *   down to exactly that height — which is the same point the upright passes through, so the two
 *   **cross exactly** without either of them being told about the other.
 *
 * There is no second concentric ring. There was one, on a reading of the reference that a closer
 * look does not support: what sits inside its collar is the collar's own inner lip, and the far
 * rim of the ring seen through the glass. One ring and a cross.
 */
const CAP_COLLAR_RADIUS = 0.11;
const CAP_COLLAR_DEPTH = 0.16;
const CAP_MULLION_RADIUS = 0.06;

/**
 * The hoops between the two collars, as fractions of that span, and which of them is heavy.
 *
 * Evenly stepped now that both ends of the run are collars — 1.68 m apart, and the same 1.68 m
 * again from the last one to the cap. Against seven longerons round a girth of about 14 m that
 * makes the panes very nearly square, which is what the reference's are.
 */
const HOOP_FRACTIONS = [0.2, 0.4, 0.6, 0.8];
const MAJOR_HOOP_FRACTION = 0.4;

/** The longerons, as ring parameters. Symmetric about the crown, clear of the floor edges. */
const LONGERON_TS = [0.1, 0.2333, 0.3667, 0.5, 0.6333, 0.7667, 0.9];

/**
 * The collars' metal — brighter than the hull, the way the reference's are, and `DoubleSide`
 * for the same reason `buildHullSurface` is: a collar is a one-quad-deep band lofted from two
 * rings, nothing here solves its winding, and a silently missing panel costs far more than the
 * back faces do.
 */
const collarMetal = new THREE.MeshStandardMaterial({
  color: 0x8d97a4,
  roughness: 0.42,
  metalness: 0.58,
  side: THREE.DoubleSide
});

function shapeFromRegion(region: Region): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(region[0].x, region[0].y);
  for (let i = 1; i < region.length; i++) shape.lineTo(region[i].x, region[i].y);
  shape.closePath();
  return shape;
}

/**
 * A horizontal plate from a polygon. `ShapeGeometry` lays out in XY facing +Z; rotating by
 * **+**π/2 about X sends shape-Y to world +Z, so the polygon's coordinates read straight as
 * (x, z) with no sign flips. The other direction mirrors the plate.
 */
function plate(region: Region, y: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapeFromRegion(region)), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/**
 * Pulls a run of points in towards the section's own axis, so a rib sits proud on the *inside*
 * of the glass rather than reading as wire embedded in it.
 */
function inset(points: THREE.Vector3[], by: number): THREE.Vector3[] {
  return points.map((p) => {
    const axis = roofAt(p.z) / 2;
    const r = Math.hypot(p.x, p.y - axis);
    const k = r > 1e-3 ? (r - by) / r : 1;
    return new THREE.Vector3(p.x * k, axis + (p.y - axis) * k, p.z);
  });
}

/** A tube swept along a list of points. Used for every rib and for the rim. */
function tube(points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(12, points.length * 2), radius, 6, false),
    material
  );
}

/** One frame ring following the hull at `z`, standing proud on the inside of the glass. */
function hoop(z: number, radius: number): THREE.Mesh {
  return tube(inset(ringAt(z, 24), radius), radius, MATERIALS.strut);
}

/**
 * The loft's own stations between two z, with **both ends landing exactly**.
 *
 * `stations()` is a fixed cosine-spaced list, so a plain filter gives a member that starts and
 * stops wherever the nearest sample happens to be. That was harmless while every frame ran to the
 * tip; it is not harmless when a longeron has to die *inside* a collar 0.26 m deep.
 */
function frameZs(fromZ: number, toZ: number): number[] {
  return [fromZ, ...stations().filter((z) => z > fromZ + 1e-3 && z < toZ - 1e-3), toZ];
}

/**
 * A **collar**: a short opaque band of hull standing proud of the glass, with a heavy lip round
 * each edge of it.
 *
 * The reference's two structural breaks — where the metal ends and where the nose cap begins —
 * are not lines, they are *bands*: an inch of raised metal with a visible thickness, and that
 * thickness is what says the glass is set into something rather than painted on. A single tube
 * cannot say it. This is two rings lofted into a band, pushed 5 cm out so it reads as a bezel
 * from outside, with a tube on each lip; from inside it is a ring of metal round the window,
 * which is what the collar is for in the first place.
 */
function collar(z0: number, z1: number, lip: number): THREE.Group {
  const group = new THREE.Group();
  // `sectionRing`, not `ringAt`: a collar goes **all the way round**, under the keel as well as
  // over the crown. Half a collar is a band painted on the top of an egg, and it is the first
  // thing an exterior shot shows. Below the floor plate none of it is visible from inside.
  const rings = [inset(sectionRing(z0, 22), -0.05), inset(sectionRing(z1, 22), -0.05)];

  const position: number[] = [];
  const index: number[] = [];
  for (const ring of rings) for (const p of ring) position.push(p.x, p.y, p.z);
  const cols = rings[0].length;
  for (let c = 0; c < cols - 1; c++) {
    const a = c;
    const b = a + 1;
    const d = a + cols;
    index.push(a, d, b, b, d, d + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, collarMetal));

  for (const ring of rings) group.add(tube(inset(ring, lip * 0.5), lip, MATERIALS.strut));
  return group;
}

export function buildHall(): THREE.Group {
  const hall = new THREE.Group();

  // --- the hull ------------------------------------------------------------------------------
  hall.add(buildHullSurface());

  // --- the floor -----------------------------------------------------------------------------
  // One opaque oval, out to where the rings meet the floor plane. Solid all the way forward:
  // the glass floor of the previous pass is gone, and the lit rim below takes its job.
  hall.add(plate(floorOutline(), 0, MATERIALS.floor));

  // --- frames --------------------------------------------------------------------------------
  // **Collars, hoops and longerons**, which is what the reference sheet draws and what a pressure
  // canopy actually is: a heavy ring where the glazing is let into the hull, rings taking the hoop
  // stress along it, and a few members running fore-and-aft between them. The panes that fall out
  // are big and quadrilateral, and there are not many of them.
  //
  // This replaced a *diagonal lattice* — two families of ribs spiralling round the nose in
  // opposite directions and crossing into lozenges. It was defensible over a 7 m nose. Stretched
  // over 13 m of hull it stopped reading as structure at all: every rib crossed every other one
  // at a different place along the length, and from the lounge the window was a tangle of black
  // curves with a planet somewhere behind it. Fore-and-aft members are legible from any standing
  // position because they all run to the same place — the ring round the front window.
  const span = NOSE_Z - NOSE_CAP_Z;

  // The seam collar, at the line where the shell stops and the glass starts. It laps 0.3 m onto
  // the glass rather than butting up to it: a bezel overlaps what it holds.
  hall.add(collar(NOSE_Z, NOSE_Z - 0.3, MAJOR_RADIUS));

  for (const fraction of HOOP_FRACTIONS) {
    const radius = fraction === MAJOR_HOOP_FRACTION ? MAJOR_RADIUS : HOOP_RADIUS;
    hall.add(hoop(NOSE_Z - span * fraction, radius));
  }

  // The longerons run the glazed length and **stop on the cap collar**, which is what leaves the
  // ring unbroken. `frameZs` lands the forward end exactly on it rather than at whichever station
  // happens to be nearest, so the tube's cap is buried in the band rather than showing beside it.
  for (const t of LONGERON_TS) {
    const line = frameZs(FRAME_TIP_Z, NOSE_Z).map((z) => ringPoint(z, t));
    hall.add(tube(inset(line, LONGERON_RADIUS), LONGERON_RADIUS, MATERIALS.strut));
  }

  // --- the nose cap --------------------------------------------------------------------------
  // A circle and a cross. The collar is heavier than anything else in the canopy because in the
  // reference it is the one member you read first, and it is drawn *after* the longerons that
  // die inside it.
  hall.add(
    collar(NOSE_CAP_Z + CAP_COLLAR_DEPTH, NOSE_CAP_Z - CAP_COLLAR_DEPTH, CAP_COLLAR_RADIUS)
  );

  // The upright: the crown line from the top of the collar forward to the tip, which sits on the
  // floor plane — so from inside it reads as a bar down the middle of the window, full height.
  hall.add(
    tube(
      inset(frameZs(Z_TIP, NOSE_CAP_Z).map((z) => ringPoint(z, 0.5)), CAP_MULLION_RADIUS),
      CAP_MULLION_RADIUS,
      MATERIALS.strut
    )
  );

  // The crossbar: the hull cut by a horizontal plane at half the cap's height. Port side forward,
  // through the point where the crown comes down to meet it, starboard side back — one curve, and
  // it crosses the upright exactly because that point is on the crown line too.
  const capMullionY = roofAt(NOSE_CAP_Z) / 2;
  const capApexZ = zForProfile(NOSE_CAP_FRACTION / 2);
  const across = frameZs(capApexZ, NOSE_CAP_Z);
  hall.add(
    tube(
      inset(
        [
          ...[...across].reverse().map((z) => new THREE.Vector3(-halfWidthAt(z, capMullionY), capMullionY, z)),
          ...across.slice(1).map((z) => new THREE.Vector3(halfWidthAt(z, capMullionY), capMullionY, z))
        ],
        CAP_MULLION_RADIUS
      ),
      CAP_MULLION_RADIUS,
      MATERIALS.strut
    )
  );

  // --- the lit rim ----------------------------------------------------------------------------
  // A line where the glass meets the floor, down both sides. On `MATERIALS.ledFloor`, which is
  // under the bloom threshold on purpose: thirteen metres of strip directly below the eye is the
  // longest run in the room, and blooming it made the floor the brightest surface aboard with a
  // planet behind it coming second. It marks the edge of the deck now and lights nothing — the
  // window does that.
  //
  // Unlike the longerons it must **stop short of the tip**: it is offset inboard of the hull by
  // a fixed 0.09, so carried all the way in the two sides would cross over each other in the
  // last half metre and each end up on the wrong one.
  for (const side of [-1, 1]) {
    const rim = stations()
      .filter((z) => z <= NOSE_Z && floorHalfWidthAt(z) > 0.3)
      .map((z) => new THREE.Vector3(side * (floorHalfWidthAt(z) - 0.09), 0.07, z));
    if (rim.length > 2) hall.add(tube(rim, 0.035, MATERIALS.ledFloor));
  }

  // --- roof strips ----------------------------------------------------------------------------
  // Aft only, following the crown of the hull down each shoulder. The glazing gets none: it is
  // glass on every face and there is nothing to mount them to. They stop where the bulb starts
  // closing in earnest, rather than at a fixed distance from the tail, so they never run down
  // into the pinch and cross each other.
  const aftStations = stations().filter((z) => z >= NOSE_Z && roofAt(z) > 5.5);
  for (const fraction of [0.34, 0.66]) {
    const line = aftStations.map((z) => {
      const ring = ringAt(z, 24);
      const i = Math.round(fraction * (ring.length - 1));
      return ring[i].clone().multiplyScalar(0.985);
    });
    if (line.length > 2) hall.add(tube(line, 0.045, MATERIALS.led));
  }

  return hall;
}
