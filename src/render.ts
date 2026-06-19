// All drawing. Hand-drawn canvas vector shapes for now. Mood we're chasing lives in
// ../inspiration: calm, muted, slightly *real* (Pentiment + kallio-lake-dusk), a
// continuous flowing landscape (NOT a visible diamond grid), and gentle, slow motion.

import { TILE_W, TILE_H, worldToScreen, hashf } from './iso';
import type {
  Aitta,
  Barn,
  Cow,
  Deer,
  Entity,
  Fence,
  GameState,
  House,
  Jetty,
  Player,
  Reed,
  Rock,
  Scarecrow,
  Tile,
  Tree,
  Villager,
  Well,
  World
} from './types';

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
type RGB = [number, number, number];

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

// ---- palette (muted, earthy, slightly dusky — pull saturation DOWN) ------
// Lightly muted overcast day — saturation pulled ~25% toward grey-green, still daytime.
const GRASS_LO: RGB = [88, 99, 67]; // smooth-blended across the ground, low contrast
const GRASS_HI: RGB = [107, 117, 80];
const MOSS: RGB = [102, 115, 72];
const SAND: RGB = [192, 180, 141];
const SAND_D: RGB = [176, 163, 124];
const WATER_LO: RGB = [80, 97, 106]; // dusky slate-blue
const WATER_HI: RGB = [94, 114, 123];
const BOG_LO: RGB = [130, 133, 94];
const BOG_HI: RGB = [145, 145, 102];
const BOG_POOL = '#566a64';
const PATH_LO: RGB = [142, 124, 92];
const PATH_HI: RGB = [156, 138, 106];
const PATH_D = '#766448';
const SOIL_LO: RGB = [78, 60, 43]; // tilled kasvimaa earth, dark and damp
const SOIL_HI: RGB = [98, 78, 56];
const INK = 'rgba(38,33,26,0.5)'; // soft dark outline for the hand-drawn feel

// ---- colour helpers ------------------------------------------------------
function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function css(c: RGB): string {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}
function mix(a: RGB, b: RGB, t: number): string {
  return css(mixRGB(a, b, t));
}

/** Smooth value noise (bilinear, smoothstep) — for continuous, non-tiled colour. */
function vnoise(x: number, y: number): number {
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

// =========================================================================
export function render(ctx: Ctx, state: GameState, vw: number, vh: number): void {
  const cam = worldToScreen(state.camera.x, state.camera.y);
  const ox = vw / 2 - cam.x;
  const oy = vh / 2 - cam.y;

  drawSky(ctx, vw, vh);
  drawTiles(ctx, state.world, ox, oy, vw, vh, state.time);
  drawEntities(ctx, state, ox, oy, vw, vh);
  drawAtmosphere(ctx, vw, vh, state.time);
}

// ---- small helpers -------------------------------------------------------
function fillEllipse(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(34,42,34,0.18)';
  fillEllipse(ctx, x, y, rx, ry);
}

function diamond(ctx: Ctx, sx: number, sy: number, grow = 0): void {
  const w = HALF_W + grow;
  const h = HALF_H + grow * 0.5;
  ctx.beginPath();
  ctx.moveTo(sx, sy - h);
  ctx.lineTo(sx + w, sy);
  ctx.lineTo(sx, sy + h);
  ctx.lineTo(sx - w, sy);
  ctx.closePath();
}

function poly(ctx: Ctx, pts: Pt[], fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

// ---- hand-drawn ink (Pentiment / Glimmerwick figures) --------------------
// Soft dark pen line for sprite silhouettes — NOT black, so the scene doesn't darken.
const INK_FIG = 'rgba(38,30,21,0.8)';
function inkPath(ctx: Ctx, w = 1.35): void {
  ctx.strokeStyle = INK_FIG;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}
/** poly() + an inked outline of the same shape. */
function polyInk(ctx: Ctx, pts: Pt[], fill: string, w = 1.35): void {
  poly(ctx, pts, fill);
  inkPath(ctx, w);
}
/** filled ellipse + an inked outline. */
function ellInk(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, w = 1.35): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), 0, 0, Math.PI * 2);
  ctx.fill();
  inkPath(ctx, w);
}

function tri(ctx: Ctx, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}

// ---- background ----------------------------------------------------------
function drawSky(ctx: Ctx, vw: number, vh: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, '#b4b8b2'); // soft, flat overcast — greyer, less green than before
  g.addColorStop(0.5, '#a7ab9f');
  g.addColorStop(1, '#949a86');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
}

// ---- ground tiles --------------------------------------------------------
// Tiles are over-drawn (grow) and coloured from SMOOTH world-space noise so adjacent
// tiles are nearly identical — the diamond grid dissolves into continuous ground.
function drawTiles(
  ctx: Ctx,
  world: World,
  ox: number,
  oy: number,
  vw: number,
  vh: number,
  time: number
): void {
  const { width, height, tiles } = world;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = (x - y) * HALF_W + ox;
      const sy = (x + y) * HALF_H + oy;
      if (sx < -TILE_W || sx > vw + TILE_W || sy < -TILE_H || sy > vh + TILE_H) continue;

      const t = tiles[y * width + x];
      switch (t.type) {
        case 'water':
          drawWaterTile(ctx, sx, sy, t, time, x, y);
          break;
        case 'sand':
          drawSandTile(ctx, sx, sy, t, x, y);
          break;
        case 'bog':
          drawBogTile(ctx, sx, sy, t, time, x, y);
          break;
        case 'path':
          drawPathTile(ctx, sx, sy, x, y);
          break;
        case 'field':
          drawFieldTile(ctx, sx, sy, t, time, x, y);
          break;
        default:
          drawGrassTile(ctx, sx, sy, x, y);
      }
    }
  }
}

function drawGrassTile(ctx: Ctx, sx: number, sy: number, x: number, y: number): void {
  // smooth, low-frequency colour — no per-tile checkerboard
  const n = vnoise(x * 0.16, y * 0.16);
  ctx.fillStyle = mix(GRASS_LO, GRASS_HI, n);
  diamond(ctx, sx, sy, 2);
  ctx.fill();

  // soft mossy clearings, decoupled from the grid (big, gentle)
  const m = vnoise(x * 0.22 + 11, y * 0.22 + 7);
  if (m > 0.7) {
    ctx.fillStyle = `rgba(${MOSS[0]},${MOSS[1]},${MOSS[2]},${((m - 0.7) * 0.9).toFixed(2)})`;
    fillEllipse(ctx, sx, sy, 22, 12);
  }

  // fine inked grass tufts (Pentiment-ish detail) — sparse, still
  if (hashf(x * 3.1, y * 3.7) > 0.86) {
    ctx.strokeStyle = 'rgba(54,64,40,0.5)';
    ctx.lineWidth = 1;
    const bx = sx + (hashf(x, y) - 0.5) * 18;
    const by = sy + (hashf(y, x) - 0.5) * 8;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(bx + i * 2.2, by);
      ctx.lineTo(bx + i * 2.2 + i * 1.2, by - 4);
      ctx.stroke();
    }
  }

  if (hashf(x * 2 + 0.5, y * 2 + 0.5) > 0.94) drawFlowers(ctx, sx, sy, x, y);
}

function drawFlowers(ctx: Ctx, sx: number, sy: number, x: number, y: number): void {
  const cols = ['#dcd9cb', '#cbb85a', '#a98fc0', '#8fb0c8']; // muted
  const n = 2 + Math.floor(hashf(x, y) * 3);
  for (let i = 0; i < n; i++) {
    const a = hashf(x + i, y * 1.7 + i);
    const b = hashf(x * 1.3 + i, y + i * 2);
    ctx.fillStyle = cols[Math.floor(a * cols.length) % cols.length];
    fillEllipse(ctx, sx + (a - 0.5) * 22, sy + (b - 0.5) * 11, 1.5, 1.5);
  }
}

function drawSandTile(ctx: Ctx, sx: number, sy: number, t: Tile, x: number, y: number): void {
  const n = vnoise(x * 0.18 + 30, y * 0.18 + 5); // smooth, not a per-tile checker
  ctx.fillStyle = mix(SAND_D, SAND, n);
  diamond(ctx, sx, sy, 2);
  ctx.fill();
  if (t.v > 0.85) {
    ctx.fillStyle = 'rgba(120,110,90,0.3)';
    fillEllipse(ctx, sx + 4, sy + 2, 2, 1.3);
  }
}

