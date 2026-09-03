import * as THREE from 'three';
import { MATERIALS } from './shell';
import type { Region } from '../regions';

/**
 * The hull's form, as functions.
 *
 * An **ovoid**: a round, closed bulb aft where the bridge is, holding its beam forward through
 * the whole hall and then rounding off into a blunt, domed nose — curved in **plan and elevation
 * at once**. One profile `f(z)` scales a single elliptical cross-section along the length, and
 * everything about the shape — the floor's outline, the roof height over any point, how far a
 * railing may stand out at *its own* height, where the staircase's wall runs — falls out of that
 * one curve.
 *
 * Nose at -Z, as always: the face `updateOrbit()` aims at the planet.
 *
 *   SIDE (nose left)                     PLAN
 *         __--‾‾‾‾‾‾‾‾‾‾‾‾--__                  __--‾‾‾‾‾‾‾‾--__
 *      _-‾                    ‾-_        __--‾‾                 ‾‾--__
 *    _-‾        bridge ▬▬▬▬▬      ‾-_   <                              >
 *   (  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  )   ‾‾--__                 __--‾‾
 *    ‾--_______________________-- -‾            ‾‾--________--‾‾
 *      cap                    tail
 *
 * **The nose used to come to a point, and the concept sheet does not.** The forward half was a
 * plain half-ellipse over its whole 10.6 m — a long, even taper into a spike, which meant the
 * hull was still visibly narrowing everywhere you stood and the canopy's longerons ran into a
 * needle. `ai-assets/space_station_outside.jpeg` is an egg: full beam most of the way forward,
 * closing over the last metre and a half into a round glazed cap with a collar round it. Raising
 * `NOSE_ROUND` from 2 to 3 is that whole change — the profile is the shape.
 *
 * Three properties of the profile are load-bearing, and none of them is aesthetic:
 *
 * - **`sqrt(1 - x^p)` is concave, so the floor's outline is convex.** That is what lets the whole
 *   lower deck stay a *single* convex region for `clampToRegions` (see `regions.ts`). The floor's
 *   half-width is exactly `HW_MAX * sqrt(1 - FLOOR_DROP²) * f(z)` — a constant times the profile —
 *   so convex floor and concave profile are the same statement. This family is concave for **any
 *   exponent >= 2** (its second derivative carries a factor of `(p - 1) + u^p (1 - p/2)`, which is
 *   at least `p/2` on the unit interval), so `NOSE_ROUND` and `TAIL_ROUND` are free to move within
 *   that. A profile from *outside* the family is not a free choice — check it.
 * - **The profile reaches zero at both ends, so the loft closes itself.** There are no end caps
 *   and no code to add them: `ringPoint` collapses a vanishing section onto the axis, so tip and
 *   tail are sealed by the same triangles that make the sides. The tail used to stop at 84% of
 *   full beam and simply end, which left a 10 m elliptical hole open to space behind the globe —
 *   in shot, every time you turned round on the bridge.
 * - **The two round-off exponents are what keep each end under a roof.** A plain ellipse
 *   (exponent 2) starts closing immediately: aft it was short of headroom by the globe, and
 *   forward it left the lounge with 2.6 m of half-width at the front edge of its own dais. Powers
 *   above two hold the section near full and then round off hard over the last stretch, which is
 *   both what a teardrop's fat end and what an egg's blunt end actually look like.
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
 * How each end rounds off: `sqrt(1 - u^ROUND)` over its own run. Two is a plain ellipse and
 * starts falling away at once; higher powers hold the section near full and then close over the
 * last stretch.
 *
 * **Aft**, four is what keeps the bridge under a roof — turning it down costs headroom over the
 * globe, which sits three quarters of the way to the tail.
 *
 * **Forward**, three is what makes the nose blunt instead of pointed, and it buys the lounge the
 * room it was short of: at the forward edge of the dais (z = -6.5) the floor goes from 2.64 out
 * to 3.11 and the roof from 3.69 to 4.34, against a dais 2.3 across. Nothing about the station's
 * envelope grows — `HW_MAX`, `ROOF_MAX` and both ends stay exactly where they were — the hull
 * simply stops narrowing so early. Which is also what leaves a cap wide enough to be a window:
 * see `NOSE_CAP_FRACTION` in `hall.ts`.
 */
const TAIL_ROUND = 4;
const NOSE_ROUND = 3;

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
  return Math.sqrt(Math.max(0, 1 - s ** NOSE_ROUND));
}

export function sectionAt(z: number): Section {
  const f = profile(THREE.MathUtils.clamp(z, Z_TIP, Z_TAIL));
  const hw = HW_MAX * f;
  const hh = HH_MAX * f;
  const yc = FLOOR_DROP * hh;
  return { hw, hh, yc, roof: yc + hh };
}

/**
 * The z, forward of the fullest section, where the profile is `fraction` of full beam.
 *
 * The inverse of the forward branch, and it exists so the nose cap's collar can be **derived
 * from the hull** the way the staircase is derived from the wall: `hall.ts` asks for the station
 * where the hull has closed to 62% and puts the collar there, so the cap follows any later change
 * to `NOSE_ROUND` or to the hull's length instead of drifting off it.
 */
export function zForProfile(fraction: number): number {
  const f = THREE.MathUtils.clamp(fraction, 0, 1);
  const s = (1 - f * f) ** (1 / NOSE_ROUND);
  return Z_MAX - s * (Z_MAX - Z_TIP);
}

