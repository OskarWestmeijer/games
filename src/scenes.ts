// Side-on scenes (Pihapiiri, Pelto, ...) Jussi can walk between — Pentiment-style static
// stages with hand-illustrated backdrops. Two ways between scenes:
// - Edge exits: walking past a scene's walkable edge that has an `exit` defined steps to
//   the next scene, arriving at its matching edge; edges without one are a hard wall.
// - Portals: a doorway *inside* a scene (e.g. the gap between two buildings) — clicking
//   its marker walks Jussi there and then steps to the destination on arrival. Unlike
//   edge exits, just walking past a portal's x with the keys does nothing; it has to be
//   clicked, so crossing it while heading elsewhere in the scene can't trigger it by accident.
// See the "Perspective" note in CLAUDE.md — this supersedes the isometric engine for now.
import type { Input } from './input';
import { axis } from './input';
import pihapiiriUrl from '../assets/farm-scene.svg';
import peltoUrl from '../assets/field-scene.svg';
import metsalaidunUrl from '../assets/metsalaidun-scene.svg';
import jussiUrl from '../assets/jussi-sprite-sheet.png';

// Every scene shares this illustrated canvas size (see the scene SVGs' viewBox).
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

const FIGURE_H = 235; // scene-space px — a clear presence against the wide backdrop
const FIGURE_W = FIGURE_H * (CELL_W / CELL_H);

const WALK_SPEED = 340; // scene px / second
const FRAME_TIME = 0.08; // seconds per walk-cycle frame, tuned to WALK_SPEED so the
// stride length (frames per px travelled) looks the same as before, not just faster-footed

const ARRIVE_INSET = 60; // how far onto the new stage Jussi lands, clear of its own marker

type SceneId = 'pihapiiri' | 'pelto' | 'metsalaidun';

// The arrow a marker's chevron points: 'left'/'right' for edge exits (which way you walk
// off the scene), 'up'/'down' for portals (in/out of a doorway), 'none' for a plain label
// (buildings — no arrow at all).
type ArrowDir = 'left' | 'right' | 'up' | 'down' | 'none';

interface SceneExit {
  to: SceneId;
  arriveAt: 'min' | 'max'; // which edge of the destination scene Jussi appears at
}

// A doorway inside a scene, not at its walkable edge — e.g. the gap between two
// buildings leading into another area. Only triggers by clicking its marker; see the
// file header.
interface ScenePortal {
  x: number; // scene-space x the marker sits at, and where Jussi walks to before entering
  to: SceneId;
  arriveAt: number; // exact scene-space x Jussi appears at in the destination
  label: string; // destination's display name, shown in the tooltip
  arrow: 'up' | 'down';
}