function drawBogTile(ctx: Ctx, sx: number, sy: number, t: Tile, time: number, x: number, y: number): void {
  const n = vnoise(x * 0.18 + 4, y * 0.18 + 9);
  ctx.fillStyle = mix(BOG_LO, BOG_HI, n);
  diamond(ctx, sx, sy, 2);
  ctx.fill();

  if (hashf(x * 3.1 + 2, y * 2.7) > 0.86) {
    // still, dark pool — a single very slow ripple
    ctx.fillStyle = BOG_POOL;
    fillEllipse(ctx, sx + (t.v - 0.5) * 12, sy + 2, 9, 5);
    ctx.strokeStyle = `rgba(200,214,210,${(0.08 + 0.03 * Math.sin(time * 0.5 + x)).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx + (t.v - 0.5) * 12, sy + 2, 6, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (hashf(x * 1.7, y * 1.9) > 0.6) {
    // a few tufts of marsh grass, barely swaying
    ctx.strokeStyle = t.v > 0.5 ? '#878b46' : '#73793c';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) {
      const bx = sx + (hashf(x + i, y) - 0.5) * 16;
      const by = sy + (hashf(x, y + i) - 0.5) * 7;
      const sway = Math.sin(time * 0.6 + i + x) * 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + sway, by - 5);
      ctx.stroke();
    }
  }

  if (t.plank) drawPlank(ctx, sx, sy);
}

/** pitkospuut — a weathered two-board boardwalk laid over the mire. */
function drawPlank(ctx: Ctx, sx: number, sy: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  poly(
    ctx,
    [
      { x: -HALF_W * 0.5, y: 1 },
      { x: 0, y: -HALF_H * 0.5 + 1 },
      { x: HALF_W * 0.5, y: 1 },
      { x: 0, y: HALF_H * 0.5 + 1 }
    ],
    '#938468'
  );
  ctx.strokeStyle = 'rgba(48,38,28,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-HALF_W * 0.36, 0.5);
  ctx.lineTo(HALF_W * 0.36, 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawPathTile(ctx: Ctx, sx: number, sy: number, x: number, y: number): void {
  const n = vnoise(x * 0.25 + 2, y * 0.25 + 5);
  ctx.fillStyle = mix(PATH_LO, PATH_HI, n);
  diamond(ctx, sx, sy, 2);
  ctx.fill();
  ctx.fillStyle = PATH_D;
  fillEllipse(ctx, sx + (n - 0.5) * 16, sy + (hashf(x, y) - 0.5) * 7, 6, 2.2);
  if (hashf(x * 4.1, y * 3.3) > 0.75) {
    ctx.fillStyle = '#857c70';
    fillEllipse(ctx, sx + (hashf(y, x) - 0.5) * 18, sy + 3, 1.7, 1.1);
  }
}

// kasvimaa — tilled vegetable patch: dark furrowed earth planted in rows of
// nauris/kaali (turnip/cabbage). See inspiration/medieval/maatila.jpg.
function drawFieldTile(ctx: Ctx, sx: number, sy: number, t: Tile, time: number, x: number, y: number): void {
  const n = vnoise(x * 0.2 + 14, y * 0.2 + 6);
  ctx.fillStyle = mix(SOIL_LO, SOIL_HI, n);
  diamond(ctx, sx, sy, 2);
  ctx.fill();

  // furrow ridges running along the world-x axis (screen dir (HALF_W, HALF_H)),
  // stacked along world-y — gives the ploughed-row look without a tile-grid feel.
  for (let r = -1; r <= 1; r++) {
    const d = r * 0.3;
    const ax = sx + (-0.5 - d) * HALF_W;
    const ay = sy + (-0.5 + d) * HALF_H;
    const bx = sx + (0.5 - d) * HALF_W;
    const by = sy + (0.5 + d) * HALF_H;
    ctx.strokeStyle = 'rgba(40,28,18,0.32)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,126,92,0.28)'; // lit crest just above the furrow
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 1.4);
    ctx.lineTo(bx, by - 1.4);
    ctx.stroke();
  }

  // two crop plants per tile, on the centre rows — read as continuous rows across tiles
  for (const ox of [-0.24, 0.24]) {
    if (hashf(x * 4.3 + ox * 7, y * 3.9) < 0.18) continue; // a few gaps in the rows
    const oy = ox > 0 ? 0.16 : -0.16;
    const px = sx + (ox - oy) * HALF_W;
    const py = sy + (ox + oy) * HALF_H;
    const seed = hashf(x * 5.1 + ox, y * 6.3);
    const sway = Math.sin(time * 0.5 + seed * 6.28 + x) * 0.5;
    drawCrop(ctx, px, py, 0.85 + seed * 0.45, seed, sway);
  }
}

// a single low leafy plant (turnip/cabbage), muted green with a paler heart
function drawCrop(ctx: Ctx, px: number, py: number, s: number, seed: number, sway: number): void {
  ctx.fillStyle = 'rgba(34,42,28,0.22)';
  fillEllipse(ctx, px, py + 1, 4.4 * s, 1.8 * s);
  const dark = '#48572f';
  const mid = seed > 0.78 ? '#84935a' : '#62733c'; // some turnip-pale tops
  const leaves: [number, number, number][] = [
    [-3.2, 0, 2.6],
    [3.2, 0, 2.6],
    [-1.4, -1.4, 2.4],
    [1.4, -1.4, 2.4],
    [0, -2.8, 2.2]
  ];
  ctx.fillStyle = dark;
  for (const [lx, ly, r] of leaves) fillEllipse(ctx, px + lx * s + sway, py + ly * s, r * s, r * 0.7 * s);
  ctx.fillStyle = mid;
  for (const [lx, ly, r] of leaves)
    fillEllipse(ctx, px + lx * s * 0.8 + sway, py + (ly - 0.6) * s, r * 0.6 * s, r * 0.45 * s);
}

function drawWaterTile(ctx: Ctx, sx: number, sy: number, t: Tile, time: number, x: number, y: number): void {
  // Continuous lake: keep every water tile NEARLY the same colour so the diamond facets
  // disappear. All variation is large-scale and smooth — a slow low-frequency tone plus a
  // gently drifting reflection sheen, both folded into the fill (no per-tile overlays that
  // would re-introduce a grid). Shore tiles lift only slightly (shallows).
  const n = vnoise(x * 0.12 + 20, y * 0.12 + 3); // base tone
  const sheen = vnoise(x * 0.08 + 40, y * 0.08 + time * 0.015 + 7); // slow drifting light
  ctx.fillStyle = mix(WATER_LO, WATER_HI, 0.16 + n * 0.12 + sheen * 0.16 + (t.shore ? 0.14 : 0));
  diamond(ctx, sx, sy, 1.6);
  ctx.fill();

  // a few slow, sparse glints — low alpha, only on scattered tiles, for a little life
  if (hashf(x, y) > 0.93) {
    const a = 0.05 + 0.035 * Math.sin(time * 0.45 + x * 0.3 + y);
    const yy = sy + Math.sin(time * 0.3 + x) * 1.2;
    ctx.strokeStyle = `rgba(200,216,214,${Math.max(0, a).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 12, yy);
    ctx.quadraticCurveTo(sx, yy + 2, sx + 12, yy);
    ctx.stroke();
  }

  if (t.shore) {
    // soft foam rim on the land-facing (upper) edges only
    ctx.strokeStyle = 'rgba(200,214,210,0.26)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx - HALF_W * 0.7, sy - 2);
    ctx.lineTo(sx, sy - HALF_H * 0.7);
    ctx.lineTo(sx + HALF_W * 0.7, sy - 2);
    ctx.stroke();
  }

  if (hashf(x, y) > 0.94) {
    ctx.fillStyle = '#5a6a4c';
    fillEllipse(ctx, sx + 6, sy + 3, 5, 3);
    ctx.fillStyle = '#67755a';
    fillEllipse(ctx, sx + 6, sy + 3, 3.1, 1.7);
  }
}

// ---- entities ------------------------------------------------------------
function drawEntities(ctx: Ctx, state: GameState, ox: number, oy: number, vw: number, vh: number): void {
  const list: Entity[] = state.world.entities.slice();
  list.push(state.player);
  list.sort((a, b) => a.wx + a.wy - (b.wx + b.wy)); // painter's algorithm by depth

  for (const e of list) {
    const sx = (e.wx - e.wy) * HALF_W + ox;
    const sy = (e.wx + e.wy) * HALF_H + oy;
    if (sx < -160 || sx > vw + 160 || sy < -60 || sy > vh + 220) continue;

    switch (e.kind) {
      case 'tree':
        if (e.variant === 0) drawBirch(ctx, sx, sy, e, state.time);
        else if (e.variant === 1) drawPine(ctx, sx, sy, e, state.time);
        else drawSpruce(ctx, sx, sy, e, state.time);
        break;
      case 'house':
        drawHouse(ctx, sx, sy, e, state.time);
        break;
      case 'barn':
        drawBarn(ctx, sx, sy, e);
        break;
      case 'aitta':
        drawAitta(ctx, sx, sy, e);
        break;
      case 'well':
        drawWell(ctx, sx, sy, e);
        break;
      case 'fence':
        drawFence(ctx, sx, sy, e);
        break;
      case 'scarecrow':
        drawScarecrow(ctx, sx, sy, e, state.time);
        break;
      case 'jetty':
        drawJetty(ctx, sx, sy, e);
        break;
      case 'villager':
        drawVillager(ctx, sx, sy, e, state.time);
        break;
      case 'cow':
        drawCow(ctx, sx, sy, e);
        break;
      case 'deer':
        drawDeer(ctx, sx, sy, e);
        break;
      case 'rock':
        drawRock(ctx, sx, sy, e);
        break;
      case 'reed':
        drawReed(ctx, sx, sy, e, state.time);
        break;
      case 'player':
        drawPlayer(ctx, sx, sy, e);
        break;
    }
  }
}

// koivu — birch: white papery trunk that forks, airy crown (some autumn-gold). Barely sways.
function drawBirch(ctx: Ctx, sx: number, sy: number, e: Tree, time: number): void {
  const s = e.scale;
  shadow(ctx, sx, sy, 12 * s, 4.6 * s);
  const sway = Math.sin(time * 0.45 + e.seed * 6.28) * 0.7 * s;
  const topY = sy - 42 * s;

  // slender white trunk + shaded side
  poly(
    ctx,
    [
      { x: sx - 2.1 * s, y: sy },
      { x: sx + 2.1 * s, y: sy },
      { x: sx + 1.1 * s + sway, y: topY },
      { x: sx - 1.1 * s + sway, y: topY }
    ],
    '#e4e3d9'
  );
  poly(
    ctx,
    [
      { x: sx + 0.5 * s, y: sy },
      { x: sx + 2.1 * s, y: sy },
      { x: sx + 1.1 * s + sway, y: topY },
      { x: sx + 0.1 * s + sway, y: topY }
    ],
    '#c6c5b8'
  );
  // forking branches reaching into the crown
  ctx.strokeStyle = '#d3d2c5';
  ctx.lineWidth = 1.1 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx + sway, sy - 34 * s);
  ctx.lineTo(sx - 5.5 * s + sway, sy - 45 * s);
  ctx.moveTo(sx + sway, sy - 36 * s);
  ctx.lineTo(sx + 5.5 * s + sway, sy - 46 * s);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // dark bark flecks
  ctx.fillStyle = '#2c2922';
  for (let i = 0; i < 6; i++) {
    const yy = sy - 6 * s - i * 6.2 * s;
    ctx.fillRect(sx - 1.9 * s + sway * (i / 8), yy, 2.3 * s, 1 * s);
  }

  // crown — airy, layered; some birches turn autumn-gold
  const autumn = e.seed > 0.72 ? Math.min(1, (e.seed - 0.72) / 0.28) : 0;
  const mid = mixRGB([105, 121, 81], [171, 148, 83], autumn * 0.85);
  const dark = mixRGB(mid, [34, 44, 28], 0.42);
  const light = mixRGB(mid, [157, 176, 124], 0.5);
  const cx = sx + sway;
  const cy = sy - 51 * s;
  const blobs: [number, number, number][] = [
    [0, 7, 11],
    [-9, 9, 7],
    [9, 9, 7],
    [-6, 1, 9],
    [6, 2, 9],
    [0, -5, 9],
    [-3, -11, 6],
    [4, -10, 6]
  ];
  ctx.fillStyle = css(dark);
  for (const [bx, by, r] of blobs) {
    const rr = r * (0.85 + hashf(e.seed * 9 + bx, by) * 0.3);
    fillEllipse(ctx, cx + bx * s, cy + (by + 2) * s, rr * s, rr * 0.8 * s);
  }
  ctx.fillStyle = css(mid);
  for (const [bx, by, r] of blobs) {
    const rr = r * (0.8 + hashf(e.seed * 5 + by, bx) * 0.3);
    fillEllipse(ctx, cx + bx * s, cy + by * s, rr * 0.92 * s, rr * 0.72 * s);
  }
  ctx.fillStyle = css(light);
  fillEllipse(ctx, cx - 4 * s, cy - 5 * s, 5 * s, 4 * s);
  fillEllipse(ctx, cx + 2 * s, cy - 8 * s, 3.4 * s, 2.8 * s);
}

