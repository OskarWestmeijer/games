import * as THREE from 'three';

/**
 * The walkable floor, as a union of convex polygons in the XZ plane.
 *
 * The pod could express where you were allowed to stand as one `Box3`. A station cannot: a
 * hub with arms off it is not convex, and neither is a room with its corners cut off. So the
 * floor becomes a *list* of convex pieces — rooms, corridors — and the player is clamped to
 * whichever one they are nearest.
 *
 * **Clamping, not pushing.** `pushOutOfObstacles` in `fpv-controls.ts` resolves furniture by
 * shoving the eye back out of a box it has already entered, which is fine for a desk and
 * would be a disaster for a wall: a fast enough step passes clean through a thin one between
 * two frames. This runs the other way round — a position outside every region is *moved onto*
 * the nearest one, unconditionally, so there is nothing to tunnel through however large the
 * step.
 *
 * **Neighbouring regions have to overlap.** A doorway is not a hole in a wall here, it is the
 * place where the corridor's rectangle and the room's rectangle share some floor. Butt them
 * exactly edge to edge and the closest-point clamp has a seam to catch you on; overlap them
 * by at least the player radius and walking through is continuous. `layout.ts` does this by
 * running every corridor a little way *into* the rooms at both of its ends.
 */
export type Region = THREE.Vector2[];

/** An axis-aligned rectangle, wound counter-clockwise in XZ. */
export function rectRegion(minX: number, minZ: number, maxX: number, maxZ: number): Region {
  return [
    new THREE.Vector2(minX, minZ),
    new THREE.Vector2(maxX, minZ),
    new THREE.Vector2(maxX, maxZ),
    new THREE.Vector2(minX, maxZ)
  ];
}

/** A regular polygon, flat-side-out when `offset` is half a step — which is how the hub is drawn. */
export function regularRegion(
  cx: number,
  cz: number,
  radius: number,
  sides: number,
  offset = Math.PI / sides
): Region {
  const points: Region = [];
  for (let i = 0; i < sides; i++) {
    const a = offset + (i / sides) * Math.PI * 2;
    points.push(new THREE.Vector2(cx + Math.cos(a) * radius, cz + Math.sin(a) * radius));
  }
  return points;
}

/** Shrinks a convex region towards its centroid. Cheap, and exact enough for wall clearance. */
export function insetRegion(region: Region, amount: number): Region {
  const c = new THREE.Vector2();
  for (const p of region) c.add(p);
  c.divideScalar(region.length);
  return region.map((p) => {
    const d = p.clone().sub(c);
    const len = d.length();
    return len <= amount ? c.clone() : c.clone().addScaledVector(d, (len - amount) / len);
  });
}

/**
 * Cuts a convex region with a half-plane, keeping the side where `nx*x + nz*z <= d`.
 *
 * Convexity is preserved, which is the whole point: the bridge's deck is the hull's outline with
 * the stair well taken out of one corner, and expressing that as two clipped copies of the same
 * convex outline keeps both halves usable by `clampToRegions` with no decomposition to get wrong.
 */
export function clipRegion(region: Region, nx: number, nz: number, d: number): Region {
  const out: Region = [];
  for (let i = 0; i < region.length; i++) {
    const a = region[i];
    const b = region[(i + 1) % region.length];
    const da = nx * a.x + nz * a.y - d;
    const db = nx * b.x + nz * b.y - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    }
  }
  return out;
}

/** Rotates a region about the origin. Only ever called with multiples of 90°, which is why
 * axis-aligned things in `layout.ts` stay axis-aligned after placement. */
export function rotateRegion(region: Region, radians: number): Region {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return region.map((p) => new THREE.Vector2(p.x * c - p.y * s, p.x * s + p.y * c));
}

export function translateRegion(region: Region, dx: number, dz: number): Region {
  return region.map((p) => new THREE.Vector2(p.x + dx, p.y + dz));
}

/** Winding-agnostic: true when the point is on the same side of every edge. */
export function contains(region: Region, x: number, z: number): boolean {
  let positive = false;
  let negative = false;
  for (let i = 0; i < region.length; i++) {
    const a = region[i];
    const b = region[(i + 1) % region.length];
    const cross = (b.x - a.x) * (z - a.y) - (b.y - a.y) * (x - a.x);
    if (cross > 1e-6) positive = true;
    else if (cross < -1e-6) negative = true;
    if (positive && negative) return false;
  }
  return true;
}

const _closest = new THREE.Vector2();

