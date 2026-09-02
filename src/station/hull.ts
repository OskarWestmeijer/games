import * as THREE from 'three';
import { MATERIALS } from './shell';
import type { Region } from '../regions';

/**
 * The hull's form, as functions.
 *
 * A teardrop: a round, closed bulb aft where the bridge is, tapering forward over most of its
 * length to a point, curved in **plan and elevation at once**. One profile `f(z)` scales a
 * single elliptical cross-section along the length, and everything about the shape — the
 * floor's outline, the roof height over any point, how far a railing may stand out at *its own*
 * height, where the staircase's wall runs — falls out of that one curve.
 *
 * Nose at -Z, as always: the face `updateOrbit()` aims at the planet.
 *
 *   SIDE (nose left)                     PLAN
 *          __---‾‾‾‾‾‾---__                     __---‾‾‾---__
 *     __-‾‾               ‾‾-_          __--‾‾               ‾‾--__
 *   _-‾       bridge ▬▬▬▬      ‾-_    <                             >
 *  (  ·  ·  ·  ·  ·  ·  ·  ·  ·   )     ‾‾--__               __--‾‾
 *   ‾--------------------------- -‾            ‾‾---___---‾‾
 *
 * Three properties of the profile are load-bearing, and none of them is aesthetic:
 *
 * - **`sqrt(1 - x²)` is concave, so the floor's outline is convex.** That is what lets the whole
 *   lower deck stay a *single* convex region for `clampToRegions` (see `regions.ts`). Swap in a
 *   profile that is not concave and the floor needs a convex decomposition instead. The aft
 *   curve `sqrt(1 - u⁴)` is concave too — check any replacement, it is not a free choice.
 * - **The profile reaches zero at both ends, so the loft closes itself.** There are no end caps
 *   and no code to add them: `ringPoint` collapses a vanishing section onto the axis, so tip and
 *   tail are sealed by the same triangles that make the sides. The tail used to stop at 84% of
 *   full beam and simply end, which left a 10 m elliptical hole open to space behind the globe —
 *   in shot, every time you turned round on the bridge.
 * - **`TAIL_ROUND` is what keeps the bridge under a roof.** A plain ellipse aft (exponent 2)
 *   starts closing immediately and is short of headroom by the globe. The fourth power
 *   holds the section near full through the whole bridge and then rounds off hard over the last
 *   metre and a half — which is also what a teardrop's fat end actually looks like.
 *
 * ### The thing that bites
 *
 * **The hull leans inward above the waist.** A floor plan is not a clearance check: at z = 1.8
 * it is 4.92 wide at the bridge deck and only 4.21 a metre and a half higher, where a standing
 * player's head is. Anything tall — railings, the console, the globe, the top of the staircase —
 * has to be tested with `halfWidthAt(z, y)` at its own height.
 *
 * Below the waist it leans the *other* way, which is just as easy to get wrong. The section's
 * centre sits `FLOOR_DROP` above the floor, so the hull is widest around y = 2 and the floor
 * outline is **narrower than the wall a metre above it** — by up to 0.2 m along the staircase.
 * That is why the treads are extended out to `halfWidthAt` at their own height rather than all
 * stopping on the arc: laid to the floor plan they would hug the wall at the bottom and stand
 * a hand's width off it in the middle.
 */

/** Where the hull begins and ends along Z, and where its fullest section is. */
export const Z_TAIL = 7.4;
export const Z_TIP = -8.2;
const Z_MAX = 2.4;

/**
 * Half-beam and roof height at the fullest section.
 *
 * **These came down.** The hull was 18.1 x 12 x 8.6 and read as a cathedral rather than a place
 * someone lives: 8.6 m of air over a lounge, five metres of it above head height and nothing in
 * it. The reference sheet's interior is tight — a large yacht saloon, not a nave — and the
 * lower deck is the part that has to feel that way, because it is the part you stand in.
 */
const HW_MAX = 5.1;
const ROOF_MAX = 6.8;

/**
 * How far below the section's centre the floor plane sits, as a fraction of the semi-height.
 * The floor is a flat plate at y = 0 cutting an ellipse whose centre is above it, so this is
 * what decides how much of the section is *room* and how much is keel. At 0.30 the floor comes
 * out at 95% of the full beam — nearly the widest the hull ever is, which is what keeps the
 * floor generous while the roof still arches.
 */
const FLOOR_DROP = 0.3;

/**
 * How the aft bulb closes: `sqrt(1 - u^TAIL_ROUND)`. Two is a plain ellipse and starts falling
 * away at once; four holds the section near full for the length of the bridge and then rounds
 * off over the last metre and a half. Turning it down costs headroom over the globe, which sits
 * three quarters of the way to the tail.
 */
const TAIL_ROUND = 4;

const HH_MAX = ROOF_MAX / (1 + FLOOR_DROP);