// A building's hover region — an ellipse roughly matching its silhouette, eyeballed
// against the scene's SVG. Purely informational: hovering names it, it isn't clickable.
interface BuildingHotspot {
  label: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface SceneDef {
  label: string; // shown as the location subtitle on entry, and in exit tooltips
  bgUrl: string;
  // Ground line Jussi's feet stand on, and how far he can walk either way — picked per
  // scene to clear its buildings/props/foreground trees (see the scene's SVG).
  groundY: number;
  walkMinX: number;
  walkMaxX: number;
  exitLeft?: SceneExit;
  exitRight?: SceneExit;
  buildings?: BuildingHotspot[];
  portals?: ScenePortal[];
}

const SCENES: Record<SceneId, SceneDef> = {
  pihapiiri: {
    label: 'Pihapiiri',
    bgUrl: pihapiiriUrl,
    groundY: 850,
    walkMinX: 170,
    walkMaxX: 1740,
    exitRight: { to: 'pelto', arriveAt: 'min' },
    buildings: [
      { label: 'Aitta', cx: 305, cy: 660, rx: 140, ry: 120 },
      { label: 'Tupa', cx: 995, cy: 520, rx: 320, ry: 185 },
      { label: 'Navetta', cx: 1525, cy: 565, rx: 230, ry: 150 },
    ],
    // The gap between aitta and tupa — a path out into the forest pasture beyond.
    portals: [{ x: 560, to: 'metsalaidun', arriveAt: 950, label: 'Metsälaidun', arrow: 'up' }],
  },
  pelto: {
    label: 'Pelto ja riihi',
    bgUrl: peltoUrl,
    groundY: 950,
    walkMinX: 220,
    walkMaxX: 1780,
    exitLeft: { to: 'pihapiiri', arriveAt: 'max' },
    buildings: [{ label: 'Riihi', cx: 1240, cy: 335, rx: 265, ry: 135 }],
  },
  metsalaidun: {
    label: 'Metsälaidun',
    bgUrl: metsalaidunUrl,
    groundY: 1000,
    walkMinX: 120,
    walkMaxX: 1800,
    // The worn path back down through the clearing, toward the pihapiiri.
    portals: [{ x: 950, to: 'pihapiiri', arriveAt: 560, label: 'Pihapiiri', arrow: 'down' }],
  },
};

// Location subtitle: fades in on scene entry, holds, then fades out.
const SUBTITLE_FADE_IN = 0.5;
const SUBTITLE_HOLD = 2.6;
const SUBTITLE_FADE_OUT = 1.0;
const SUBTITLE_TOTAL = SUBTITLE_FADE_IN + SUBTITLE_HOLD + SUBTITLE_FADE_OUT;

// Exit hotspot marker — a soft glow with a chevron, hoverable to preview where it leads,
// clickable to walk straight there. Sits further out than the walk boundary itself,
// toward the scene's edge, so it reads as "the path continues this way off-frame".
const MARKER_Y_OFFSET = 90; // above the ground line, roughly chest height
const MARKER_OUTSET = 90; // scene-space px beyond walkMinX/walkMaxX, toward the edge
const MARKER_RADIUS = 30;
const MARKER_HOVER_RADIUS = 60; // hover/click hit-test radius, scene-space px

// Building hotspot marker — a small ring-and-dot badge drawn right on the building
// (at its hotspot centre) that brightens on hover, naming it. Not clickable; informational
// only. Its name label floats clear above the building's silhouette instead.
const BUILDING_MARKER_RADIUS = 11; // ring radius, base (non-hover) state
const BUILDING_LABEL_GAP = 20; // clearance above the hotspot ellipse's top edge, for the label

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

// Fit the 1920x1080 art to the viewport — the same scale/offset both render() and the
// click handler need, kept in one place so they can't drift apart.
function sceneTransform(cssW: number, cssH: number): { scale: number; offX: number; offY: number } {
  const scale = Math.min(cssW / SCENE_W, cssH / SCENE_H);
  const offX = (cssW - SCENE_W * scale) / 2;
  const offY = (cssH - SCENE_H * scale) / 2;
  return { scale, offX, offY };
}

interface ExitMarker {
  dir: 'left' | 'right';
  markerX: number;
  exit: SceneExit;
}

function* edgeExits(scene: SceneDef): Generator<ExitMarker> {
  if (scene.exitLeft) yield { dir: 'left', markerX: scene.walkMinX - MARKER_OUTSET, exit: scene.exitLeft };
  if (scene.exitRight) yield { dir: 'right', markerX: scene.walkMaxX + MARKER_OUTSET, exit: scene.exitRight };
}

function inEllipse(px: number, py: number, b: BuildingHotspot): boolean {
  const dx = (px - b.cx) / b.rx;
  const dy = (py - b.cy) / b.ry;
  return dx * dx + dy * dy <= 1;
}

// The three points of a chevron `<`/`>`/`^`/`v` pointing the given way, sized for
// drawExitMarker's stroke (apex 14px from centre, wings 8px wide).
function chevronPoints(dir: 'left' | 'right' | 'up' | 'down'): [number, number][] {
  switch (dir) {
    case 'right':
      return [[-8, -14], [8, 0], [-8, 14]];
    case 'left':
      return [[8, -14], [-8, 0], [8, 14]];
    case 'down':
      return [[-14, -8], [0, 8], [14, -8]];
    case 'up':
      return [[-14, 8], [0, -8], [14, 8]];
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface SceneManager {
  update(input: Input, dt: number): void;
  render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void;
}

export function createSceneManager(): SceneManager {
  const bgImages: Record<SceneId, HTMLImageElement> = {
    pihapiiri: loadImage(SCENES.pihapiiri.bgUrl),
    pelto: loadImage(SCENES.pelto.bgUrl),
    metsalaidun: loadImage(SCENES.metsalaidun.bgUrl),
  };
  const jussi = loadImage(jussiUrl);

  let sceneId: SceneId = 'pihapiiri';
  let x = (SCENES.pihapiiri.walkMinX + SCENES.pihapiiri.walkMaxX) / 2;
  let facingRight = false;
  let moving = false;
  let animTime = 0;
  let time = 0;
  let subtitleTimer = SUBTITLE_TOTAL; // shows the starting scene's label on load too

  // Set by clicking the ground, an exit marker, or a portal marker: walk toward this
  // scene-space x until arrival (ground click), until it triggers the exit at the scene
  // edge (exit marker — its target sits past the walk boundary, see
  // edgeExits/MARKER_OUTSET), or until it arrives exactly at a portal (see pendingPortal
  // below). Any manual key input cancels it and hands control back.
  let autoWalkTargetX: number | null = null;
  // Set alongside autoWalkTargetX by a portal click; consumed on arrival to step into
  // the destination scene instead of just stopping. Cleared by any other click/key input.
  let pendingPortal: ScenePortal | null = null;

  // Tracked in CSS pixels (client coords); the canvas fills the viewport at (0,0), so
  // these map directly onto the cssW/cssH space render() is called with.
  let mouseX = -1;
  let mouseY = -1;
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  window.addEventListener('click', (e) => {
    const { scale, offX, offY } = sceneTransform(window.innerWidth, window.innerHeight);
    const mx = (e.clientX - offX) / scale;
    const my = (e.clientY - offY) / scale;
    const scene = SCENES[sceneId];
    pendingPortal = null;

    // A click on an exit marker walks past the scene edge to trigger its transition.
    const groundMarkerY = scene.groundY - MARKER_Y_OFFSET;
    for (const { markerX } of edgeExits(scene)) {
      if (Math.hypot(mx - markerX, my - groundMarkerY) <= MARKER_HOVER_RADIUS) {
        autoWalkTargetX = markerX;
        return;
      }
    }
    // A click on a portal marker walks there and steps through on arrival.
    for (const portal of scene.portals ?? []) {
      if (Math.hypot(mx - portal.x, my - groundMarkerY) <= MARKER_HOVER_RADIUS) {
        autoWalkTargetX = portal.x;
        pendingPortal = portal;
        return;
      }
    }
    // Otherwise clicking anywhere walks Jussi along the ground to that x.
    autoWalkTargetX = clamp(mx, scene.walkMinX, scene.walkMaxX);
  });

  function enterScene(id: SceneId, arriveAt: 'min' | 'max' | number): void {
    sceneId = id;
    const s = SCENES[id];
    x = typeof arriveAt === 'number' ? arriveAt : arriveAt === 'min' ? s.walkMinX + ARRIVE_INSET : s.walkMaxX - ARRIVE_INSET;
    animTime = 0;
    subtitleTimer = SUBTITLE_TOTAL;
    autoWalkTargetX = null;
    pendingPortal = null;
  }

  function update(input: Input, dt: number): void {
    time += dt;
    if (subtitleTimer > 0) subtitleTimer = Math.max(0, subtitleTimer - dt);

    const scene = SCENES[sceneId];
    const manualDx = axis(input).x;
    if (manualDx !== 0) {
      autoWalkTargetX = null; // taking the keys back over cancels auto-walk
      pendingPortal = null;
    }

    let dx = manualDx;
    if (dx === 0 && autoWalkTargetX !== null) {
      const diff = autoWalkTargetX - x;
      if (Math.abs(diff) <= WALK_SPEED * dt) {
        // Arrives exactly this frame. Exit-marker targets sit beyond the walk boundary,
        // so that case is always caught by the exit check below first, before this fires.
        x = autoWalkTargetX;
        autoWalkTargetX = null;
        if (pendingPortal) {
          const portal = pendingPortal;
          enterScene(portal.to, portal.arriveAt);
        }
      } else {
        dx = diff > 0 ? 1 : -1;
      }
    }

    moving = dx !== 0;
    if (dx !== 0) {
      facingRight = dx > 0;
      animTime += dt;
      const next = x + dx * WALK_SPEED * dt;
      if (next > scene.walkMaxX && scene.exitRight) {
        enterScene(scene.exitRight.to, scene.exitRight.arriveAt);
      } else if (next < scene.walkMinX && scene.exitLeft) {
        enterScene(scene.exitLeft.to, scene.exitLeft.arriveAt);
      } else {
        x = clamp(next, scene.walkMinX, scene.walkMaxX);
      }
    } else {
      animTime = 0;
    }
  }

  // The mouse position, converted into the current scene-space point — using the same
  // scale/offset render() derives each frame to fit the 1920x1080 art to the viewport.
  function sceneMouse(scale: number, offX: number, offY: number): { x: number; y: number } {
    return { x: (mouseX - offX) / scale, y: (mouseY - offY) / scale };
  }

  function render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void {
    const { scale, offX, offY } = sceneTransform(cssW, cssH);

    // Letterbox bars (when the viewport isn't 16:9) — calm, dark, unobtrusive.
    ctx.fillStyle = '#11140f';
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);

    const scene = SCENES[sceneId];
    const bg = bgImages[sceneId];
    if (bg.complete && bg.naturalWidth) {
      ctx.drawImage(bg, 0, 0, SCENE_W, SCENE_H);
    }

    const mouse = sceneMouse(scale, offX, offY);
    let hovering = false;
    for (const { dir, markerX, exit } of edgeExits(scene)) {
      const my = scene.groundY - MARKER_Y_OFFSET;
      const isHovered = Math.hypot(mouse.x - markerX, mouse.y - my) <= MARKER_HOVER_RADIUS;
      hovering = hovering || isHovered;
      drawExitMarker(ctx, markerX, my, dir, isHovered);
      if (isHovered) drawTooltip(ctx, markerX, my, SCENES[exit.to].label, dir);
    }
    for (const portal of scene.portals ?? []) {
      const my = scene.groundY - MARKER_Y_OFFSET;
      const isHovered = Math.hypot(mouse.x - portal.x, mouse.y - my) <= MARKER_HOVER_RADIUS;
      hovering = hovering || isHovered;
      drawExitMarker(ctx, portal.x, my, portal.arrow, isHovered);
      if (isHovered) drawTooltip(ctx, portal.x, my, portal.label, portal.arrow);
    }
    for (const b of scene.buildings ?? []) {
      const isHovered = inEllipse(mouse.x, mouse.y, b);
      hovering = hovering || isHovered;
      drawBuildingMarker(ctx, b.cx, b.cy, isHovered);
      if (isHovered) drawTooltip(ctx, b.cx, b.cy, b.label, 'none', b.ry + BUILDING_LABEL_GAP);
    }
    ctx.canvas.style.cursor = hovering ? 'pointer' : '';

    drawJussi(ctx, scene);
    drawSubtitle(ctx, scene);

    ctx.restore();
  }

  function drawJussi(ctx: CanvasRenderingContext2D, scene: SceneDef): void {
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
    ctx.translate(x, scene.groundY);
    ctx.drawImage(jussi, sx, sy, CELL_W, CELL_H, -FIGURE_W / 2, -FIGURE_H, FIGURE_W, FIGURE_H);
    ctx.restore();
  }

  function drawExitMarker(
    ctx: CanvasRenderingContext2D,
    mx: number,
    my: number,
    dir: 'left' | 'right' | 'up' | 'down',
    hovered: boolean
  ): void {
    const pulse = Math.sin(time * 1.3) * 0.08;
    const r = hovered ? MARKER_RADIUS * 1.2 : MARKER_RADIUS;
    const alpha = hovered ? 0.85 : 0.32 + pulse;

    ctx.save();
    ctx.translate(mx, my);

    ctx.filter = 'blur(7px)';
    ctx.fillStyle = `rgba(244, 222, 165, ${alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';

    ctx.strokeStyle = `rgba(58, 45, 28, ${hovered ? 0.85 : 0.55})`;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const [[x0, y0], [x1, y1], [x2, y2]] = chevronPoints(dir);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
  }

  function drawBuildingMarker(
    ctx: CanvasRenderingContext2D,
    mx: number,
    my: number,
    hovered: boolean
  ): void {
    const pulse = Math.sin(time * 1.1) * 0.06;
    const k = hovered ? 1.3 : 1;
    const ringR = BUILDING_MARKER_RADIUS * k;

    ctx.save();
    ctx.translate(mx, my);

    ctx.filter = 'blur(6px)';
    ctx.fillStyle = `rgba(244, 222, 165, ${hovered ? 0.55 : 0.28 + pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, ringR * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';

    ctx.strokeStyle = `rgba(58, 45, 28, ${hovered ? 0.9 : 0.5 + pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(253, 250, 242, ${hovered ? 0.95 : 0.55 + pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, hovered ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // dir picks the arrow glyph (exit/portal markers); pass 'none' for a plain name
  // label (buildings).
  function drawTooltip(
    ctx: CanvasRenderingContext2D,
    mx: number,
    my: number,
    label: string,
    dir: ArrowDir,
    markerRadius: number = MARKER_RADIUS
  ): void {
    const text =
      dir === 'right' ? `${label} →`
      : dir === 'left' ? `← ${label}`
      : dir === 'down' ? `${label} ↓`
      : dir === 'up' ? `${label} ↑`
      : label;
    ctx.save();
    ctx.font = '28px ui-sans-serif, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 32;
    const h = 44;
    const ty = my - markerRadius - h / 2 - 16;

    ctx.fillStyle = 'rgba(35, 42, 32, 0.72)';
    roundRect(ctx, mx - w / 2, ty - h / 2, w, h, 10);
    ctx.fill();

    ctx.fillStyle = '#fdfaf2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, mx, ty + 1);
    ctx.restore();
  }

  function drawSubtitle(ctx: CanvasRenderingContext2D, scene: SceneDef): void {
    if (subtitleTimer <= 0) return;
    const elapsed = SUBTITLE_TOTAL - subtitleTimer;
    let alpha: number;
    if (elapsed < SUBTITLE_FADE_IN) alpha = elapsed / SUBTITLE_FADE_IN;
    else if (subtitleTimer < SUBTITLE_FADE_OUT) alpha = subtitleTimer / SUBTITLE_FADE_OUT;
    else alpha = 1;

    const cx = SCENE_W / 2;
    const cy = SCENE_H - 90;

    ctx.save();
    ctx.font = '600 34px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(scene.label).width + 64;

    ctx.fillStyle = `rgba(20, 24, 18, ${0.4 * alpha})`;
    roundRect(ctx, cx - w / 2, cy - 28, w, 56, 28);
    ctx.fill();

    ctx.fillStyle = `rgba(253, 250, 242, ${alpha})`;
    ctx.fillText(scene.label, cx, cy + 2);
    ctx.restore();
  }

  return { update, render };
}