/**
 * Where the nose cap begins: the station at which the hull has closed to `NOSE_CAP_FRACTION` of
 * full beam, which is where `hall.ts` puts its collar.
 *
 * A fraction rather than a z, so the cap stays on the shoulder of the nose whatever `NOSE_ROUND`
 * or the hull's length does later. It lives here rather than in `hall.ts` because two modules
 * want it now: the frames that draw the cap, and `SPAWN`, which aims the arriving camera at the
 * middle of it.
 */
export const NOSE_CAP_FRACTION = 0.62;
export const NOSE_CAP_Z = zForProfile(NOSE_CAP_FRACTION);

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
 * One point on a ring: `t` runs 0..1 from the starboard floor edge, **up over the crown**, down
 * to the port one — the arc of the section's ellipse above the floor plate, and the only part of
 * the hull anyone aboard can see. Constant `t` traced along Z is a **longeron**; see the frames
 * in `hall.ts`, which is why this is a point function and not just `ringAt`.
 *
 * `keelPoint` is the rest of the same ellipse.
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

/**
 * One point on a **keel** ring: the same section's ellipse *below* the floor plane, running from
 * the starboard floor edge under the bottom to the port one. The complement of `ringPoint`, so
 * the two together close the section.
 *
 * **This exists only to be seen from outside.** For most of the station's life nothing below the
 * floor plate was modelled at all — the player can never leave, so it halved the hull's geometry
 * and removed any question about what the underside looked like. The first exterior shot answered
 * that question anyway: a station sliced off flat along its waterline, a half-egg on a plate,
 * where `space_station_outside.jpeg` is a closed ovoid you could roll. It costs one more loft and
 * nothing indoors — the floor plate hides every triangle of it.
 */
export function keelPoint(z: number, t: number): THREE.Vector3 {
  const { hw, hh, yc } = sectionAt(z);
  if (hh <= 1e-4) return new THREE.Vector3(0, 0, z);
  const floorAngle = Math.acos(THREE.MathUtils.clamp(-yc / hh, -1, 1));
  const a = floorAngle + (2 * Math.PI - 2 * floorAngle) * THREE.MathUtils.clamp(t, 0, 1);
  return new THREE.Vector3(hw * Math.sin(a), yc + hh * Math.cos(a), z);
}

export function ringAt(z: number, points = RING_POINTS): THREE.Vector3[] {
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < points; i++) ring.push(ringPoint(z, i / (points - 1)));
  return ring;
}

export function keelAt(z: number, points = RING_POINTS): THREE.Vector3[] {
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < points; i++) ring.push(keelPoint(z, i / (points - 1)));
  return ring;
}

/**
 * The **whole** section as one closed loop, starboard floor edge up over the crown, round to
 * port, back under the keel and home — with the first point repeated at the end so a tube swept
 * along it closes.
 *
 * Only the collars want this. Everything else in the station is authored from the inside, where
 * half the loop is under the floor plate and invisible; a collar is a ring round the *outside* of
 * the hull, and one that stopped at the waterline would be a band drawn on the top half of an egg.
 */
export function sectionRing(z: number, points = RING_POINTS): THREE.Vector3[] {
  const top = ringAt(z, points);
  const bottom = keelAt(z, points).reverse().slice(1, -1);
  return [...top, ...bottom, top[0].clone()];
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
 * staircase's own 4.8 m the three-point circle is never more than 13 mm off the hull. Do not
 * extend this to a run that reaches round the tail, where the outline stops being an arc and
 * the error grows without warning.
 *
 * The radius is deliberately huge — 26 m against a 10 m beam — because the flank of an ovoid
 * *is* nearly straight amidships: it bows out by 11 cm over the whole run of the flight. That is
 * what hugging this wall looks like, and a tighter curve would be a spiral staircase standing in
 * the room next to the wall rather than a flight running along it.
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
 * Lofts the hull into three surfaces: above the floor, an opaque shell aft of `NOSE_Z` and glass
 * forward of it; below the floor, the keel in one opaque piece the whole length.
 *
 * The two halves above the floor **share the ring at the seam**, so there is no gap and no
 * double-drawn band however coarsely the hull is sampled. The keel crosses no seam — the glazing
 * is a *canopy*, and the reference sheet's belly is plain metal tip to tail.
 *
 * All three are `DoubleSide`, per the house rule: solving every triangle's winding buys nothing
 * here and a silently missing panel costs a lot.
 */
export function buildHullSurface(): THREE.Group {
  const group = new THREE.Group();
  const zs = stations();
  const rings = zs.map((z) => ringAt(z));
  const keel = zs.map((z) => keelAt(z));

  /** Lofts `sections[from..to]` into one geometry. */
  function loft(sections: THREE.Vector3[][], from: number, to: number): THREE.BufferGeometry {
    const position: number[] = [];
    const normal: number[] = [];
    const index: number[] = [];
    const cols = RING_POINTS;

    for (let i = from; i <= to; i++) {
      for (const p of sections[i]) {
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

  group.add(new THREE.Mesh(loft(rings, 0, seam), MATERIALS.glass));
  group.add(new THREE.Mesh(loft(rings, seam, zs.length - 1), MATERIALS.shell));
  // The keel is one piece and opaque the whole way: the glazing is a *canopy*, and the reference
  // sheet's belly is plain metal from tip to tail. It takes no seam because it crosses none.
  group.add(new THREE.Mesh(loft(keel, 0, zs.length - 1), MATERIALS.shell));

  return group;
}
