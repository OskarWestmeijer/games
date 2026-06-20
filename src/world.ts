// Builds the farm (umpipiha) area — the only area in the game right now. A literal,
// structure-faithful build of design/farm-layout/v4-umpipiha-topdown.png; the design
// mockup's data (design/farm-layout/generate.mjs) is mirrored below as the source of
// truth. Other areas (lake, suo) are separate, deferred areas — see CLAUDE.md.

import { hashf } from './iso';
import type {
  Aitta,
  Barn,
  Cow,
  Deer,
  Entity,
  House,
  Outbuilding,
  Player,
  Solid,
  Spring,
  Stream,
  Tile,
  Villager,
  Well,
  World
} from './types';

export function tileAt(world: World, tx: number, ty: number): Tile | undefined {
  if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return undefined;
  return world.tiles[ty * world.width + tx];
}

/** Can an entity stand at this (fractional) world position? */
export function isWalkable(world: World, wx: number, wy: number): boolean {
  const tx = Math.round(wx);
  const ty = Math.round(wy);
  const t = tileAt(world, tx, ty);
  if (!t) return false;
  if (t.type === 'water') return false;
  for (const h of world.solids) {
    if (Math.abs(wx - h.wx) < h.w / 2 + 0.15 && Math.abs(wy - h.wy) < h.d / 2 + 0.15) {
      return false;
    }
  }
  return true;
}

/** Distance from point (px,py) to segment (ax,ay)-(bx,by). */
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy || 1e-6;
  let t = (wx * vx + wy * vy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return Math.hypot(dx, dy);
}

function distToPolyline(x: number, y: number, pts: [number, number][]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const s = distToSeg(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (s < d) d = s;
  }
  return d;
}

/** Ray-casting point-in-polygon test (works for any simple polygon). */
function pointInPoly(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- design -> game coordinate mapping --------------------------------------
// design/farm-layout/generate.mjs lays the farm out in world-space METRES with y
// inverted (py = MARGIN.top + (WORLD.h - y) * SCALE) so the gate reads near the bottom
// of the isometric camera (foreground, close to the player) and the pihapiiri recedes
// upward (background) behind it. We use the same 1 tile = 1 metre scale and re-apply
// that exact inversion to port the mockup's (x, y) into this game's (wx, wy) tile-unit
// world, padded by a forest MARGIN on every side so nothing sits flush against the
// map's hard edge (the map boundary blocks movement).
const DESIGN_W = 190;
const DESIGN_H = 110;
const MARGIN = 10;
const WIDTH = DESIGN_W + MARGIN * 2;
const HEIGHT = DESIGN_H + MARGIN * 2;
const X = (x: number): number => x + MARGIN;
const Y = (y: number): number => DESIGN_H - y + MARGIN;
const XY = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [X(x), Y(y)]);

interface BuildingDef {
  x: number;
  y: number;
  w: number;
  h: number;
}
const center = (b: BuildingDef): { wx: number; wy: number } => ({ wx: X(b.x + b.w / 2), wy: Y(b.y + b.h / 2) });

const TUPA: BuildingDef = { x: 90, y: 90, w: 8, h: 6 };
const AITTA: BuildingDef = { x: 76, y: 86, w: 6, h: 5 };
const NAVETTA: BuildingDef = { x: 100, y: 74, w: 5, h: 10 };
const SAVUSAUNA: BuildingDef = { x: 106, y: 90, w: 4, h: 4 };
const RIIHI: BuildingDef = { x: 24, y: 70, w: 11, h: 6 };
const LATO: BuildingDef = { x: 128, y: 55, w: 9, h: 5 };
// tucked to the side of the yard, off the main gate's sightline, reached by its
// own short spur off a separate gap in the west fence (see FENCE_SEGMENTS/PATHS).
const KAYMALA: BuildingDef = { x: 68, y: 80, w: 2, h: 2 };

const KAIVO = { wx: X(98), wy: Y(84) };

// kasvimaa: design x84-94, y78-86 (y flipped so y0 < y1 in game space).
const KASVIMAA = { x0: X(84), x1: X(94), y0: Y(86), y1: Y(78) };

// pihapiiri (yard) interior: design x74-105, y74-96.
const YARD = { x0: X(74), x1: X(105), y0: Y(96), y1: Y(74) };