// mänty — Scots pine: tall reddish bark trunk, stubby lower branches, rounded crown up top.
function drawPine(ctx: Ctx, sx: number, sy: number, e: Tree, time: number): void {
  const s = e.scale;
  shadow(ctx, sx, sy, 11 * s, 4.6 * s);
  const sway = Math.sin(time * 0.4 + e.seed * 6.28) * 0.6 * s;
  const topY = sy - 56 * s;

  // trunk with lit edge + shaded edge
  poly(
    ctx,
    [
      { x: sx - 2.4 * s, y: sy },
      { x: sx + 2.4 * s, y: sy },
      { x: sx + 1.2 * s + sway, y: topY },
      { x: sx - 1.2 * s + sway, y: topY }
    ],
    '#7c543a'
  );
  ctx.fillStyle = '#90644777';
  ctx.fillRect(sx - 2.1 * s, sy - 53 * s, 1.4 * s, 53 * s);
  ctx.fillStyle = 'rgba(42,26,16,0.45)';
  ctx.fillRect(sx + 0.9 * s, sy - 53 * s, 1.2 * s, 53 * s);
  // a couple of stubby bare branches
  ctx.strokeStyle = '#5f4230';
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  ctx.moveTo(sx - 1 * s, sy - 32 * s);
  ctx.lineTo(sx - 6 * s, sy - 36 * s);
  ctx.moveTo(sx + 1 * s, sy - 42 * s);
  ctx.lineTo(sx + 6 * s, sy - 46 * s);
  ctx.stroke();

  // rounded crown clumps high up, slightly blue-green, per-tree variation
  const base = mixRGB([62, 84, 60], [82, 104, 70], hashf(e.seed, 1));
  const dark = mixRGB(base, [30, 46, 34], 0.45);
  const light = mixRGB(base, [122, 141, 101], 0.5);
  const cx = sx + sway;
  const cy = sy - 62 * s;
  const clumps: [number, number, number][] = [
    [0, 3, 11],
    [-9, 6, 8],
    [9, 5, 8],
    [-4, -5, 9],
    [6, -4, 8],
    [1, -11, 7]
  ];
  ctx.fillStyle = css(dark);
  for (const [bx, by, r] of clumps) {
    const rr = r * (0.85 + hashf(e.seed * 4 + bx, by) * 0.28);
    fillEllipse(ctx, cx + bx * s, cy + (by + 2) * s, rr * s, rr * 0.78 * s);
  }
  ctx.fillStyle = css(base);
  for (const [bx, by, r] of clumps) fillEllipse(ctx, cx + bx * s, cy + by * s, r * 0.9 * s, r * 0.68 * s);
  ctx.fillStyle = css(light);
  fillEllipse(ctx, cx - 3 * s, cy - 5 * s, 5 * s, 3.4 * s);
  fillEllipse(ctx, cx + 3 * s, cy - 7 * s, 3 * s, 2.2 * s);
}

// kuusi — Norway spruce: dark, narrow, with drooping scalloped branch tiers.
function spruceTier(ctx: Ctx, cx: number, baseY: number, w: number, h: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx, baseY - h); // apex
  ctx.lineTo(cx - w, baseY + h * 0.16); // left drooping tip
  ctx.lineTo(cx - w * 0.5, baseY - h * 0.06);
  ctx.lineTo(cx - w * 0.24, baseY + h * 0.2);
  ctx.lineTo(cx, baseY + h * 0.02);
  ctx.lineTo(cx + w * 0.24, baseY + h * 0.2);
  ctx.lineTo(cx + w * 0.5, baseY - h * 0.06);
  ctx.lineTo(cx + w, baseY + h * 0.16); // right drooping tip
  ctx.closePath();
  ctx.fill();
}

function drawSpruce(ctx: Ctx, sx: number, sy: number, e: Tree, time: number): void {
  const s = e.scale;
  shadow(ctx, sx, sy, 10 * s, 4.4 * s);
  ctx.fillStyle = '#43321f';
  ctx.fillRect(sx - 1.4 * s, sy - 6 * s, 2.8 * s, 6 * s);

  const sway = Math.sin(time * 0.4 + e.seed * 6.28) * 0.5 * s;
  const base = mixRGB([42, 64, 46], [54, 80, 56], hashf(e.seed, 3));
  const dark = css(mixRGB(base, [22, 38, 30], 0.5));
  const lit = css(mixRGB(base, [96, 124, 82], 0.5));

  const N = 7;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1); // 0 = bottom, 1 = top
    const baseY = sy + (-3 - 52 * f) * s;
    const cx = sx + sway * (i + 1) * 0.55 + (hashf(e.seed + i, i * 2) - 0.5) * 1.4 * s;
    const w = (13 - 9 * f) * s * (0.9 + hashf(e.seed * 7 + i, i) * 0.18);
    const h = (12.5 - 3.5 * f) * s;
    spruceTier(ctx, cx, baseY, w, h, dark); // full dark tier
    spruceTier(ctx, cx, baseY - 0.8 * s, w * 0.74, h * 0.92, lit); // lit inner needles
  }
  // tiny pale tip catching light
  ctx.fillStyle = lit;
  fillEllipse(ctx, sx + sway * 3, sy - 58 * s, 1.6 * s, 2.4 * s);
}

