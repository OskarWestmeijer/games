// Procedurally builds the little outdoor scene: a lake, a sandy shore, a suo (bog)
// with a plank boardwalk, a worn dirt path that leads off the map, two rustic log
// houses, dense koivu/mänty/kuusi forest, mossy boulders, a cow and a deer.
// Deterministic-ish but lightly random.

import { hashf } from './iso';
import type { Aitta, Barn, Cow, Deer, Entity, House, Player, Solid, Tile, Villager, Well, World } from './types';

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

/** Squared distance from point (px,py) to segment (ax,ay)-(bx,by). */
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

/** Smooth value noise (bilinear smoothstep) — for gently undulating, non-jittery edges. */
function snoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hashf(xi, yi);
  const b = hashf(xi + 1, yi);
  const c = hashf(xi, yi + 1);
  const d = hashf(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function generateWorld(width: number, height: number): World {
  const tiles: Tile[] = new Array(width * height);

  // Lake sits to the upper-right of the map; the homestead is lower-left.
  const lakeCx = width * 0.64;
  const lakeCy = height * 0.4;
  const lrx = width * 0.24;
  const lry = height * 0.17;
  const isWater = (x: number, y: number): boolean => {
    const nx = (x - lakeCx) / lrx;
    const ny = (y - lakeCy) / lry;
    // smooth, low-frequency wobble -> gently lobed coastline, not a per-tile jagged edge
    const wobble = (snoise(x * 0.17 + 1, y * 0.17 + 2) - 0.5) * 0.8;
    return nx * nx + ny * ny + wobble < 1;
  };

  // Suo (bog) sits in the lower-right, below the lake.
  const bogCx = width * 0.6;
  const bogCy = height * 0.78;
  const brx = width * 0.22;
  const bry = height * 0.16;
  const isBog = (x: number, y: number): boolean => {
    const nx = (x - bogCx) / brx;
    const ny = (y - bogCy) / bry;
    const wobble = (snoise(x * 0.16 + 9, y * 0.16 + 3) - 0.5) * 0.85;
    return nx * nx + ny * ny + wobble < 1;
  };

  // A worn path: from just south of the homestead, curving down across the bog and
  // off the bottom-right edge. Marked tile-by-tile against this polyline.
  const path: [number, number][] = [
    [width * 0.34, height * 0.58],
    [width * 0.44, height * 0.66],
    [width * 0.55, height * 0.73],
    [width * 0.62, height * 0.84],
    [width * 0.6, height * 0.99]
  ];
  const distToPath = (x: number, y: number): number => {
    let d = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const s = distToSeg(x, y, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
      if (s < d) d = s;
    }
    return d;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let type: Tile['type'] = 'grass';
      if (isWater(x, y)) type = 'water';
      else if (isBog(x, y)) type = 'bog';
      tiles[y * width + x] = { type, v: hashf(x + 0.3, y + 0.7), shore: false };
    }
  }

  const get = (x: number, y: number): Tile | undefined =>
    x < 0 || y < 0 || x >= width || y >= height ? undefined : tiles[y * width + x];

  // Despeckle the lake: fill single-tile holes and drop lone water tiles so the water
  // reads as one smooth body (no stray sand specks or pinholes from the noisy mask).
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = tiles[y * width + x];
        const nb = [get(x + 1, y), get(x - 1, y), get(x, y + 1), get(x, y - 1)];
        const landN = nb.filter((n) => n && n.type !== 'water').length;
        const waterN = nb.filter((n) => n?.type === 'water').length;
        if (t.type !== 'water' && landN === 0) t.type = 'water'; // hole hemmed by water/edge
        else if (t.type === 'water' && waterN === 0) t.type = 'grass'; // lone water tile
      }
    }
  }

  // Shore pass: sandy beach on land touching water, shore flags on water.
  const touchesWater = (x: number, y: number): boolean =>
    [get(x + 1, y), get(x - 1, y), get(x, y + 1), get(x, y - 1)].some((n) => n?.type === 'water');

  const touchesLand = (x: number, y: number): boolean =>
    [get(x + 1, y), get(x - 1, y), get(x, y + 1), get(x, y - 1)].some((n) => n != null && n.type !== 'water');

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x];
      // a water tile is "shore" only when it actually touches land — i.e. the lake rim,
      // not every interior tile (that was painting a foam chevron across the whole lake).
      if (t.type === 'water') t.shore = touchesLand(x, y);
      else if (t.type === 'grass' && touchesWater(x, y)) t.type = 'sand';
    }
  }

  // Path pass: dirt on land, pitkospuut planks where it crosses the bog.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x];
      const d = distToPath(x, y);
      const wobble = (hashf(x * 1.7, y * 1.3) - 0.5) * 0.5;
      if (d + wobble < 1.0) {
        if (t.type === 'bog') t.plank = true;
        else if (t.type === 'grass' || t.type === 'sand') t.type = 'path';
      }
    }
  }

  const entities: Entity[] = [];
  const dist = (x: number, y: number, ox: number, oy: number): number => Math.hypot(x - ox, y - oy);

  const player: Player = {
    kind: 'player',
    wx: width * 0.42,
    wy: height * 0.54,
    faceX: -1,
    faceY: -1,
    moving: false,
    anim: 0
  };

  // Two rustic houses, well clear of the water on the west side.
  const houses: House[] = [
    {
      kind: 'house',
      wx: Math.round(width * 0.23),
      wy: Math.round(height * 0.5),
      w: 2.8,
      d: 2.3,
      seed: hashf(3.2, 8.1)
    },
    {
      kind: 'house',
      wx: Math.round(width * 0.31),
      wy: Math.round(height * 0.42),
      w: 2.2,
      d: 1.9,
      seed: hashf(7.7, 2.4)
    }
  ];
  for (const h of houses) entities.push(h);

  // kasvimaa — a tilled vegetable patch east of the main house, planted in rows
  // (nauris/kaali — turnip/cabbage). See inspiration/medieval/maatila.jpg.
  const field = {
    x0: houses[0].wx + 2,
    x1: houses[0].wx + 6,
    y0: houses[0].wy - 2,
    y1: houses[0].wy + 1
  };
  for (let y = field.y0; y <= field.y1; y++) {
    for (let x = field.x0; x <= field.x1; x++) {
      const t = tileAt({ width, height, tiles } as World, x, y);
      if (t && (t.type === 'grass' || t.type === 'sand' || t.type === 'path')) t.type = 'field';
    }
  }
  const fieldCx = (field.x0 + field.x1) / 2;

  // navetta (cowshed) just south of the houses.
  const barn: Barn = {
    kind: 'barn',
    wx: Math.round(width * 0.23),
    wy: Math.round(height * 0.6),
    w: 2.0,
    d: 1.6,
    seed: hashf(4.4, 9.2)
  };
  entities.push(barn);

  // aitta — a small raised storehouse, in the open yard south-west of the tupa.
  const aitta: Aitta = {
    kind: 'aitta',
    wx: houses[0].wx - 2,
    wy: houses[0].wy + 4,
    w: 1.6,
    d: 1.3,
    seed: hashf(5.1, 7.7)
  };
  entities.push(aitta);

  // kaivo — the well, in the front yard close to the tupa for daily water.
  const well: Well = {
    kind: 'well',
    wx: houses[0].wx + 1,
    wy: houses[0].wy + 3,
    seed: hashf(2.7, 4.9)
  };
  entities.push(well);

  // Fenced paddock around the cow, with a gate on the side facing the houses.
  const px0 = barn.wx + 2;
  const px1 = barn.wx + 6;
  const py0 = barn.wy - 1;
  const py1 = barn.wy + 3;
  const gateX = Math.round((px0 + px1) / 2);
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
  for (let x = px0; x <= px1; x++) {
    if (x < px1) post(x, py0).railX = x !== gateX; // top edge, gate gap
    if (x < px1) post(x, py1).railX = true; // bottom edge
    post(x, py0);
    post(x, py1);
  }
  for (let y = py0; y <= py1; y++) {
    if (y < py1) post(px0, y).railY = true; // left
    if (y < py1) post(px1, y).railY = true; // right
    post(px0, y);
    post(px1, y);
  }
  for (const p of posts.values()) entities.push({ kind: 'fence', ...p });

  const cowHome = { x: (px0 + px1) / 2, y: (py0 + py1) / 2 };
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

  // The family at their stations.
  const wife: Villager = {
    kind: 'villager',
    role: 'wife',
    wx: cowHome.x - 1.4,
    wy: cowHome.y + 0.6,
    facing: 1, // faces the cow
    seed: hashf(2.1, 5.5)
  };
  const granny: Villager = {
    kind: 'villager',
    role: 'granny',
    wx: houses[0].wx + 1.8,
    wy: houses[0].wy + 2.2,
    facing: -1,
    seed: hashf(6.3, 3.1)
  };
  entities.push(wife, granny);

  // variksenpelätin — a scarecrow watching over the kasvimaa, at its near corner.
  entities.push({
    kind: 'scarecrow',
    wx: field.x0 + 0.3,
    wy: field.y1 + 0.4,
    facing: 1,
    seed: hashf(9.1, 6.6)
  });

  // A jetty into the lake for the son to fish from. Find the nearest shore to a
  // target point on the homestead side of the lake.
  const tgx = Math.round(width * 0.42);
  const tgy = Math.round(height * 0.46);
  let fish: { x: number; y: number; dx: number; dy: number } | null = null;
  let bestD = Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tt = tiles[y * width + x];
      if (tt.type !== 'grass' && tt.type !== 'sand') continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const n = get(x + dx, y + dy);
        if (n?.type === 'water') {
          const d = dist(x, y, tgx, tgy);
          if (d < bestD) {
            bestD = d;
            fish = { x, y, dx, dy };
          }
        }
      }
    }
  }
  if (fish) {
    entities.push({ kind: 'jetty', wx: fish.x, wy: fish.y, dx: fish.dx, dy: fish.dy });
    entities.push({
      kind: 'villager',
      role: 'son',
      wx: fish.x + fish.dx * 1.3,
      wy: fish.y + fish.dy * 1.3,
      facing: fish.dx - fish.dy >= 0 ? 1 : -1,
      seed: hashf(8.8, 4.2)
    });
  }

  // A shy deer lives out at the forest edge near the bog.
  const deer: Deer = {
    kind: 'deer',
    wx: width * 0.5,
    wy: height * 0.66,
    facing: -1,
    homeX: width * 0.5,
    homeY: height * 0.66,
    tx: width * 0.5,
    ty: height * 0.66,
    wait: 2,
    moving: false,
    seed: hashf(5.5, 1.1)
  };
  entities.push(deer);

  // Footprints that block movement, and clearance circles that keep the homestead
  // open (no trees/rocks growing through buildings, paddock, jetty, people).
  const solids: Solid[] = [
    ...houses.map((h) => ({ wx: h.wx, wy: h.wy, w: h.w, d: h.d })),
    { wx: barn.wx, wy: barn.wy, w: barn.w, d: barn.d },
    { wx: aitta.wx, wy: aitta.wy, w: aitta.w, d: aitta.d },
    { wx: well.wx, wy: well.wy, w: 1.1, d: 1.1 }
  ];
  const clear: { x: number; y: number; r: number }[] = [
    { x: player.wx, y: player.wy, r: 5 },
    { x: houses[0].wx, y: houses[0].wy, r: 3.4 },
    { x: houses[1].wx, y: houses[1].wy, r: 3 },
    { x: barn.wx, y: barn.wy, r: 3 },
    { x: aitta.wx, y: aitta.wy, r: 2.4 },
    { x: well.wx, y: well.wy, r: 2 },
    { x: cowHome.x, y: cowHome.y, r: 4.5 },
    { x: granny.wx, y: granny.wy, r: 1.6 },
    { x: fieldCx, y: (field.y0 + field.y1) / 2, r: 4.5 }
  ];
  if (fish) clear.push({ x: fish.x, y: fish.y, r: 3 });
  const inClear = (x: number, y: number): boolean => clear.some((c) => dist(x, y, c.x, c.y) < c.r);

  // Forest: dense, denser still toward the edges so the homestead sits in a clearing.
  // koivu (birch) lighter in the clearing, kuusi/mänty (spruce/pine) thick at the edges.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x];
      const onBog = t.type === 'bog';
      if (t.type !== 'grass' && !onBog) continue; // not on water/sand/path
      if (t.plank) continue;
      if (inClear(x, y)) continue;
      if (distToPath(x, y) < 2) continue; // keep the path open

      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      let density = onBog ? 0.05 : 0.5;
      if (edge < 13) density += (13 - edge) * 0.06;

      const clump = hashf(Math.floor(x / 3), Math.floor(y / 3));
      const n = hashf(x * 1.3 + 5, y * 1.7 + 9);
      if (n < density * (0.45 + clump)) {
        // Pick species. Edges & bog skew to conifers; the open clearing gets more birch.
        const r = hashf(x * 2.1 + 8, y * 1.9 + 2);
        let variant: 0 | 1 | 2;
        if (onBog) variant = r > 0.5 ? 2 : 1; // bog: scrubby spruce/pine
        else if (edge < 7) variant = r < 0.55 ? 2 : r < 0.82 ? 1 : 0; // dense edge
        else variant = r < 0.42 ? 0 : r < 0.72 ? 2 : 1; // mixed clearing
        entities.push({
          kind: 'tree',
          wx: x + (hashf(x, y) - 0.5) * 0.6,
          wy: y + (hashf(y, x) - 0.5) * 0.6,
          variant,
          seed: hashf(x * 3.1, y * 2.7),
          scale: (onBog ? 0.95 : 1.35) + hashf(x + 11, y + 4) * (onBog ? 0.4 : 0.85)
        });
      }
    }
  }

  // kalliot ja kivet — a few big mossy boulders plus scattered small stones.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x];
      if ((t.type !== 'grass' && t.type !== 'bog') || t.plank) continue;
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

  // Reeds along the sandy shore and around the bog edges.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y * width + x];
      const reedy =
        (t.type === 'sand' && hashf(x * 2.3 + 1, y * 2.9 + 4) > 0.55) ||
        (t.type === 'bog' && !t.plank && hashf(x * 2.1 + 6, y * 2.4 + 1) > 0.7);
      if (reedy) {
        entities.push({
          kind: 'reed',
          wx: x + (hashf(x, y) - 0.5) * 0.4,
          wy: y + (hashf(y, x) - 0.5) * 0.4,
          seed: hashf(x + 7, y + 2)
        });
      }
    }
  }

  return { width, height, tiles, entities, player, solids };
}
