// Per-frame simulation: player movement, the wandering cow, and camera follow.

import { TILE_W, TILE_H } from './iso';
import { isWalkable, tileAt } from './world';
import { axis } from './input';
import type { Input } from './input';
import type { Cow, Critter, Deer, GameState, World } from './types';

const SCREEN_SPEED = 158; // px / second, measured in screen space for even feel
const PLAYER_R = 0.3; // collision radius in tiles
const COW_SPEED = 0.6; // tiles / second
const COW_R = 0.35;
const DEER_SPEED = 1.5; // skittish, quicker than the cow
const DEER_R = 0.3;
const DEER_SPOOK = 4.5; // flees if the player gets this close

export function update(state: GameState, input: Input, dt: number): void {
  updatePlayer(state, input, dt);

  for (const e of state.world.entities) {
    if (e.kind === 'cow') updateCow(state.world, e, dt);
    else if (e.kind === 'deer') updateDeer(state, e, dt);
  }

  // Smooth, frame-rate independent camera follow.
  const k = 1 - Math.exp(-dt * 7);
  state.camera.x += (state.player.wx - state.camera.x) * k;
  state.camera.y += (state.player.wy - state.camera.y) * k;
}

function updatePlayer(state: GameState, input: Input, dt: number): void {
  const p = state.player;
  const a = axis(input);

  if (a.x !== 0 || a.y !== 0) {
    const len = Math.hypot(a.x, a.y);
    const sx = a.x / len;
    const sy = a.y / len;
    const dist = SCREEN_SPEED * dt;

    // Screen-space step -> world-space step (inverse iso transform).
    const A = (sx * dist) / (TILE_W / 2);
    const B = (sy * dist) / (TILE_H / 2);
    const dwx = (A + B) / 2;
    const dwy = (B - A) / 2;

    moveEntity(state.world, p, dwx, dwy, PLAYER_R);
    p.faceX = sx;
    p.faceY = sy;
    p.moving = true;
    p.anim += dt;
  } else {
    p.moving = false;
  }
}

function updateCow(world: World, c: Cow, dt: number): void {
  // Small wander radius so the cow stays in the paddock near the wife.
  stepCritter(world, c, dt, COW_SPEED, COW_R, () => pickTarget(world, c, 1.5), 4, 5);
}

function updateDeer(state: GameState, d: Deer, dt: number): void {
  const w = state.world;
  const p = state.player;
  const toP = Math.hypot(p.wx - d.wx, p.wy - d.wy);
  if (toP < DEER_SPOOK) {
    // Bolt directly away from the player to a reachable tile.
    for (let i = 0; i < 14; i++) {
      const ang = Math.atan2(d.wy - p.wy, d.wx - p.wx) + (Math.random() - 0.5) * 1.4;
      const rad = 3 + Math.random() * 3;
      const tx = d.wx + Math.cos(ang) * rad;
      const ty = d.wy + Math.sin(ang) * rad;
      if (isWalkable(w, tx, ty)) {
        d.tx = tx;
        d.ty = ty;
        break;
      }
    }
    d.wait = 0.2;
  }
  stepCritter(w, d, dt, DEER_SPEED, DEER_R, () => pickTarget(w, d, 5), 4, 6);
}

/** Generic wander: walk to target, idle, pick a new one. */
function stepCritter(
  w: World,
  c: Critter,
  dt: number,
  speed: number,
  radius: number,
  repick: () => void,
  waitMin: number,
  waitRange: number
): void {
  const dx = c.tx - c.wx;
  const dy = c.ty - c.wy;
  const d = Math.hypot(dx, dy);

  if (d < 0.12) {
    c.moving = false;
    c.wait -= dt;
    if (c.wait <= 0) {
      repick();
      c.wait = waitMin + Math.random() * waitRange;
    }
    return;
  }

  c.moving = true;
  const sp = speed * dt;
  const nx = (dx / d) * sp;
  const ny = (dy / d) * sp;
  c.facing = nx - ny >= 0 ? 1 : -1; // screen-space x direction

  const before = c.wx + c.wy;
  moveEntity(w, c, nx, ny, radius);
  if (Math.abs(c.wx + c.wy - before) < sp * 0.1) {
    c.tx = c.wx; // bumped into something — give up on this target
    c.ty = c.wy;
  }
}

function pickTarget(w: World, c: Critter, range: number): void {
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * range;
    const tx = c.homeX + Math.cos(ang) * rad;
    const ty = c.homeY + Math.sin(ang) * rad;
    const t = tileAt(w, Math.round(tx), Math.round(ty));
    if (t && t.type !== 'water' && isWalkable(w, tx, ty)) {
      c.tx = tx;
      c.ty = ty;
      return;
    }
  }
  c.tx = c.homeX;
  c.ty = c.homeY;
}

/** Axis-separated movement so the entity slides along obstacles. */
function moveEntity(
  world: World,
  e: { wx: number; wy: number },
  dx: number,
  dy: number,
  r: number
): void {
  if (canStand(world, e.wx + dx, e.wy, r)) e.wx += dx;
  if (canStand(world, e.wx, e.wy + dy, r)) e.wy += dy;
}

function canStand(world: World, x: number, y: number, r: number): boolean {
  return (
    isWalkable(world, x, y) &&
    isWalkable(world, x + r, y) &&
    isWalkable(world, x - r, y) &&
    isWalkable(world, x, y + r) &&
    isWalkable(world, x, y - r)
  );
}