// kallio / kivi — lichen-grey bedrock outcrop with a mossy, heather-topped crown,
// or a small stone. See inspiration/finnish-nature/kallio-*.
function drawRock(ctx: Ctx, sx: number, sy: number, e: Rock): void {
  const s = e.scale;
  if (e.boulder) {
    // a low, wide bedrock slab
    shadow(ctx, sx, sy, 16 * s, 6 * s);
    ctx.fillStyle = '#8f9088';
    ctx.beginPath();
    ctx.moveTo(sx - 15 * s, sy + 1);
    ctx.quadraticCurveTo(sx - 16 * s, sy - 7 * s, sx - 6 * s, sy - 9 * s);
    ctx.quadraticCurveTo(sx + 4 * s, sy - 11 * s, sx + 12 * s, sy - 7 * s);
    ctx.quadraticCurveTo(sx + 16 * s, sy - 3 * s, sx + 14 * s, sy + 1);
    ctx.quadraticCurveTo(sx, sy + 5 * s, sx - 15 * s, sy + 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    // bedrock seams + lit face
    ctx.fillStyle = '#a3a49b';
    fillEllipse(ctx, sx - 4 * s, sy - 5 * s, 8 * s, 3 * s);
    ctx.strokeStyle = 'rgba(70,72,66,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 11 * s, sy - 2 * s);
    ctx.lineTo(sx + 9 * s, sy - 4 * s);
    ctx.moveTo(sx - 5 * s, sy);
    ctx.lineTo(sx + 11 * s, sy - 2 * s);
    ctx.stroke();
    // mossy, heather-topped crown
    ctx.fillStyle = '#5f7438';
    fillEllipse(ctx, sx - 2 * s, sy - 9 * s, 11 * s, 3.4 * s);
    ctx.fillStyle = 'rgba(120,140,76,0.6)';
    fillEllipse(ctx, sx - 5 * s, sy - 9.5 * s, 5 * s, 1.8 * s);
    ctx.fillStyle = '#8a6f86'; // heather
    for (let i = 0; i < 4; i++) {
      const a = hashf(e.seed * 12 + i, i);
      fillEllipse(ctx, sx + (a - 0.5) * 18 * s, sy - 10 * s - a * 1.5 * s, 1.4 * s, 1 * s);
    }
  } else {
    // small glacier-rounded stone
    shadow(ctx, sx, sy, 9 * s, 4 * s);
    ctx.fillStyle = '#8d8d85';
    ctx.beginPath();
    ctx.moveTo(sx - 8 * s, sy);
    ctx.quadraticCurveTo(sx - 9 * s, sy - 7 * s, sx - 2 * s, sy - 8 * s);
    ctx.quadraticCurveTo(sx + 7 * s, sy - 9 * s, sx + 9 * s, sy - 2 * s);
    ctx.quadraticCurveTo(sx + 9 * s, sy + 2 * s, sx, sy + 3 * s);
    ctx.quadraticCurveTo(sx - 7 * s, sy + 3 * s, sx - 8 * s, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#a09f97';
    fillEllipse(ctx, sx - 2 * s, sy - 4 * s, 4 * s, 2.4 * s);
    if (e.seed > 0.55) {
      ctx.fillStyle = 'rgba(96,116,56,0.7)';
      fillEllipse(ctx, sx - s, sy - 6 * s, 5 * s, 2 * s);
    }
  }
}

function drawReed(ctx: Ctx, sx: number, sy: number, e: Reed, time: number): void {
  const n = 5 + Math.floor(e.seed * 4);
  for (let i = 0; i < n; i++) {
    const a = hashf(e.seed * 10 + i, e.seed + i * 2);
    const bx = sx + (a - 0.5) * 12;
    const hgt = 10 + a * 9;
    const sway = Math.sin(time * 0.7 + i + e.seed * 6) * 0.8;
    ctx.strokeStyle = a > 0.5 ? '#677f48' : '#586e3d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, sy);
    ctx.quadraticCurveTo(bx + sway * 0.5, sy - hgt * 0.6, bx + sway, sy - hgt);
    ctx.stroke();
    if (a > 0.6) {
      ctx.fillStyle = '#735636';
      fillEllipse(ctx, bx + sway, sy - hgt, 1.5, 3.2);
    }
  }
}

function drawCow(ctx: Ctx, sx: number, sy: number, c: Cow): void {
  shadow(ctx, sx, sy, 13, 5);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(c.facing < 0 ? -1 : 1, 1);

  ctx.fillStyle = '#3f372d';
  for (const lx of [-7, -3, 4, 8]) ctx.fillRect(lx, -7, 2.4, 7);
  ellInk(ctx, 0, -12, 12, 7, '#e3ddd0'); // body, inked
  ctx.fillStyle = '#473d31';
  fillEllipse(ctx, -3, -13, 3.5, 2.6);
  fillEllipse(ctx, 5, -10, 2.6, 2);
  ellInk(ctx, 11, -15, 4.5, 4, '#e3ddd0'); // head, inked
  ctx.fillStyle = '#bd9c85';
  fillEllipse(ctx, 14, -14, 2.4, 2);
  ctx.fillStyle = '#473d31';
  fillEllipse(ctx, 8, -19, 2, 1.4);
  ctx.restore();
}

// peura — a slender, tawny forest deer.
function drawDeer(ctx: Ctx, sx: number, sy: number, d: Deer): void {
  shadow(ctx, sx, sy, 11, 4.5);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(d.facing < 0 ? -1 : 1, 1);

  ctx.strokeStyle = '#574027';
  ctx.lineWidth = 1.8;
  for (const lx of [-6, -2, 4, 7]) {
    ctx.beginPath();
    ctx.moveTo(lx, -9);
    ctx.lineTo(lx + 0.5, 0);
    ctx.stroke();
  }
  ellInk(ctx, 0, -13, 9, 5, '#946841'); // body, inked
  ctx.fillStyle = '#a0744a';
  fillEllipse(ctx, -6, -13, 4, 4.2);
  fillEllipse(ctx, 6, -13, 3.6, 4);
  polyInk(
    ctx,
    [
      { x: 6, y: -15 },
      { x: 11, y: -24 },
      { x: 13, y: -23 },
      { x: 9, y: -14 }
    ],
    '#a0744a'
  ); // neck, inked
  ellInk(ctx, 13, -25, 3, 2.4, '#a0744a'); // head, inked
  ctx.fillStyle = '#76542f';
  fillEllipse(ctx, 15, -25, 1.6, 1.3);
  ctx.strokeStyle = '#684a2e';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(12, -27);
  ctx.lineTo(11, -31);
  ctx.moveTo(13, -27);
  ctx.lineTo(15, -31);
  ctx.stroke();
  ctx.fillStyle = '#83603c';
  fillEllipse(ctx, 11, -27, 1.4, 2);
  ctx.fillStyle = '#e2d8c9';
  fillEllipse(ctx, -8, -13, 1.8, 2.4);
  ctx.restore();
}

// The playable villager — a medieval Finnish wanderer in a belted wool tunic and
// shoulder cloak, felt hat, leather boots, walking staff. Drawn back-to-front with
// two-tone shading and a leg/arm swing. faceY<0 = walking away (back view).
const SKIN = '#d8a982';
const SKIN_SH = '#bf8e6a';
const HAIR = '#43331f';
const TUNIC = '#94604a';
const TUNIC_SH = '#774535';
const TUNIC_HI = '#a87159';
const CLOAK = '#586146';
const CLOAK_SH = '#454d37';
const LEG = '#4a4137';
const LEG_SH = '#3a322a';
const BOOT = '#33251a';
const BELT = '#382819';
const HAT = '#463524';
const HAT_SH = '#33261a';
const STAFF = '#6f5436';

function leg(ctx: Ctx, cx: number, footDx: number, col: string): void {
  polyInk(
    ctx,
    [
      { x: cx - 2.2, y: -14 },
      { x: cx + 2.2, y: -14 },
      { x: cx + 1.6 + footDx, y: -4 },
      { x: cx - 1.8 + footDx, y: -4 }
    ],
    col
  );
  // boot
  ctx.fillStyle = BOOT;
  ctx.beginPath();
  ctx.moveTo(cx - 2 + footDx, -4.5);
  ctx.lineTo(cx + 2 + footDx, -4.5);
  ctx.lineTo(cx + 3.6 + footDx, -0.6);
  ctx.quadraticCurveTo(cx + 3.6 + footDx, 0.7, cx + 2.2 + footDx, 0.7);
  ctx.lineTo(cx - 2.2 + footDx, 0.7);
  ctx.closePath();
  ctx.fill();
  inkPath(ctx);
}

function arm(ctx: Ctx, shX: number, handDx: number, col: string): void {
  polyInk(
    ctx,
    [
      { x: shX - 2, y: -24 },
      { x: shX + 2, y: -24 },
      { x: shX + 1.8 + handDx, y: -15 },
      { x: shX - 1.8 + handDx, y: -15 }
    ],
    col
  );
  ellInk(ctx, shX + handDx, -14.5, 1.7, 1.7, SKIN);
}

function drawPlayer(ctx: Ctx, sx: number, sy: number, p: Player): void {
  const S = 1.3;
  shadow(ctx, sx, sy, 8 * S, 3.4 * S);
  const flip = p.faceX < 0 ? -1 : 1;
  const back = p.faceY < 0; // walking away from camera
  const t = p.moving ? p.anim * 8.5 : 0;
  const sw = p.moving ? Math.sin(t) : 0; // limb swing
  const bob = p.moving ? Math.abs(Math.sin(t)) * 1.3 : 0;

  ctx.save();
  ctx.translate(sx, sy - bob);
  ctx.scale(flip * S, S);

  // far (back) leg + arm — drawn first, in shade
  leg(ctx, -2.4, -sw * 2.2, LEG_SH);
  if (!back) arm(ctx, -4.6, -sw * 2.6, TUNIC_SH);

  // cloak hanging from the shoulders (full at the back, a mantle from the front)
  if (back) {
    polyInk(
      ctx,
      [
        { x: -6.5, y: -24 },
        { x: 6.5, y: -24 },
        { x: 5.5, y: -10 },
        { x: -5.5, y: -10 }
      ],
      CLOAK
    );
    ctx.strokeStyle = CLOAK_SH;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(0, -10.5);
    ctx.stroke();
  } else {
    polyInk(
      ctx,
      [
        { x: -6, y: -24 },
        { x: 6, y: -24 },
        { x: 7, y: -17 },
        { x: -7, y: -17 }
      ],
      CLOAK_SH
    );
  }

  // near leg (front)
  leg(ctx, 2.4, sw * 2.2, LEG);

  // belted wool tunic (flared skirt), with a shaded side and lit edge
  polyInk(
    ctx,
    [
      { x: -5.5, y: -23 },
      { x: 5.5, y: -23 },
      { x: 7, y: -12 },
      { x: -7, y: -12 }
    ],
    back ? CLOAK : TUNIC
  );
  if (!back) {
    poly(
      ctx,
      [
        { x: 1, y: -23 },
        { x: 5.5, y: -23 },
        { x: 7, y: -12 },
        { x: 1, y: -12 }
      ],
      TUNIC_SH
    );
    // lit front fold
    ctx.fillStyle = TUNIC_HI;
    poly(
      ctx,
      [
        { x: -4.5, y: -22 },
        { x: -2.5, y: -22 },
        { x: -3.5, y: -12.5 },
        { x: -5.5, y: -12.5 }
      ],
      TUNIC_HI
    );
    // belt + buckle
    ctx.fillStyle = BELT;
    ctx.fillRect(-6.2, -16.5, 12.4, 1.8);
    ctx.fillStyle = '#b7995b';
    ctx.fillRect(-0.9, -16.7, 1.8, 2.2);
    // cream collar
    ctx.fillStyle = '#cdc3a6';
    poly(
      ctx,
      [
        { x: -2.4, y: -23.5 },
        { x: 2.4, y: -23.5 },
        { x: 1.4, y: -21.5 },
        { x: -1.4, y: -21.5 }
      ],
      '#cdc3a6'
    );
  }

  // near (front) arm
  if (!back) arm(ctx, 4.6, sw * 2.6, TUNIC);
  else arm(ctx, 4.6, sw * 2.6, CLOAK_SH);

  // neck + head
  ctx.fillStyle = SKIN_SH;
  ctx.fillRect(-1.6, -26.5, 3.2, 3);
  ellInk(ctx, 0, -29.5, 4.4, 4.6, back ? HAIR : SKIN);
  if (!back) {
    // hair fringe + face hint
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.ellipse(0, -31.4, 4.4, 3, 0, Math.PI, 0);
    ctx.fill();
    fillEllipse(ctx, -4, -29.5, 1.4, 2.6); // sideburn
    ctx.fillStyle = '#5b4632';
    fillEllipse(ctx, -1.4, -29.3, 0.7, 0.9); // eyes
    fillEllipse(ctx, 1.6, -29.3, 0.7, 0.9);
    ctx.fillStyle = SKIN_SH;
    fillEllipse(ctx, 0.3, -28.2, 0.9, 0.7); // nose
    // short beard
    ctx.fillStyle = HAIR;
    fillEllipse(ctx, 0, -26.6, 3, 1.6);
  } else {
    ctx.fillStyle = HAIR;
    fillEllipse(ctx, 0, -28.6, 4.4, 3.6); // hair from behind
  }

  // soft felt hat — crown + brim + band, inked
  ctx.fillStyle = HAT;
  ctx.beginPath();
  ctx.moveTo(-4.2, -33.4);
  ctx.quadraticCurveTo(-3.6, -38, 0, -38.2);
  ctx.quadraticCurveTo(3.6, -38, 4.2, -33.4);
  ctx.closePath();
  ctx.fill();
  inkPath(ctx);
  ctx.fillStyle = HAT_SH;
  fillEllipse(ctx, 0.4, -32.4, 8.2, 2.8); // brim (shaded underside)
  ellInk(ctx, 0, -33, 7.8, 2.4, HAT); // brim top, inked
  ctx.fillStyle = HAT_SH;
  ctx.fillRect(-4, -34, 8, 1); // band

  // walking staff in the front hand
  if (!back) {
    const hx = 4.6 + sw * 2.6;
    ctx.strokeStyle = STAFF;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + 1.4, -14.5);
    ctx.lineTo(hx + 2.6, 1);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  ctx.restore();
}

// ---- family villagers ----------------------------------------------------
function drawVillager(ctx: Ctx, sx: number, sy: number, v: Villager, time: number): void {
  if (v.role === 'wife') drawWife(ctx, sx, sy, v, time);
  else if (v.role === 'granny') drawGranny(ctx, sx, sy, v, time);
  else drawSon(ctx, sx, sy, v, time);
}

function stool(ctx: Ctx): void {
  ctx.fillStyle = '#6e5436';
  ctx.fillRect(-3.6, -3, 7.2, 1.5);
  ctx.fillStyle = '#553f27';
  ctx.fillRect(-3, -1.6, 1.2, 1.9);
  ctx.fillRect(1.8, -1.6, 1.2, 1.9);
}

// vaimo — the wife, sitting on a stool milking the cow.
function drawWife(ctx: Ctx, sx: number, sy: number, v: Villager, time: number): void {
  shadow(ctx, sx, sy, 7, 3);
  const m = Math.sin(time * 3 + v.seed * 6) * 1.1; // milking hands
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(v.facing < 0 ? -1 : 1, 1);

  stool(ctx);
  // wooden pail (toward the cow)
  poly(ctx, [{ x: 5, y: -3.6 }, { x: 8.6, y: -3.6 }, { x: 8, y: 0 }, { x: 5.6, y: 0 }], '#7c6038');
  ctx.strokeStyle = '#4e3a22';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(5, -2.3);
  ctx.lineTo(8.6, -2.3);
  ctx.stroke();

  // long dress + apron, torso leaning toward the cow
  polyInk(ctx, [{ x: -5, y: -3 }, { x: 5, y: -3 }, { x: 6, y: -13 }, { x: -4, y: -13 }], '#566a78');
  poly(ctx, [{ x: -2.5, y: -3.5 }, { x: 3, y: -3.5 }, { x: 3.2, y: -12 }, { x: -2, y: -12 }], '#cdc3a6');
  poly(ctx, [{ x: -3.5, y: -12 }, { x: 3.5, y: -12 }, { x: 5, y: -20 }, { x: 0, y: -21 }], '#4d5f6c');

  // arms reaching down to the udder, animating
  ctx.strokeStyle = '#4d5f6c';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2.5, -18);
  ctx.lineTo(6.5, -8 + m);
  ctx.moveTo(2.5, -17);
  ctx.lineTo(7, -6 - m);
  ctx.stroke();
  ctx.fillStyle = SKIN;
  fillEllipse(ctx, 6.6, -8 + m, 1.3, 1.3);
  fillEllipse(ctx, 7.1, -6 - m, 1.3, 1.3);
  ctx.lineCap = 'butt';

  // head with a headscarf (huivi)
  const hx = 2.5;
  const hy = -23;
  ellInk(ctx, hx, hy - 0.6, 3.9, 3.9, '#d8cdb8'); // headscarf, inked
  ctx.fillStyle = SKIN;
  fillEllipse(ctx, hx + 1, hy + 0.7, 2.5, 2.8);
  ctx.fillStyle = '#cfc3ac';
  fillEllipse(ctx, hx - 3, hy - 0.2, 1.5, 1.7); // knot
  ctx.restore();
}

// mummo — the grandmother, knitting on a stool.
function drawGranny(ctx: Ctx, sx: number, sy: number, v: Villager, time: number): void {
  shadow(ctx, sx, sy, 7, 3);
  const k = Math.sin(time * 4 + v.seed * 6) * 0.7; // needle motion
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(v.facing < 0 ? -1 : 1, 1);

  stool(ctx);
  // dark skirt + grey shawl
  polyInk(ctx, [{ x: -5, y: -3 }, { x: 5, y: -3 }, { x: 5.5, y: -13 }, { x: -4.5, y: -13 }], '#46413a');
  polyInk(ctx, [{ x: -4, y: -12 }, { x: 4, y: -12 }, { x: 4.5, y: -21 }, { x: -3.5, y: -21 }], '#8d8a82');
  poly(ctx, [{ x: -4, y: -12 }, { x: -1, y: -12 }, { x: -2.5, y: -20 }, { x: -3.5, y: -20 }], '#9d9a92');

  // ball of yarn at her feet, thread up to the work
  ctx.fillStyle = '#9a6f6f';
  fillEllipse(ctx, 4.5, -1.6, 1.8, 1.6);
  ctx.strokeStyle = '#b58a8a';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(4.5, -2.6);
  ctx.lineTo(2.6, -12.5 + k);
  ctx.stroke();

  // arms + knitting needles
  ctx.strokeStyle = '#8d8a82';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1, -17);
  ctx.lineTo(2, -13 + k);
  ctx.moveTo(1, -17);
  ctx.lineTo(3, -12.5 - k * 0.5);
  ctx.stroke();
  ctx.fillStyle = SKIN;
  fillEllipse(ctx, 2.4, -12.7 + k, 1.2, 1.2);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#cdbf9a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0.5, -14);
  ctx.lineTo(4, -11 + k);
  ctx.moveTo(1.5, -14.5);
  ctx.lineTo(5, -12 - k);
  ctx.stroke();

  // head: grey hair in a bun, small face
  const hy = -23.5;
  ellInk(ctx, 0, hy, 3.2, 3.4, SKIN); // head, inked
  ctx.fillStyle = '#d6d3ca';
  ctx.beginPath();
  ctx.ellipse(0, hy - 1.3, 3.3, 2.6, 0, Math.PI, 0);
  ctx.fill();
  fillEllipse(ctx, -3, hy - 1.4, 1.6, 1.6); // bun
  ctx.fillStyle = '#5b4632';
  fillEllipse(ctx, 1.3, hy + 0.2, 0.6, 0.7);
  ctx.restore();
}

