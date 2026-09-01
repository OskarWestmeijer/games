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
function contains(region: Region, x: number, z: number): boolean {
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
