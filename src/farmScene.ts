// The farm scene (Pihapiiri): tupa, aitta, navetta — a static, hand-illustrated
// backdrop (assets/farm-scene.svg) with Jussi (assets/jussi.png) walking left/right
// across the yard. This is the new side-on, Pentiment-style presentation; see the
// "Perspective" note in CLAUDE.md — it supersedes the isometric engine for now.
import type { Input } from './input';
import { axis } from './input';
import farmSceneUrl from '../assets/farm-scene.svg';
import jussiUrl from '../assets/jussi.png';

// Native size of the illustrated scene (assets/farm-scene.svg viewBox).
const SCENE_W = 1920;
const SCENE_H = 1080;

// jussi.png is a 4x4 sprite sheet, each cell 360x560. Row 2 (0-indexed) is a
// side-on walk cycle drawn facing left: col1/col3 = stepping, col2/col4 = standing.
const CELL_W = 360;
const CELL_H = 560;
const WALK_ROW = 2;
const FRAME_COUNT = 4;
const IDLE_FRAME = 1;

// Ground line Jussi's feet stand on, and how far he can walk either way, picked to
// clear all three buildings and the two foreground trees (see assets/farm-scene.svg).
const GROUND_Y = 850;
const WALK_MIN_X = 170;
const WALK_MAX_X = 1740;

const FIGURE_H = 180; // scene-space px — a small presence in a wide establishing shot
const FIGURE_W = FIGURE_H * (CELL_W / CELL_H);

const WALK_SPEED = 220; // scene px / second
const FRAME_TIME = 0.12; // seconds per walk-cycle frame

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export interface FarmScene {
  update(input: Input, dt: number): void;
  render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void;
}

export function createFarmScene(): FarmScene {
  const bg = loadImage(farmSceneUrl);
  const jussi = loadImage(jussiUrl);

  let x = (WALK_MIN_X + WALK_MAX_X) / 2;
  let facingRight = false; // sprite art faces left natively
  let moving = false;
  let animTime = 0;

  function update(input: Input, dt: number): void {
    const dx = axis(input).x;
    moving = dx !== 0;
    if (dx !== 0) {
      facingRight = dx > 0;
      x = clamp(x + dx * WALK_SPEED * dt, WALK_MIN_X, WALK_MAX_X);
      animTime += dt;
    } else {
      animTime = 0;
    }
  }

  function render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void {
    const scale = Math.min(cssW / SCENE_W, cssH / SCENE_H);
    const offX = (cssW - SCENE_W * scale) / 2;
    const offY = (cssH - SCENE_H * scale) / 2;

    // Letterbox bars (when the viewport isn't 16:9) — calm, dark, unobtrusive.
    ctx.fillStyle = '#11140f';
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);

    if (bg.complete && bg.naturalWidth) {
      ctx.drawImage(bg, 0, 0, SCENE_W, SCENE_H);
    }

    drawJussi(ctx);

    ctx.restore();
  }

  function drawJussi(ctx: CanvasRenderingContext2D): void {
    if (!jussi.complete || !jussi.naturalWidth) return;
    const frame = moving ? Math.floor(animTime / FRAME_TIME) % FRAME_COUNT : IDLE_FRAME;
    const sx = frame * CELL_W;
    const sy = WALK_ROW * CELL_H;

    ctx.save();
    ctx.translate(x, GROUND_Y);
    if (facingRight) ctx.scale(-1, 1); // mirror the left-facing art to face right
    ctx.drawImage(jussi, sx, sy, CELL_W, CELL_H, -FIGURE_W / 2, -FIGURE_H, FIGURE_W, FIGURE_H);
    ctx.restore();
  }

  return { update, render };
}