// poika — the son, fishing from the jetty with a rod and a bobbing float.
function drawSon(ctx: Ctx, sx: number, sy: number, v: Villager, time: number): void {
  shadow(ctx, sx, sy, 5, 2.4);
  const S = 0.82;
  const bob = Math.sin(time * 1.4 + v.seed * 6) * 1; // float bobbing
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale((v.facing < 0 ? -1 : 1) * S, S);

  ctx.fillStyle = '#46443c';
  ctx.fillRect(-3, -7, 2.4, 7);
  ctx.fillRect(0.6, -7, 2.4, 7);
  ctx.fillStyle = '#2f2218';
  ctx.fillRect(-3.3, -1, 3, 1.4);
  ctx.fillRect(0.3, -1, 3, 1.4);

  polyInk(ctx, [{ x: -4, y: -8 }, { x: 4, y: -8 }, { x: 3, y: -19 }, { x: -3, y: -19 }], '#7c6a44');
  poly(ctx, [{ x: 0.5, y: -8 }, { x: 4, y: -8 }, { x: 3, y: -19 }, { x: 0.5, y: -19 }], '#6a5938');

  // arm holding the rod
  ctx.strokeStyle = '#7c6a44';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, -18);
  ctx.lineTo(5, -13);
  ctx.stroke();
  ctx.fillStyle = SKIN;
  fillEllipse(ctx, 5, -12.6, 1.2, 1.2);
  ctx.lineCap = 'butt';

  // head + cap
  ellInk(ctx, 0, -22, 3.1, 3.3, SKIN); // head, inked
  ctx.fillStyle = '#5a4326';
  ctx.beginPath();
  ctx.ellipse(0, -23.3, 3.2, 2.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#4a5a4a';
  ctx.beginPath();
  ctx.ellipse(0, -23.8, 3.3, 1.8, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-3.5, -23.9, 3.6, 0.8);

  // rod, line, and a red-and-white float on the water
  ctx.strokeStyle = '#6e5436';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(5, -13);
  ctx.lineTo(15, -20);
  ctx.stroke();
  const bx = 18.5;
  const by = -1 + bob;
  ctx.strokeStyle = 'rgba(240,240,235,0.7)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(15, -20);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.fillStyle = '#c0503e';
  fillEllipse(ctx, bx, by, 1.6, 1.6);
  ctx.fillStyle = '#e9e4d8';
  fillEllipse(ctx, bx, by + 0.7, 1.6, 0.8);
  ctx.restore();
}