/** Closest point to (x, z) on a region's boundary, written into `out`. Returns the distance. */
function closestOnBoundary(region: Region, x: number, z: number, out: THREE.Vector2): number {
  let best = Infinity;
  for (let i = 0; i < region.length; i++) {
    const a = region[i];
    const b = region[(i + 1) % region.length];
    const ex = b.x - a.x;
    const ez = b.y - a.y;
    const lenSq = ex * ex + ez * ez;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.y) * ez) / lenSq));
    const px = a.x + ex * t;
    const pz = a.y + ez * t;
    const d = (px - x) * (px - x) + (pz - z) * (pz - z);
    if (d < best) {
      best = d;
      out.set(px, pz);
    }
  }
  return Math.sqrt(best);
}

/**
 * Holds a point inside the union. Inside any region it is left alone; outside every one of
 * them it is moved to the nearest boundary point of the nearest region. Writes back into
 * `point`.
 */
export function clampToRegions(point: THREE.Vector2, regions: Region[]): void {
  for (const region of regions) {
    if (contains(region, point.x, point.y)) return;
  }

  let bestDistance = Infinity;
  let bestX = point.x;
  let bestZ = point.y;
  for (const region of regions) {
    const d = closestOnBoundary(region, point.x, point.y, _closest);
    if (d < bestDistance) {
      bestDistance = d;
      bestX = _closest.x;
      bestZ = _closest.y;
    }
  }
  point.set(bestX, bestZ);
}

/**
 * A piece of walkable floor at a height — a `Region` that also knows how far off the datum it
 * is and which storey it belongs to.
 *
 * A `Region` alone cannot describe two storeys: it is XZ only, so a mezzanine and the floor
 * under it are the same rectangle and `clampToRegions` cannot tell them apart. Rather than
 * give regions a third coordinate (which would make every clamp a 3D problem for no gain in a
 * building with flat floors), the player carries a **level**, and only the decks reachable
 * from that level are clamped against. Stepping off a mezzanine is then not prevented, it is
 * simply not expressible: the lower floor is not in the set while you are up there.
 *
 * A staircase is the one deck that belongs to *both* levels, and it is what moves you between
 * them: `floorAt` ramps, and `levelAt` answers the lower storey at its foot and the upper one
 * past its middle. Crossing that midpoint is what swaps the walkable set.
 */
export interface Deck {
  region: Region;
  /** Storeys this floor is reachable from. A flat deck has one; a stair has both of its ends. */
  levels: number[];
  /** Floor height at (x, z). Constant for a deck, linear for a stair. */
  floorAt(x: number, z: number): number;
  /** The storey you count as standing on while here. Constant except on a stair. */
  levelAt(x: number, z: number): number;
}

export function flatDeck(region: Region, y: number, level: number): Deck {
  return { region, levels: [level], floorAt: () => y, levelAt: () => level };
}

/**
 * A ramp along Z, between two flat decks.
 *
 * `floorAt` is **clamped** outside `fromZ..toZ` on purpose: the region is drawn longer than the
 * ramp so that it overlaps the deck at each end (the same trick the pod's corridors used to
 * join rooms), and in those overlaps it has to report exactly the flat height of the deck it is
 * sharing floor with, or there is a step at every seam.
 */
export function rampDeck(
  region: Region,
  fromZ: number,
  fromY: number,
  toZ: number,
  toY: number,
  levels: [number, number]
): Deck {
  const span = toZ - fromZ;
  const progress = (z: number) => Math.max(0, Math.min(1, (z - fromZ) / span));
  const midZ = (fromZ + toZ) / 2;
  return {
    region,
    levels,
    floorAt: (_x, z) => fromY + (toY - fromY) * progress(z),
    // Which end you are counted as being on. The midpoint is arbitrary but has to be *inside*
    // the ramp: put it at either end and you would swap sets while still standing on a deck
    // that the new set does not contain.
    levelAt: (_x, z) => ((z - fromZ) / span > 0.5 ? levels[1] : levels[0])
  };
}

/**
 * The deck a point is standing on. **First match wins**, so the order of the array is
 * meaningful: a staircase and the floor underneath it occupy the same XZ, and listing the
 * stair first is what puts you on the treads rather than beneath them.
 */
export function deckAt(x: number, z: number, decks: Deck[]): Deck | null {
  for (const deck of decks) {
    if (contains(deck.region, x, z)) return deck;
  }
  return null;
}

