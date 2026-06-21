// The farm scene (Pihapiiri): tupa, aitta, navetta — a static, hand-illustrated
// backdrop (assets/farm-scene.svg) with Jussi (assets/jussi-sprite-sheet.png) walking
// left/right across the yard. This is the new side-on, Pentiment-style presentation;
// see the "Perspective" note in CLAUDE.md — it supersedes the isometric engine for now.
import type { Input } from './input';
import { axis } from './input';
import farmSceneUrl from '../assets/farm-scene.svg';
import jussiUrl from '../assets/jussi-sprite-sheet.png';

// Native size of the illustrated scene (assets/farm-scene.svg viewBox).
const SCENE_W = 1920;
const SCENE_H = 1080;

// jussi-sprite-sheet.png is a 4x4 sheet, each cell 180x280 (the vector source is
// assets/jussi-sprite-sheet.svg — edit that and re-export if the art needs to change).
// Rows: 0 front, 1 back, 2 side-on walk facing left, 3 side-on walk facing right
// (a true mirrored row, not a flip of row 2). Within a walk row, col0/col2 = stepping,
// col1/col3 = legs-together passing pose.
const CELL_W = 180;
const CELL_H = 280;
const FRONT_ROW = 0;
const FRONT_FRAME = 0; // a plain, neutral standing pose — used whenever Jussi is idle
const WALK_ROW_LEFT = 2;
const WALK_ROW_RIGHT = 3;
const FRAME_COUNT = 4;

// Ground line Jussi's feet stand on, and how far he can walk either way, picked to
// clear all three buildings and the two foreground trees (see assets/farm-scene.svg).
const GROUND_Y = 850;
const WALK_MIN_X = 170;
const WALK_MAX_X = 1740;

const FIGURE_H = 180; // scene-space px — a small presence in a wide establishing shot
const FIGURE_W = FIGURE_H * (CELL_W / CELL_H);

const WALK_SPEED = 340; // scene px / second
const FRAME_TIME = 0.08; // seconds per walk-cycle frame, tuned to WALK_SPEED so the
// stride length (frames per px travelled) looks the same as before, not just faster-footed

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
  let facingRight = false;
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
    let sx: number;
    let sy: number;
    if (moving) {
      const frame = Math.floor(animTime / FRAME_TIME) % FRAME_COUNT;
      sx = frame * CELL_W;
      sy = (facingRight ? WALK_ROW_RIGHT : WALK_ROW_LEFT) * CELL_H;
    } else {
      sx = FRONT_FRAME * CELL_W;
      sy = FRONT_ROW * CELL_H;
    }

    ctx.save();
    ctx.translate(x, GROUND_Y);
    ctx.drawImage(jussi, sx, sy, CELL_W, CELL_H, -FIGURE_W / 2, -FIGURE_H, FIGURE_W, FIGURE_H);
    ctx.restore();
  }

  return { update, render };
}