// ---- navetta (cowshed) ---------------------------------------------------
function drawBarn(ctx: Ctx, sx: number, sy: number, b: Barn): void {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const wallH = 20 + b.seed * 4;
  const roofH = 15;
  const eave = 0.4;
  const cor = (dx: number, dy: number, hh = 0): Pt => ({
    x: sx + (dx - dy) * HALF_W,
    y: sy + (dx + dy) * HALF_H - hh
  });
  const B = cor(-hw, -hd);
  const R = cor(hw, -hd);
  const F = cor(hw, hd);
  const L = cor(-hw, hd);
  const Lt = cor(-hw, hd, wallH);
  const Ft = cor(hw, hd, wallH);
  const Rt = cor(hw, -hd, wallH);

  poly(
    ctx,
    [
      { x: B.x + 5, y: B.y + 3 },
      { x: R.x + 6, y: R.y + 3 },
      { x: F.x + 5, y: F.y + 6 },
      { x: L.x - 2, y: L.y + 5 }
    ],
    'rgba(34,42,34,0.2)'
  );
  poly(ctx, [L, F, Ft, Lt], '#7a6c57');
  poly(ctx, [F, R, Rt, Ft], '#5f5443');
  drawLogLines(ctx, L, F, Lt);
  drawLogLines(ctx, F, R, Ft);

  // big dark cattle doorway on the lit wall
  const along = { x: F.x - L.x, y: F.y - L.y };
  const up = { x: Lt.x - L.x, y: Lt.y - L.y };
  const fp = (a: number, bb: number): Pt => ({
    x: L.x + along.x * a + up.x * bb,
    y: L.y + along.y * a + up.y * bb
  });
  poly(ctx, [fp(0.3, 0.02), fp(0.7, 0.02), fp(0.7, 0.72), fp(0.3, 0.72)], '#2b1f16');

  // low gable-ish roof
  const Be = cor(-hw - eave, -hd - eave, wallH);
  const Re = cor(hw + eave, -hd - eave, wallH);
  const Fe = cor(hw + eave, hd + eave, wallH);
  const Le = cor(-hw - eave, hd + eave, wallH);
  const apex: Pt = { x: sx, y: sy - wallH - roofH };
  poly(ctx, [Be, Re, apex], '#6a5230');
  poly(ctx, [Be, Le, apex], '#765c37');
  poly(ctx, [Re, Fe, apex], '#6a5230');
  poly(ctx, [Le, Fe, apex], '#8a6c42');
  ctx.strokeStyle = 'rgba(40,30,20,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(Fe.x, Fe.y);
  ctx.stroke();
}

// ---- aitta (raised log storehouse) ---------------------------------------
// Small grey-log store lifted off the ground on corner stones (keeps grain dry and
// away from rodents), gabled bark/shingle roof, a little high door. See maatila.jpg.
function drawAitta(ctx: Ctx, sx: number, sy: number, a: Aitta): void {
  const hw = a.w / 2;
  const hd = a.d / 2;
  const lift = 5; // raised on corner stones
  const wallH = 15 + a.seed * 3;
  const roofH = 12;
  const eave = 0.4;
  const cor = (dx: number, dy: number, hh = 0): Pt => ({
    x: sx + (dx - dy) * HALF_W,
    y: sy + (dx + dy) * HALF_H - hh
  });

  // ground shadow
  poly(
    ctx,
    [
      { x: cor(-hw, -hd).x + 4, y: cor(-hw, -hd).y + 3 },
      { x: cor(hw, -hd).x + 5, y: cor(hw, -hd).y + 3 },
      { x: cor(hw, hd).x + 4, y: cor(hw, hd).y + 5 },
      { x: cor(-hw, hd).x - 2, y: cor(-hw, hd).y + 4 }
    ],
    'rgba(34,42,34,0.2)'
  );

  // corner stones under the three visible corners
  ctx.fillStyle = '#8c897f';
  for (const [dx, dy] of [[-hw, hd], [hw, hd], [hw, -hd]] as [number, number][]) {
    const g = cor(dx, dy);
    fillEllipse(ctx, g.x, g.y - lift * 0.4, 3.2, lift * 0.7);
  }

  // lifted body
  const L = cor(-hw, hd, lift);
  const F = cor(hw, hd, lift);
  const R = cor(hw, -hd, lift);
  const Lt = cor(-hw, hd, lift + wallH);
  const Ft = cor(hw, hd, lift + wallH);
  const Rt = cor(hw, -hd, lift + wallH);
  poly(ctx, [L, F, Ft, Lt], '#83755f'); // lit logs
  poly(ctx, [F, R, Rt, Ft], '#615442'); // shaded
  drawLogLines(ctx, L, F, Lt);
  drawLogLines(ctx, F, R, Ft);

  // small high door on the lit wall
  const along = { x: F.x - L.x, y: F.y - L.y };
  const up = { x: Lt.x - L.x, y: Lt.y - L.y };
  const fp = (p: number, q: number): Pt => ({ x: L.x + along.x * p + up.x * q, y: L.y + along.y * p + up.y * q });
  poly(ctx, [fp(0.36, 0.06), fp(0.64, 0.06), fp(0.64, 0.62), fp(0.36, 0.62)], '#34261a');
  ctx.strokeStyle = 'rgba(20,15,10,0.5)'; // plank seam
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(fp(0.5, 0.06).x, fp(0.5, 0.06).y);
  ctx.lineTo(fp(0.5, 0.62).x, fp(0.5, 0.62).y);
  ctx.stroke();

  // gabled bark/shingle roof
  const Be = cor(-hw - eave, -hd - eave, lift + wallH);
  const Re = cor(hw + eave, -hd - eave, lift + wallH);
  const Fe = cor(hw + eave, hd + eave, lift + wallH);
  const Le = cor(-hw - eave, hd + eave, lift + wallH);
  const apex: Pt = { x: sx, y: sy - lift - wallH - roofH };
  poly(ctx, [Be, Re, apex], '#6a5230');
  poly(ctx, [Be, Le, apex], '#765c37');
  poly(ctx, [Re, Fe, apex], '#6a5230');
  poly(ctx, [Le, Fe, apex], '#8a6c42');
  ctx.strokeStyle = 'rgba(40,30,20,0.5)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(Fe.x, Fe.y);
  ctx.stroke();
}