const FENCE_SEGMENTS: [number, number, number, number][] = (
  [
    [74, 96, 90, 96],
    [98, 96, 105, 96], // north wall, tupa fills the gap
    [74, 82, 74, 96],
    [74, 74, 74, 78], // west wall, käymälä-path gap at 78-82
    [105, 84, 105, 96], // east wall, navetta fills 74-84
    [74, 74, 86, 74],
    [93, 74, 100, 74] // south wall, gate gap, navetta fills 100-105
  ] as [number, number, number, number][]
).map(([ax, ay, bx, by]) => [X(ax), Y(ay), X(bx), Y(by)]);

const FIELDS: [number, number][][] = (
  [
    [[68, 63], [70, 30], [42, 18], [28, 36], [35, 63]], // ruis (rye)
    [[125, 56], [172, 46], [165, 14], [128, 18], [122, 38]], // ohra (barley)
    [[98, 62], [120, 58], [116, 36], [100, 38]], // kaura (oats)
    [[76, 63], [95, 61], [92, 43], [78, 45]] // nauris (turnip)
  ] as [number, number][][]
).map(XY);

// pasture east of the yard, reachable from the navetta's outer door (with a deliberate
// forest gap between them, not flush against the cowshed wall).
const NIITTY: [number, number][] = XY([[113, 65], [150, 65], [150, 100], [113, 100]]);

// gate → fields, with a fork to the riihi, and a short spur to the käymälä. Routed
// through the open corridor between the fields (not through their crop rows); riihi
// sits north of (above) its spur so it reads clearly in the isometric camera.
const PATHS: [number, number][][] = (
  [
    [[89.5, 74], [80, 70], [73, 66], [73, 48]],
    [[73, 66], [50, 66], [30, 66], [29.5, 70]],
    [[74, 80], [69, 80]]
  ] as [number, number][][]
).map(XY);

function distToPath(x: number, y: number): number {
  let d = Infinity;
  for (const line of PATHS) d = Math.min(d, distToPolyline(x, y, line));
  return d;
}

