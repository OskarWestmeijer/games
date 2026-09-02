import * as THREE from 'three';
import { MATERIALS } from './shell';
import {
  NOSE_Z,
  Z_TIP,
  buildHullSurface,
  floorHalfWidthAt,
  floorOutline,
  ringAt,
  ringPoint,
  roofAt,
  stations
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
 * The hoops are a shade heavier than the longerons because they are the primary structure, and
 * reading that hierarchy is most of what makes the canopy look built rather than drawn on.
 */
const HOOP_RADIUS = 0.06;
const LONGERON_RADIUS = 0.045;

/**
 * Where the longerons stop: **exactly** the tip, where the profile reaches zero and `ringPoint`
 * collapses every ring parameter onto the same point. So they converge to an apex, the way a
 * nose cone's stringers do, instead of ending in mid-air with rounded caps showing — which they
 * did at -9.0 and again at -9.45, and it was the first thing the eye went to from the desk.
 */
const FRAME_TIP_Z = Z_TIP;

/**
 * The hoops, as fractions of the glazed length from the seam forward. Explicit rather than
 * evenly stepped so the last one lands short of the tip and leaves the converging longerons a
 * clear run into it.
 */
const HOOP_FRACTIONS = [0, 0.17, 0.35, 0.53, 0.7, 0.84];

/** The longerons, as ring parameters. Symmetric about the crown, clear of the floor edges. */
const LONGERON_TS = [0.13, 0.315, 0.5, 0.685, 0.87];

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

export function buildHall(): THREE.Group {
  const hall = new THREE.Group();

  // --- the hull ------------------------------------------------------------------------------
  hall.add(buildHullSurface());

  // --- the floor -----------------------------------------------------------------------------
  // One opaque oval, out to where the rings meet the floor plane. Solid all the way forward:
  // the glass floor of the previous pass is gone, and the lit rim below takes its job.
  hall.add(plate(floorOutline(), 0, MATERIALS.floor));

  // --- frames --------------------------------------------------------------------------------
  // **Hoops and longerons**, which is what the reference sheet draws and what a pressure canopy
  // actually is: rings taking the hoop stress, and a few members running fore-and-aft between
  // them. The panes that fall out are big and quadrilateral, and there are not many of them.
  //
  // This replaced a *diagonal lattice* — two families of ribs spiralling round the nose in
  // opposite directions and crossing into lozenges. It was defensible over a 7 m nose. Stretched
  // over 13 m of hull it stopped reading as structure at all: every rib crossed every other one
  // at a different place along the length, and from the lounge the window was a tangle of black
  // curves with a planet somewhere behind it. Fore-and-aft members are legible from any standing
  // position because they all vanish to the same point — which is also the point of the ship.
  const span = NOSE_Z - FRAME_TIP_Z;

  for (const fraction of HOOP_FRACTIONS) {
    hall.add(tube(inset(ringAt(NOSE_Z - span * fraction, 24), HOOP_RADIUS), HOOP_RADIUS, MATERIALS.strut));
  }

  const frameStations = stations().filter((z) => z <= NOSE_Z + 0.01 && z >= FRAME_TIP_Z);
  for (const t of LONGERON_TS) {
    const line = frameStations.map((z) => ringPoint(z, t));
    hall.add(tube(inset(line, LONGERON_RADIUS), LONGERON_RADIUS, MATERIALS.strut));
  }

  // --- the lit rim ----------------------------------------------------------------------------
  // A glowing line where the glass meets the floor, down both sides. Authored over 1.0 in
  // `MATERIALS.led`, so the bloom pass turns it into light rather than a bright stripe. Thirteen
  // metres of it now, which makes it the longest thing in the room and most of what lights the
  // forward half — see the lamps beside it in `index.ts`.
  //
  // Unlike the longerons it must **stop short of the tip**: it is offset inboard of the hull by
  // a fixed 0.09, so carried all the way in the two sides would cross over each other in the
  // last half metre and each end up on the wrong one.
  for (const side of [-1, 1]) {
    const rim = stations()
      .filter((z) => z <= NOSE_Z && floorHalfWidthAt(z) > 0.3)
      .map((z) => new THREE.Vector3(side * (floorHalfWidthAt(z) - 0.09), 0.07, z));
    if (rim.length > 2) hall.add(tube(rim, 0.045, MATERIALS.led));
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