// ---- kaivo (well) --------------------------------------------------------
// A low log curb with two uprights, a windlass roller, a small ridge roof and a
// bucket on a rope. Near the tupa for daily water.
function drawWell(ctx: Ctx, sx: number, sy: number, w: Well): void {
  const r = 0.5;
  const h = 7;
  const cor = (dx: number, dy: number, hh = 0): Pt => ({
    x: sx + (dx - dy) * HALF_W,
    y: sy + (dx + dy) * HALF_H - hh
  });
  shadow(ctx, sx, sy, 15, 6);

  // curb (low log box)
  const L = cor(-r, r);
  const F = cor(r, r);
  const R = cor(r, -r);
  const B = cor(-r, -r);
  const Lt = cor(-r, r, h);
  const Ft = cor(r, r, h);
  const Rt = cor(r, -r, h);
  const Bt = cor(-r, -r, h);
  poly(ctx, [L, F, Ft, Lt], '#7a6c57');
  poly(ctx, [F, R, Rt, Ft], '#5f5443');
  drawLogLines(ctx, L, F, Lt);
  drawLogLines(ctx, F, R, Ft);
  // top rim + dark water
  poly(ctx, [Bt, Rt, Ft, Lt], '#6b5e4b');
  ctx.fillStyle = '#202a2b';
  fillEllipse(ctx, sx, (Bt.y + Ft.y) / 2, HALF_W * r * 0.85, HALF_H * r * 0.85);

  // two uprights at the side corners, a roller across, a small ridge roof
  const postTop = sy - 30 - h;
  const postW = 1.6;
  ctx.fillStyle = '#6f5839';
  ctx.fillRect(Lt.x - postW, postTop, postW * 2, Lt.y - postTop);
  ctx.fillRect(Rt.x - postW, postTop, postW * 2, Rt.y - postTop);
  // windlass roller
  ctx.strokeStyle = '#5a4630';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(Lt.x, postTop + 5);
  ctx.lineTo(Rt.x, postTop + 5);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // crank handle
  ctx.strokeStyle = '#5a4630';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(Rt.x, postTop + 5);
  ctx.lineTo(Rt.x + 4, postTop + 8);
  ctx.lineTo(Rt.x + 4, postTop + 11);
  ctx.stroke();
  // little ridge roof over the uprights
  const ridgeY = postTop - 7;
  poly(ctx, [{ x: Lt.x - 4, y: postTop + 1 }, { x: sx, y: ridgeY }, { x: sx, y: ridgeY + 1 }, { x: Lt.x - 4, y: postTop + 2 }], '#6a5230');
  poly(ctx, [{ x: Rt.x + 4, y: postTop + 1 }, { x: sx, y: ridgeY }, { x: sx, y: ridgeY + 1 }, { x: Rt.x + 4, y: postTop + 2 }], '#7c6038');
  ctx.fillStyle = '#5a4630';
  // rope + hanging bucket
  ctx.strokeStyle = 'rgba(40,30,20,0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx + 2, postTop + 6);
  ctx.lineTo(sx + 2, sy - h - 4);
  ctx.stroke();
  ctx.fillStyle = '#6e5436';
  poly(ctx, [{ x: sx - 1.6, y: sy - h - 5 }, { x: sx + 5.6, y: sy - h - 5 }, { x: sx + 5, y: sy - h }, { x: sx - 1, y: sy - h }], '#6e5436');
  ctx.strokeStyle = '#48381f';
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

// ---- paddock fence -------------------------------------------------------
function drawFence(ctx: Ctx, sx: number, sy: number, f: Fence): void {
  const rail = (ex: number, ey: number): void => {
    ctx.strokeStyle = '#6b5440';
    ctx.lineWidth = 1.5;
    for (const h of [-6.5, -3]) {
      ctx.beginPath();
      ctx.moveTo(sx, sy + h);
      ctx.lineTo(ex, ey + h);
      ctx.stroke();
    }
  };
  if (f.railX) rail(sx + HALF_W, sy + HALF_H);
  if (f.railY) rail(sx - HALF_W, sy + HALF_H);
  ctx.fillStyle = '#5a4836';
  ctx.fillRect(sx - 1.3, sy - 9, 2.6, 10);
  ctx.fillStyle = '#6e5742';
  ctx.fillRect(sx - 1.3, sy - 9, 1, 10);
  ctx.fillStyle = '#463524';
  fillEllipse(ctx, sx, sy - 9, 1.4, 0.8);
}

// ---- variksenpelätin (scarecrow) -----------------------------------------
// A cross-stake dressed in a ragged weathered shirt, straw poking out, a burlap
// head under a battered felt hat, cloth strips fluttering. See maatila.jpg.
function drawScarecrow(ctx: Ctx, sx: number, sy: number, e: Scarecrow, time: number): void {
  shadow(ctx, sx, sy, 7, 3);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(e.facing < 0 ? -1 : 1, 1);
  const breeze = Math.sin(time * 0.9 + e.seed * 6.28);

  // cross-stake
  ctx.strokeStyle = '#5b452e';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(0, -38); // upright
  ctx.moveTo(-11, -28);
  ctx.lineTo(11, -28); // crossbar
  ctx.stroke();
  ctx.lineCap = 'butt';

  // straw bristling at the wrists and waist
  ctx.strokeStyle = '#b89a54';
  ctx.lineWidth = 0.9;
  for (const [bx, by] of [[-11, -28], [11, -28], [0, -13]] as [number, number][]) {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + i * 1.6, by + 3 + Math.abs(i) * 0.6);
      ctx.stroke();
    }
  }

  // ragged shirt draped over the crossbar
  polyInk(
    ctx,
    [
      { x: -9, y: -29 },
      { x: 9, y: -29 },
      { x: 8, y: -14 },
      { x: -8, y: -14 }
    ],
    '#c8c0ac'
  );
  poly(ctx, [{ x: 1, y: -29 }, { x: 9, y: -29 }, { x: 8, y: -14 }, { x: 1, y: -14 }], '#ada592'); // shaded side
  // tattered hem
  ctx.fillStyle = '#c8c0ac';
  for (let i = -3; i <= 3; i++) tri(ctx, i * 2.4, -14, i * 2.4 + 1.2, -14, i * 2.4 + 0.6, -10 - (i & 1));
  // a couple of tear lines + a binding cord at the waist
  ctx.strokeStyle = 'rgba(70,60,44,0.4)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-3, -27);
  ctx.lineTo(-2.4, -15);
  ctx.moveTo(4, -26);
  ctx.lineTo(3.6, -16);
  ctx.stroke();
  ctx.strokeStyle = '#7c6a44';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-8, -18);
  ctx.lineTo(8, -18);
  ctx.stroke();

  // cloth strips fluttering from the arm ends
  ctx.strokeStyle = '#d7cfba';
  ctx.lineWidth = 1.3;
  for (const ex of [-11, 11]) {
    for (let i = 0; i < 3; i++) {
      const len = 7 + i * 2;
      const w = (breeze + i) * (ex < 0 ? 1.4 : 1.1);
      ctx.beginPath();
      ctx.moveTo(ex + (i - 1) * 1.6, -27.5);
      ctx.quadraticCurveTo(ex + (i - 1) * 1.6 + w, -27.5 + len * 0.6, ex + (i - 1) * 1.6 + w * 1.4, -27.5 + len);
      ctx.stroke();
    }
  }

  // burlap head + stitched face (sat just above the shoulders on the upright)
  ctx.save();
  ctx.translate(0, 3);
  ellInk(ctx, 0, -43, 4.4, 4.8, '#c2a86e'); // head, inked
  ctx.fillStyle = '#a98f57';
  fillEllipse(ctx, 1.6, -42.5, 1.8, 2.6); // shaded cheek
  ctx.strokeStyle = '#4d3b26';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-2.4, -44.4); // X eye
  ctx.lineTo(-1.2, -43.4);
  ctx.moveTo(-1.2, -44.4);
  ctx.lineTo(-2.4, -43.4);
  ctx.moveTo(1.2, -44.2); // dot eye
  ctx.lineTo(2.2, -43.6);
  ctx.moveTo(-1.4, -41.4); // stitched mouth
  ctx.lineTo(1.6, -41.4);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); // mouth stitches
    ctx.moveTo(-1.2 + i * 1.1, -42);
    ctx.lineTo(-1.2 + i * 1.1, -40.8);
    ctx.stroke();
  }

  // battered felt hat
  ctx.fillStyle = '#463524';
  fillEllipse(ctx, 0.3, -46.6, 7.2, 2.4); // brim
  ctx.fillStyle = '#3a2c1c';
  ctx.beginPath();
  ctx.moveTo(-3.6, -47);
  ctx.quadraticCurveTo(-2.8, -52, 0.6, -52);
  ctx.quadraticCurveTo(3.6, -51.6, 3.2, -47);
  ctx.closePath();
  ctx.fill();
  // straw poking out under the hat
  ctx.strokeStyle = '#b89a54';
  ctx.lineWidth = 0.8;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 1.7, -47.2);
    ctx.lineTo(i * 1.9, -45.6);
    ctx.stroke();
  }
  ctx.restore(); // head group

  ctx.restore();
}