export function generateWorld(): World {
  const width = WIDTH;
  const height = HEIGHT;
  const tiles: Tile[] = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles[y * width + x] = { type: 'grass', v: hashf(x + 0.3, y + 0.7), shore: false };
    }
  }

  // Cultivated ground — kasvimaa and the pellot all reuse the 'field' tile type.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inKasvimaa = x >= KASVIMAA.x0 && x <= KASVIMAA.x1 && y >= KASVIMAA.y0 && y <= KASVIMAA.y1;
      if (inKasvimaa || FIELDS.some((f) => pointInPoly(x, y, f))) tiles[y * width + x].type = 'field';
    }
  }

  // Muddy pihapiiri (yard) ground.
  for (let y = Math.ceil(YARD.y0); y <= Math.floor(YARD.y1); y++) {
    for (let x = Math.ceil(YARD.x0); x <= Math.floor(YARD.x1); x++) {
      const t = tiles[y * width + x];
      if (t.type === 'grass') t.type = 'path';
    }
  }

  // Worn dirt paths.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x];
      const wobble = (hashf(x * 1.7, y * 1.3) - 0.5) * 0.5;
      if (t.type === 'grass' && distToPath(x, y) + wobble < 1.0) t.type = 'path';
    }
  }

  const entities: Entity[] = [];

  // ---- buildings ------------------------------------------------------------
  const tupa: House = { kind: 'house', ...center(TUPA), w: TUPA.w, d: TUPA.h, seed: hashf(3.2, 8.1) };
  const aitta: Aitta = { kind: 'aitta', ...center(AITTA), w: AITTA.w, d: AITTA.h, seed: hashf(5.1, 7.7) };
  const navetta: Barn = { kind: 'barn', ...center(NAVETTA), w: NAVETTA.w, d: NAVETTA.h, seed: hashf(4.4, 9.2) };
  entities.push(tupa, aitta, navetta);

  const outbuildings: Outbuilding[] = [
    { kind: 'outbuilding', btype: 'savusauna', ...center(SAVUSAUNA), w: SAVUSAUNA.w, d: SAVUSAUNA.h, seed: hashf(1.4, 6.6) },
    { kind: 'outbuilding', btype: 'riihi', ...center(RIIHI), w: RIIHI.w, d: RIIHI.h, seed: hashf(8.2, 2.9) },
    { kind: 'outbuilding', btype: 'lato', ...center(LATO), w: LATO.w, d: LATO.h, seed: hashf(6.6, 4.4) },
    { kind: 'outbuilding', btype: 'kaymala', ...center(KAYMALA), w: KAYMALA.w, d: KAYMALA.h, seed: hashf(9.9, 1.1) }
  ];
  entities.push(...outbuildings);

  const well: Well = { kind: 'well', wx: KAIVO.wx, wy: KAIVO.wy, seed: hashf(2.7, 4.9) };
  entities.push(well);

  // ---- pihapiiri fence, with the portti (gate) left as a gap in the segments
  const posts = new Map<string, { wx: number; wy: number; railX: boolean; railY: boolean }>();
  const post = (wx: number, wy: number) => {
    const k = `${wx},${wy}`;
    let p = posts.get(k);
    if (!p) {
      p = { wx, wy, railX: false, railY: false };
      posts.set(k, p);
    }
    return p;
  };
  for (const [ax, ay, bx, by] of FENCE_SEGMENTS) {
    if (ay === by) {
      const x0 = Math.min(ax, bx);
      const x1 = Math.max(ax, bx);
      for (let x = x0; x <= x1; x++) {
        const p = post(x, ay);
        if (x < x1) p.railX = true;
      }
    } else {
      const y0 = Math.min(ay, by);
      const y1 = Math.max(ay, by);
      for (let y = y0; y <= y1; y++) {
        const p = post(ax, y);
        if (y < y1) p.railY = true;
      }
    }
  }
  for (const p of posts.values()) entities.push({ kind: 'fence', ...p });

  // ---- variksenpelätin, at the kasvimaa's near (foreground) corner ---------
  entities.push({
    kind: 'scarecrow',
    wx: KASVIMAA.x0 + 0.4,
    wy: KASVIMAA.y1 - 0.4,
    facing: 1,
    seed: hashf(9.1, 6.6)
  });

  // ---- niitty (pasture): the cow's home, wife at the navetta's outer door --
  // there's a deliberate ~8m forest gap between the navetta and the niitty, so the
  // cow's home sits a little past that gap, comfortably inside the pasture.
  const cowHome = { x: navetta.wx + navetta.w / 2 + 13, y: navetta.wy };
  const cow: Cow = {
    kind: 'cow',
    wx: cowHome.x,
    wy: cowHome.y,
    facing: -1,
    homeX: cowHome.x,
    homeY: cowHome.y,
    tx: cowHome.x,
    ty: cowHome.y,
    wait: 1,
    moving: false
  };
  entities.push(cow);

  // ---- the family at their stations -----------------------------------------
  const wife: Villager = {
    kind: 'villager',
    role: 'wife',
    wx: navetta.wx + navetta.w / 2 + 1.2,
    wy: navetta.wy,
    facing: 1, // faces the cow
    seed: hashf(2.1, 5.5)
  };
  const granny: Villager = {
    kind: 'villager',
    role: 'granny',
    wx: tupa.wx - tupa.w / 2 - 1.4,
    wy: tupa.wy + 1.6,
    facing: -1,
    seed: hashf(6.3, 3.1)
  };
  // No lake here for the son to fish from (that returns with the lake area) —
  // he chops wood by the aitta instead. See drawSon in render.ts.
  const son: Villager = {
    kind: 'villager',
    role: 'son',
    wx: aitta.wx + aitta.w / 2 + 1.4,
    wy: aitta.wy - 1,
    facing: 1,
    seed: hashf(8.8, 4.2)
  };
  entities.push(wife, granny, son);

  // ---- a shy deer in the forest, just east of the niitty's edge -------------
  const deerHome = { x: navetta.wx + navetta.w / 2 + 55, y: navetta.wy - 3 };
  const deer: Deer = {
    kind: 'deer',
    wx: deerHome.x,
    wy: deerHome.y,
    facing: -1,
    homeX: deerHome.x,
    homeY: deerHome.y,
    tx: deerHome.x,
    ty: deerHome.y,
    wait: 2,
    moving: false,
    seed: hashf(5.5, 1.1)
  };
  entities.push(deer);

  // ---- the player, just inside the gate -------------------------------------
  const player: Player = {
    kind: 'player',
    wx: X(89.5),
    wy: Y(77),
    faceX: -1,
    faceY: -1,
    moving: false,
    anim: 0
  };

  // ---- footprints that block movement ---------------------------------------
  const solids: Solid[] = [
    { wx: tupa.wx, wy: tupa.wy, w: tupa.w, d: tupa.d },
    { wx: aitta.wx, wy: aitta.wy, w: aitta.w, d: aitta.d },
    { wx: navetta.wx, wy: navetta.wy, w: navetta.w, d: navetta.d },
    ...outbuildings.map((b) => ({ wx: b.wx, wy: b.wy, w: b.w, d: b.d })),
    { wx: well.wx, wy: well.wy, w: 1.1, d: 1.1 }
  ];

  // ---- tree/rock clearance: yard, niitty, buildings, paths, deer's clearing -
  const dist = (x: number, y: number, ox: number, oy: number): number => Math.hypot(x - ox, y - oy);
  const niittyXs = NIITTY.map((p) => p[0]);
  const niittyYs = NIITTY.map((p) => p[1]);
  const niittyBounds = {
    x0: Math.min(...niittyXs),
    x1: Math.max(...niittyXs),
    y0: Math.min(...niittyYs),
    y1: Math.max(...niittyYs)
  };
  const clearCircles: { x: number; y: number; r: number }[] = [
    { x: player.wx, y: player.wy, r: 4 },
    { x: tupa.wx, y: tupa.wy, r: Math.max(tupa.w, tupa.d) / 2 + 2.5 },
    { x: aitta.wx, y: aitta.wy, r: Math.max(aitta.w, aitta.d) / 2 + 2 },
    { x: navetta.wx, y: navetta.wy, r: Math.max(navetta.w, navetta.d) / 2 + 2 },
    ...outbuildings.map((b) => ({ x: b.wx, y: b.wy, r: Math.max(b.w, b.d) / 2 + 2 })),
    { x: well.wx, y: well.wy, r: 2 },
    { x: cowHome.x, y: cowHome.y, r: 7 },
    { x: deerHome.x, y: deerHome.y, r: 6 }
  ];
  const inClear = (x: number, y: number): boolean => {
    if (x >= YARD.x0 - 1 && x <= YARD.x1 + 1 && y >= YARD.y0 - 1 && y <= YARD.y1 + 1) return true;
    if (x >= niittyBounds.x0 && x <= niittyBounds.x1 && y >= niittyBounds.y0 && y <= niittyBounds.y1) return true;
    if (clearCircles.some((c) => dist(x, y, c.x, c.y) < c.r)) return true;
    return false;
  };

  // ---- metsä: dense forest backdrop, koivu/mänty/kuusi mixed in -------------
  const DENSITY = 0.32;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x];
      if (t.type !== 'grass') continue;
      if (inClear(x, y)) continue;
      if (distToPath(x, y) < 2) continue;

      const clump = hashf(Math.floor(x / 3), Math.floor(y / 3));
      const n = hashf(x * 1.3 + 5, y * 1.7 + 9);
      if (n < DENSITY * (0.45 + clump)) {
        const r = hashf(x * 2.1 + 8, y * 1.9 + 2);
        const variant: 0 | 1 | 2 = r < 0.38 ? 0 : r < 0.72 ? 2 : 1; // mostly kuusi/mänty, some koivu
        entities.push({
          kind: 'tree',
          wx: x + (hashf(x, y) - 0.5) * 0.6,
          wy: y + (hashf(y, x) - 0.5) * 0.6,
          variant,
          seed: hashf(x * 3.1, y * 2.7),
          scale: 1.35 + hashf(x + 11, y + 4) * 0.85
        });
      }
    }
  }

  // ---- kalliot ja kivet — scattered bedrock outcrops and stones -------------
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x];
      if (t.type !== 'grass') continue;
      if (inClear(x, y)) continue;
      if (distToPath(x, y) < 1.5) continue;
      const r = hashf(x * 5.5, y * 4.2);
      if (r > 0.978) {
        const boulder = hashf(x * 1.1 + 2, y * 1.3 + 6) > 0.62;
        entities.push({
          kind: 'rock',
          wx: x,
          wy: y,
          seed: hashf(x, y * 2),
          scale: boulder ? 1.3 + hashf(x + 3, y) * 1.1 : 0.6 + hashf(x + 3, y) * 0.6,
          boulder
        });
      }
    }
  }

  // ---- streams/springs: none in this area right now (the puro/lähde were cutting
  // through the rye field; kept as types for whichever area needs them next) -----
  const streams: Stream[] = [];
  const springs: Spring[] = [];

  return { width, height, tiles, entities, player, solids, streams, springs };
}