/**
 * Where the glazing starts. Everything forward of this is glass — roof, both flanks, and the
 * shoulders where they meet — in one unbroken sheet running from the floor line on one side,
 * over the crown, down to the floor line on the other.
 *
 * It is the same line as `BRIDGE.frontZ`, and that is the whole layout in one number: **the
 * glass begins where the bridge ends.** Aft of it is the opaque part there is something to
 * mount to — roof strips, deck lamps, the mezzanine itself. Forward of it is ten metres of
 * window, and the only lights in it are at floor level.
 *
 * It was -2.0, which glazed the tip and left the shoulders solid — and the shoulders are the
 * part of the hull you actually look *through* on the way to the planet from anywhere in the
 * hall except standing in the very point of the nose.
 */
export const NOSE_Z = 1.8;

/** How finely the loft is sampled along its length, and around each ring. */
const STATIONS = 56;
const RING_POINTS = 28;

export interface Section {
  /** Half-width of the ellipse at its widest — i.e. at the section's own centre height. */
  hw: number;
  /** Semi-height of the ellipse. */
  hh: number;
  /** How far the ellipse's centre sits above the floor plane. */
  yc: number;
  /** Roof height above the floor. */
  roof: number;
}

/** The profile: 1 at the fullest section, falling to 0 at both ends. */
function profile(z: number): number {
  if (z >= Z_MAX) {
    const u = (z - Z_MAX) / (Z_TAIL - Z_MAX);
    return Math.sqrt(Math.max(0, 1 - u ** TAIL_ROUND));
  }
  const s = (Z_MAX - z) / (Z_MAX - Z_TIP);
  return Math.sqrt(Math.max(0, 1 - s * s));
}

export function sectionAt(z: number): Section {
  const f = profile(THREE.MathUtils.clamp(z, Z_TIP, Z_TAIL));
  const hw = HW_MAX * f;
  const hh = HH_MAX * f;
  const yc = FLOOR_DROP * hh;
  return { hw, hh, yc, roof: yc + hh };
}

/**
 * How far the hull stands out from the centreline at height `y` above the floor. Zero once `y`
 * is past the roof. **This, not the floor outline, is the clearance test for anything tall.**
 */
export function halfWidthAt(z: number, y: number): number {
  const { hw, hh, yc } = sectionAt(z);
  if (hh <= 0) return 0;
  const t = (y - yc) / hh;
  if (t * t >= 1) return 0;
  return hw * Math.sqrt(1 - t * t);
}

/** Where the hull meets the floor plane — the edge the floor plate has to reach, exactly. */
export function floorHalfWidthAt(z: number): number {
  return halfWidthAt(z, 0);
}

/** Roof height over a point on the centreline. */
export function roofAt(z: number): number {
  return sectionAt(z).roof;
}

/**
 * One ring: the arc of the section's ellipse **above the floor**, from the starboard floor edge
 * up over the crown and down to the port one.
 *
 * Only the part above y = 0 is ever built. Nothing below the floor plate can be seen from
 * inside, and the player can never leave, so the keel is simply not modelled — which halves the
 * hull's geometry and removes any question about what the underside looks like.
 */
/**
 * One point on a ring: `t` runs 0..1 from the starboard floor edge, up over the crown, down to
 * the port one. Constant `t` traced along Z is a **longeron** — see the frames in `hall.ts`.
 */
export function ringPoint(z: number, t: number): THREE.Vector3 {
  const { hw, hh, yc } = sectionAt(z);
  if (hh <= 1e-4) return new THREE.Vector3(0, 0, z);
  // The angle, measured about the section's centre, at which the ellipse crosses the floor.
  // Beyond it the ellipse is below the plate and is not drawn.
  const floorAngle = Math.acos(THREE.MathUtils.clamp(-yc / hh, -1, 1));
  const a = floorAngle - 2 * floorAngle * THREE.MathUtils.clamp(t, 0, 1);
  return new THREE.Vector3(hw * Math.sin(a), yc + hh * Math.cos(a), z);
}

export function ringAt(z: number, points = RING_POINTS): THREE.Vector3[] {
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < points; i++) ring.push(ringPoint(z, i / (points - 1)));
  return ring;
}

/** The z of every station the loft is sampled at, tip to tail. */
export function stations(count = STATIONS): number[] {
  const zs: number[] = [];
  for (let i = 0; i < count; i++) {
    // Cosine-spaced, so the sampling bunches up at the tip and the tail where the profile turns
    // fastest and spreads out through the long straight middle where it barely changes.
    const t = (1 - Math.cos((i / (count - 1)) * Math.PI)) / 2;
    zs.push(Z_TIP + (Z_TAIL - Z_TIP) * t);
  }
  return zs;
}

/**
 * The floor's outline as a closed convex polygon: the port side forward, round the tip, and the
 * starboard side back. Convex because the profile is concave — see the note at the top.
 */
export function floorOutline(inset = 0): Region {
  const zs = stations();
  const port: THREE.Vector2[] = [];
  const starboard: THREE.Vector2[] = [];
  for (const z of zs) {
    const half = floorHalfWidthAt(z) - inset;
    if (half <= 0) continue;
    port.push(new THREE.Vector2(-half, z));
    starboard.push(new THREE.Vector2(half, z));
  }
  // Wound as one loop: up the starboard side, back down the port side.
  return [...starboard, ...port.reverse()];
}