// ---- jetty (laituri) -----------------------------------------------------
function drawJetty(ctx: Ctx, sx: number, sy: number, j: Jetty): void {
  const sdx = (j.dx - j.dy) * HALF_W;
  const sdy = (j.dx + j.dy) * HALF_H;
  for (let i = 0; i < 3; i++) {
    const cx = sx + sdx * i;
    const cy = sy + sdy * i;
    ctx.fillStyle = 'rgba(18,28,28,0.16)';
    fillEllipse(ctx, cx, cy + 4, HALF_W * 0.5, HALF_H * 0.5);
    ctx.strokeStyle = '#4a3a28';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - HALF_W * 0.3, cy - 2);
    ctx.lineTo(cx - HALF_W * 0.3, cy + 5);
    ctx.moveTo(cx + HALF_W * 0.3, cy - 2);
    ctx.lineTo(cx + HALF_W * 0.3, cy + 5);
    ctx.stroke();
    const r = -3;
    poly(
      ctx,
      [
        { x: cx - HALF_W * 0.5, y: cy + 1 + r },
        { x: cx, y: cy - HALF_H * 0.5 + 1 + r },
        { x: cx + HALF_W * 0.5, y: cy + 1 + r },
        { x: cx, y: cy + HALF_H * 0.5 + 1 + r }
      ],
      '#8a7559'
    );
    ctx.strokeStyle = 'rgba(50,40,28,0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - HALF_W * 0.36, cy + 0.5 + r);
    ctx.lineTo(cx + HALF_W * 0.36, cy + 0.5 + r);
    ctx.stroke();
  }
}

// ---- house ---------------------------------------------------------------
// Rustic, old, lived-in: weathered grey logs, a sagging sod- or thatch roof with
// exposed ridge poles, moss at the base. See inspiration/medieval/log-house-thatch-roof.
function drawHouse(ctx: Ctx, sx: number, sy: number, h: House, time: number): void {
  const hw = h.w / 2;
  const hd = h.d / 2;
  const wallH = 26 + h.seed * 8;
  const roofH = 26 + h.seed * 6;
  const eave = 0.45;
  const sod = h.seed > 0.5;

  const cor = (dx: number, dy: number, hh = 0): Pt => ({
    x: sx + (dx - dy) * HALF_W,
    y: sy + (dx + dy) * HALF_H - hh
  });

  const B = cor(-hw, -hd);
  const R = cor(hw, -hd);
  const F = cor(hw, hd);
  const L = cor(-hw, hd);
  const Bt = cor(-hw, -hd, wallH);
  const Rt = cor(hw, -hd, wallH);
  const Ft = cor(hw, hd, wallH);
  const Lt = cor(-hw, hd, wallH);

  poly(
    ctx,
    [
      { x: B.x + 6, y: B.y + 4 },
      { x: R.x + 8, y: R.y + 4 },
      { x: F.x + 6, y: F.y + 8 },
      { x: L.x - 2, y: L.y + 6 }
    ],
    'rgba(34,42,34,0.2)'
  );

  poly(ctx, [L, F, Ft, Lt], '#867863'); // lit weathered logs
  poly(ctx, [F, R, Rt, Ft], '#6c5f4f'); // shaded
  drawLogLines(ctx, L, F, Lt);
  drawLogLines(ctx, F, R, Ft);

  ctx.fillStyle = '#948571';
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    fillEllipse(ctx, F.x, F.y + (Ft.y - F.y) * t, 2, 1.6);
  }

  const facePt = (o: Pt, along: Pt, up: Pt, a: number, b: number): Pt => ({
    x: o.x + along.x * a + up.x * b,
    y: o.y + along.y * a + up.y * b
  });

  const alongLF = { x: F.x - L.x, y: F.y - L.y };
  const upLF = { x: Lt.x - L.x, y: Lt.y - L.y };
  poly(
    ctx,
    [
      facePt(L, alongLF, upLF, 0.4, 0.04),
      facePt(L, alongLF, upLF, 0.6, 0.04),
      facePt(L, alongLF, upLF, 0.6, 0.56),
      facePt(L, alongLF, upLF, 0.4, 0.56)
    ],
    '#372719'
  );

  const alongFR = { x: R.x - F.x, y: R.y - F.y };
  const upFR = { x: Rt.x - R.x, y: Rt.y - R.y };
  poly(
    ctx,
    [
      facePt(F, alongFR, upFR, 0.44, 0.42),
      facePt(F, alongFR, upFR, 0.6, 0.42),
      facePt(F, alongFR, upFR, 0.6, 0.7),
      facePt(F, alongFR, upFR, 0.44, 0.7)
    ],
    '#e7c886'
  );

  const Be = cor(-hw - eave, -hd - eave, wallH);
  const Re = cor(hw + eave, -hd - eave, wallH);
  const Fe = cor(hw + eave, hd + eave, wallH);
  const Le = cor(-hw - eave, hd + eave, wallH);
  const apex: Pt = { x: sx, y: sy - wallH - roofH };

  if (sod) {
    poly(ctx, [Be, Re, apex], '#3a4f34');
    poly(ctx, [Be, Le, apex], '#445b3b');
    poly(ctx, [Re, Fe, apex], '#3a4f34');
    poly(ctx, [Le, Fe, apex], '#4f6743');
    ctx.strokeStyle = '#62794392';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const a = hashf(h.seed * 30 + i, i);
      const px = Le.x + (Fe.x - Le.x) * a + (apex.x - Le.x) * 0.3 * a;
      const py = Le.y + (Fe.y - Le.y) * a + (apex.y - Le.y) * 0.3 * a;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (a - 0.5) * 2, py - 3);
      ctx.stroke();
    }
  } else {
    poly(ctx, [Be, Re, apex], '#735834');
    poly(ctx, [Be, Le, apex], '#80643a');
    poly(ctx, [Re, Fe, apex], '#735834');
    poly(ctx, [Le, Fe, apex], '#9c7d49');
    ctx.strokeStyle = 'rgba(64,46,24,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      ctx.beginPath();
      ctx.moveTo(apex.x + (Le.x - apex.x) * t, apex.y + (Le.y - apex.y) * t);
      ctx.lineTo(apex.x + (Fe.x - apex.x) * t, apex.y + (Fe.y - apex.y) * t);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(40,30,20,0.5)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(Fe.x, Fe.y);
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(Le.x, Le.y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(100,124,64,0.5)';
  fillEllipse(ctx, (L.x + F.x) / 2, (L.y + F.y) / 2 + 2, hw * HALF_W * 0.8, 3);

  const ch = cor(-hw * 0.4, -hd * 0.4, wallH + roofH * 0.5);
  ctx.fillStyle = '#473122';
  ctx.fillRect(ch.x - 3, ch.y - 10, 6, 12);
  drawSmoke(ctx, ch.x, ch.y - 10, time);
}

function drawLogLines(ctx: Ctx, a: Pt, b: Pt, aTop: Pt): void {
  const up = { x: aTop.x - a.x, y: aTop.y - a.y };
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const s = i / 6;
    ctx.beginPath();
    ctx.moveTo(a.x + up.x * s, a.y + up.y * s);
    ctx.lineTo(b.x + up.x * s, b.y + up.y * s);
    ctx.stroke();
  }
}

function drawSmoke(ctx: Ctx, x: number, y: number, time: number): void {
  for (let i = 0; i < 5; i++) {
    const t = (time * 0.16 + i * 0.2) % 1;
    const px = x + Math.sin(time * 0.6 + i * 1.7) * 5 * t;
    const py = y - t * 46;
    ctx.fillStyle = `rgba(222,222,214,${((1 - t) * 0.2).toFixed(3)})`;
    fillEllipse(ctx, px, py, 2.5 + t * 7, 2.5 + t * 7);
  }
}

// ---- atmosphere overlay --------------------------------------------------
// Sparse and slow — the scene should feel still.
const MOTES = Array.from({ length: 20 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: 0.5 + Math.random() * 1.3,
  spd: 2 + Math.random() * 5,
  drift: Math.random() * 6.28,
  amp: 6 + Math.random() * 16,
  ph: Math.random() * 6.28
}));

function drawAtmosphere(ctx: Ctx, vw: number, vh: number, time: number): void {
  // soft, slow diagonal light shafts
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = ((i * 0.4 + time * 0.004) % 1.4 - 0.2) * vw;
    const g = ctx.createLinearGradient(x, 0, x + vw * 0.3, vh);
    g.addColorStop(0, 'rgba(255,248,228,0)');
    g.addColorStop(0.5, 'rgba(255,246,222,0.035)');
    g.addColorStop(1, 'rgba(255,248,228,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + vw * 0.18, 0);
    ctx.lineTo(x + vw * 0.4, vh);
    ctx.lineTo(x + vw * 0.22, vh);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // a little drifting pollen
  for (const m of MOTES) {
    const baseX = m.x * vw + Math.sin(time * 0.12 + m.drift) * m.amp;
    const x = (((baseX % (vw + 40)) + (vw + 40)) % (vw + 40)) - 20;
    const y = ((m.y * vh + time * m.spd) % (vh + 40)) - 20;
    const a = 0.12 + 0.14 * Math.sin(time * 0.8 + m.ph);
    ctx.fillStyle = `rgba(252,248,228,${Math.max(0, a).toFixed(3)})`;
    fillEllipse(ctx, x, y, m.r, m.r);
  }

  // vignette
  const g = ctx.createRadialGradient(
    vw / 2,
    vh * 0.45,
    Math.min(vw, vh) * 0.3,
    vw / 2,
    vh * 0.5,
    Math.max(vw, vh) * 0.75
  );
  g.addColorStop(0, 'rgba(18,26,22,0)');
  g.addColorStop(1, 'rgba(18,26,22,0.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
}
