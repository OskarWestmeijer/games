// Isometric math + small deterministic noise helpers.
// Tiles are 2:1 diamonds. World coordinates are in *tile units* and may be
// fractional (so entities move smoothly). Tile (i, j) is centred at world (i, j).

export const TILE_W = 64;
export const TILE_H = 32;

/** World tile coordinates -> screen pixels (before the camera offset). */
export function worldToScreen(wx: number, wy: number): { x: number; y: number } {
  return {
    x: (wx - wy) * (TILE_W / 2),
    y: (wx + wy) * (TILE_H / 2)
  };
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Cheap, stable hash of two floats -> 0..1. Good enough for placement/variation. */
export function hashf(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