/**
 * A closed convex polygon following the hull at a constant height `y`, between two z limits,
 * shrunk by `inset`. The two ends are straight chords.
 *
 * This is how any deck's *walkable* outline is derived, and the height it is taken at matters
 * more than it looks. For the bridge it must be **eye height** — deck plus `EYE_HEIGHT`, not
 * deck height and not railing height. At z = 5 the hull is 5.48 wide at the deck, 4.88 at a
 * railing's top rail and only 4.43 at 5.2 m: a deck laid out to either of the first two puts
 * the player's head inside the hull long before their feet run out of floor.
 *
 * The lower deck is the other way round — its widest point is near eye height, so there the
 * floor's own outline is the binding one. `floorOutline` covers that case.
 */
export function outlineAt(y: number, fromZ: number, toZ: number, inset = 0): Region {
  const port: THREE.Vector2[] = [];
  const starboard: THREE.Vector2[] = [];
  for (const z of stations()) {
    if (z < fromZ || z > toZ) continue;
    const half = halfWidthAt(z, y) - inset;
    if (half <= 0) continue;
    port.push(new THREE.Vector2(-half, z));
    starboard.push(new THREE.Vector2(half, z));
  }
  return [...starboard, ...port.reverse()];
}

export interface WallArc {
  /** Centre of the arc, in XZ. Well off to the other side of the ship — the wall is shallow. */
  center: THREE.Vector2;
  /** Radius at which the arc coincides with the hull's floor outline. */
  radius: number;
  /** The angles, about `center`, of the two ends. */
  fromAngle: number;
  toAngle: number;
}

/**
 * A circular arc laid along one side of the hull at floor level, between two z limits.
 *
 * This exists so the staircase can *hug the wall* without any hand-tuned numbers: everything
 * about it — where it starts, how steep it is, which way it curves — comes out of the hull, and
 * follows it if the hull ever changes shape again.
 *
 * A circle through the two ends and the midpoint, rather than a least-squares fit, because over
 * any run short enough to be a flight of stairs the two are indistinguishable: along the
 * staircase's own 7 m the three-point circle is never more than 7 mm off the hull. Do not
 * extend this to a run that reaches round the tail, where the outline stops being an arc and
 * the error grows without warning.
 *
 * The radius is deliberately huge — 26 m against a 12 m beam — because the flank of a teardrop
 * *is* nearly straight amidships. That is what hugging this wall looks like, and a tighter
 * curve would be a spiral staircase standing in the room next to the wall rather than a flight
 * running along it.
 */
export function wallArc(fromZ: number, toZ: number, side: 1 | -1 = 1): WallArc {
  const at = (z: number) => new THREE.Vector2(side * floorHalfWidthAt(z), z);
  const [a, b, c] = [at(fromZ), at((fromZ + toZ) / 2), at(toZ)];
  // Circumcentre: the intersection of two perpendicular bisectors, as a 2x2 solve.
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const sq = (p: THREE.Vector2) => p.x * p.x + p.y * p.y;
  const center = new THREE.Vector2(
    (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d,
    (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d
  );
  const angle = (p: THREE.Vector2) => Math.atan2(p.y - center.y, p.x - center.x);
  return {
    center,
    radius: center.distanceTo(a),
    fromAngle: angle(a),
    toAngle: angle(c)
  };
}

/**
 * Lofts the rings into a surface, split at `NOSE_Z` into an opaque shell aft and glass forward.
 *
 * The two halves **share the ring at the seam**, so there is no gap and no double-drawn band
 * however coarsely the hull is sampled. Both are `DoubleSide`, per the house rule: the player
 * can never get outside, so solving every triangle's winding buys nothing and a silently
 * missing panel costs a lot.
 */
export function buildHullSurface(): THREE.Group {
  const group = new THREE.Group();
  const zs = stations();
  const rings = zs.map((z) => ringAt(z));

  /** Lofts `rings[from..to]` into one geometry. */
  function loft(from: number, to: number): THREE.BufferGeometry {
    const position: number[] = [];
    const normal: number[] = [];
    const index: number[] = [];
    const cols = RING_POINTS;

    for (let i = from; i <= to; i++) {
      for (const p of rings[i]) {
        position.push(p.x, p.y, p.z);
        normal.push(0, 0, 0);
      }
    }
    const rows = to - from + 1;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = a + cols;
        const e = d + 1;
        index.push(a, d, b, b, d, e);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }

  // The station nearest the glazing seam, which both halves are built up to.
  let seam = 0;
  for (let i = 0; i < zs.length; i++) if (zs[i] <= NOSE_Z) seam = i;

  group.add(new THREE.Mesh(loft(0, seam), MATERIALS.glass));
  group.add(new THREE.Mesh(loft(seam, zs.length - 1), MATERIALS.shell));

  return group;
}