/**
 * A curved flight of stairs, as a chain of convex decks sharing one height function.
 *
 * A staircase that turns is an annular sector, and an annular sector is not convex — so it
 * cannot be one `Region`. It is cut into segments instead, each a quad between two radii and
 * two angles, which is convex for any sane segment count. What holds them together is that
 * every segment answers height and storey from the *same* function of the angle about the
 * centre, so the seams between them are exact however coarse the cut: there is no per-segment
 * height to disagree about.
 *
 * Neighbouring segments are widened by `overlap` **metres** at each end so the clamp has shared
 * floor to move you across rather than a seam to catch you on — the same reason the flat decks
 * overlap each other. Metres and not radians: the station's flight hugs a shallow wall on a 20 m
 * radius, where the 0.035 rad this used to default to is 0.7 m of overlap — most of a whole
 * segment, spilling the sector well past both of its ends.
 *
 * **A radius may be a function of `t`**, the fraction along the sweep, and for the walkable band
 * of a flight climbing a curved hull it has to be. The hull leans inward above the waist, so how
 * far out the player's *head* may be depends on how high up the flight they are — a single
 * radius has to take the worst case, which at the top of the station's flight is nearly a metre
 * off the wall. Applied at the foot as well, that leaves a strip of the *floor* outside the band
 * and directly under the lowest treads: you walk along the wall, the deck below the stair claims
 * you, and you are standing inside the steps. Let the band follow the lean and there is no strip
 * at the bottom at all, and the one further up is honest headroom under a flight 2 m overhead.
 *
 * **The sweep must be under half a turn and must not straddle the ±180° branch cut of
 * `atan2`.** Both hold for the station's stair and neither is worth the unwrapping code until
 * something needs it.
 */
/** A radius that may vary along the flight. `t` runs 0 at the foot to 1 at the top. */
export type ArcRadius = number | ((t: number) => number);

export interface ArcSpec {
  center: THREE.Vector2;
  innerRadius: ArcRadius;
  outerRadius: ArcRadius;
  /** Radians. The sweep runs `fromAngle` → `toAngle` and may run either way round. */
  fromAngle: number;
  toAngle: number;
  fromY: number;
  toY: number;
  levels: [number, number];
  /** How many convex quads to cut the sector into. */
  segments?: number;
  /** Metres of shared floor between neighbouring segments. */
  overlap?: number;
  /**
   * Radians of extra sector past `toAngle`, at the full `toY`. This is how the top of the
   * flight comes to share floor with the deck it arrives on — the treads stop at `toAngle`,
   * the walkable surface runs on a little further, flat.
   */
  topExtension?: number;
}

export function arcDecks(spec: ArcSpec): Deck[] {
  const {
    center,
    innerRadius,
    outerRadius,
    fromAngle,
    toAngle,
    fromY,
    toY,
    levels,
    segments = 10,
    overlap = 0.12,
    topExtension = 0
  } = spec;

  const sweep = toAngle - fromAngle;
  const direction = Math.sign(sweep);

  /** A radius at one angle. Constant radii ignore the angle; varying ones are clamped to the
   *  flight's own 0..1, so the overlaps at both ends read as the width they sit next to. */
  function radiusAt(radius: ArcRadius, angle: number): number {
    if (typeof radius === 'number') return radius;
    return radius(Math.max(0, Math.min(1, (angle - fromAngle) / sweep)));
  }

  // The overlap is given in metres and applied as an angle, so it needs a radius to convert
  // through. The middle of the band at the middle of the flight is representative to well
  // within the precision this is doing anything with.
  const midAngle = fromAngle + sweep / 2;
  const midRadius =
    (radiusAt(innerRadius, midAngle) + radiusAt(outerRadius, midAngle)) / 2;
  const overlapAngle = overlap / Math.max(0.01, midRadius);

  /** How far along the flight a point is, 0 at the foot and 1 at the top. */
  function progress(x: number, z: number): number {
    const angle = Math.atan2(z - center.y, x - center.x);
    // Relative to the foot and wrapped into (-π, π], which is unambiguous for a sweep this
    // size. Clamped, so the overlaps at both ends read as the flat height they sit at.
    const delta =
      ((angle - fromAngle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return Math.max(0, Math.min(1, delta / sweep));
  }

  const decks: Deck[] = [];
  const end = toAngle + direction * topExtension;
  for (let i = 0; i < segments; i++) {
    const a0 = fromAngle + ((end - fromAngle) * i) / segments - direction * overlapAngle;
    const a1 = fromAngle + ((end - fromAngle) * (i + 1)) / segments + direction * overlapAngle;
    const corner = (r: ArcRadius, a: number) => {
      const radius = radiusAt(r, a);
      return new THREE.Vector2(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius);
    };
    decks.push({
      region: [corner(innerRadius, a0), corner(outerRadius, a0), corner(outerRadius, a1), corner(innerRadius, a1)],
      levels,
      floorAt: (x, z) => fromY + (toY - fromY) * progress(x, z),
      levelAt: (x, z) => (progress(x, z) > 0.5 ? levels[1] : levels[0])
    });
  }
  return decks;
}
