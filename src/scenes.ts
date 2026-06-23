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
import type { Season } from './chapters';
import { CHARACTERS } from './characters';
import pihapiiriUrl from '../assets/farm-scene.svg';
import peltoUrl from '../assets/field-scene.svg';
import metsalaidunSpringUrl from '../assets/metsalaidun-scene-spring.svg';
import metsalaidunSummerUrl from '../assets/metsalaidun-scene-summer.svg';
import metsalaidunWinterUrl from '../assets/metsalaidun-scene-winter.svg';
import aittaInteriorUrl from '../assets/aitta-interior-scene.svg';
import kuokkaUrl from '../assets/kuokka.svg';

// Every scene shares this illustrated canvas size (see the scene SVGs' viewBox).
const SCENE_W = 1920;
const SCENE_H = 1080;

// A character's sprite sheet rows: 0 front, 1 back, 2 side-on walk facing left,
// 3 side-on walk facing right (a true mirrored row, not a flip of row 2). Within a
// walk row, col0/col2 = stepping, col1/col3 = legs-together passing pose. See
// characters.ts for per-character cell size/frame count.
const FRONT_FRAME = 0; // a plain, neutral standing pose — used whenever the character is idle

const FIGURE_H = 235; // scene-space px — a clear presence against the wide backdrop

const WALK_SPEED = 340; // scene px / second
const FRAME_TIME = 0.08; // seconds per walk-cycle frame, tuned to WALK_SPEED so the
// stride length (frames per px travelled) looks the same as before, not just faster-footed

const ARRIVE_INSET = 60; // how far onto the new stage Jussi lands, clear of its own marker

export type SceneId = 'pihapiiri' | 'pelto' | 'metsalaidun' | 'aittaInterior';

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

// A small standalone prop image (e.g. a tool left in the field), drawn on top of the
// background and anchored bottom-centre at (cx, groundY) like a character. Hovering it
// just swaps in the pointer/hand cursor — no badge, no tooltip, unlike buildings.
interface SceneProp {
  imgUrl: string;
  cx: number;
  groundY: number;
  width: number;
  height: number;
  rotationDeg?: number; // tilts around the (cx, groundY) anchor, e.g. leaning against a wall
}

interface SceneDef {
  label: string; // shown in the location HUD, and in exit tooltips
  bgUrl: string; // default art, used as-is if `seasonal` has no entry for the current season
  seasonal?: Partial<Record<Season, string>>; // per-chapter-season art override (see chapters.ts)
  // Ground line Jussi's feet stand on, and how far he can walk either way — picked per
  // scene to clear its buildings/props/foreground trees (see the scene's SVG).
  groundY: number;
  walkMinX: number;
  walkMaxX: number;
  exitLeft?: SceneExit;
  exitRight?: SceneExit;
  buildings?: BuildingHotspot[];
  portals?: ScenePortal[];
  props?: SceneProp[];
  // A first-person look into the space rather than a side-on stage with a visible
  // player figure — e.g. stepping inside a small building. No character sprite is
  // drawn at all; movement/auto-walk/portals all still work exactly as normal.
  noPlayerSprite?: boolean;
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
      // No Aitta hotspot here — its doorway portal below covers naming + entry instead.
      { label: 'Tupa', cx: 995, cy: 520, rx: 320, ry: 185 },
      { label: 'Navetta', cx: 1525, cy: 565, rx: 230, ry: 150 },
    ],
    portals: [
      // The gap between aitta and tupa — a path out into the forest pasture beyond.
      { x: 560, to: 'metsalaidun', arriveAt: 950, label: 'Metsälaidun', arrow: 'up' },
      // The aitta's own doorway, straight ahead into its interior.
      { x: 305, to: 'aittaInterior', arriveAt: 960, label: 'Aitta', arrow: 'up' },
    ],
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
    // No autumn art yet — chapters 3/4 (Harvest, Riihi and Kekri) fall back to summer.
    bgUrl: metsalaidunSummerUrl,
    seasonal: { spring: metsalaidunSpringUrl, winter: metsalaidunWinterUrl },
    groundY: 1000,
    walkMinX: 120,
    walkMaxX: 1800,
    // The worn path back down through the clearing, toward the pihapiiri.
    portals: [{ x: 950, to: 'pihapiiri', arriveAt: 560, label: 'Pihapiiri', arrow: 'down' }],
  },
  aittaInterior: {
    label: 'Aitta',
    bgUrl: aittaInteriorUrl,
    groundY: 950,
    walkMinX: 650,
    walkMaxX: 1270,
    noPlayerSprite: true,
    // Back out through the same doorway.
    portals: [{ x: 960, to: 'pihapiiri', arriveAt: 305, label: 'Pihapiiri', arrow: 'down' }],
    // Leaning against the right wall, base on the floor, top tilted into the wall.
    props: [{ imgUrl: kuokkaUrl, cx: 1450, groundY: 980, width: 46, height: 170, rotationDeg: 15 }],
  },
};

// The scenes in display order, for the admin teleport dropdown (see main.ts).
export function listSceneIds(): { id: SceneId; label: string }[] {
  return (Object.keys(SCENES) as SceneId[]).map((id) => ({ id, label: SCENES[id].label }));
}

// Where Miina (the farm cat NPC) is found, per chapter — purely atmospheric for now, a
// fixed spot rather than anything AI-driven. Chapter 1 deliberately places her in the
// piha (the Pihapiiri yard, per the user); the rest are placeholders to show the system
// working across chapters/scenes, not deliberate choices yet. Not drawn at all if the
// player is currently controlling Miina themselves (see drawMiinaNpc).
const MIINA_BY_CHAPTER: Record<number, { scene: SceneId; x: number }> = {
  1: { scene: 'pihapiiri', x: 780 }, // piha, between the aitta/tupa portal and the tupa door
  2: { scene: 'pelto', x: 650 },
  3: { scene: 'pelto', x: 1450 }, // near the riihi
  4: { scene: 'metsalaidun', x: 1400 },
  5: { scene: 'pihapiiri', x: 1500 },
};

// Exit hotspot marker — a soft glow with a chevron, hoverable to preview where it leads,
// clickable to walk straight there. Sits further out than the walk boundary itself,
// toward the scene's edge, so it reads as "the path continues this way off-frame".
const MARKER_Y_OFFSET = 90; // above the ground line, roughly chest height
const MARKER_OUTSET = 90; // scene-space px beyond walkMinX/walkMaxX, toward the edge
const MARKER_RADIUS = 30;
const MARKER_HOVER_RADIUS = 60; // hover/click hit-test radius, scene-space px

// Building hotspot — hovering it just shows its name above the roofline (no marker
// badge on the building itself); not clickable.
const BUILDING_LABEL_GAP = 20; // clearance above the hotspot ellipse's top edge, for the label

// Shared cache so the same URL (e.g. a scene's bgUrl reused across every season it has
// no override for) only ever loads one HTMLImageElement.
const imageCache = new Map<string, HTMLImageElement>();
function loadImage(src: string): HTMLImageElement {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img;
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

function sceneBgUrl(scene: SceneDef, season: Season): string {
  return scene.seasonal?.[season] ?? scene.bgUrl;
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

// A soft glow without canvas's `filter: blur()` — measured at ~50ms/frame for the two
// marker blurs combined (60fps -> ~14fps), since Canvas2D filters aren't GPU-accelerated
// the way CSS filters on DOM elements are. A radial gradient fading to transparent reads
// as the same soft halo and costs effectively nothing.
function drawGlow(ctx: CanvasRenderingContext2D, radius: number, rgb: string, alpha: number): void {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
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
  setSeason(season: Season): void;
  setChapter(id: number): void;
  setCharacter(id: string): void;
  teleportTo(id: SceneId): void;
  getLocationLabel(): string;
}

export function createSceneManager(): SceneManager {
  const sceneIds = Object.keys(SCENES) as SceneId[];
  const bgImages: Record<SceneId, Record<Season, HTMLImageElement>> = {} as Record<
    SceneId,
    Record<Season, HTMLImageElement>
  >;
  for (const id of sceneIds) {
    const scene = SCENES[id];
    const bySeason = {} as Record<Season, HTMLImageElement>;
    for (const season of SEASONS) bySeason[season] = loadImage(sceneBgUrl(scene, season));
    bgImages[id] = bySeason;
  }
  const characterImages = new Map<string, HTMLImageElement>();
  for (const c of CHARACTERS) characterImages.set(c.id, loadImage(c.spriteUrl));
  const propImages = new Map<string, HTMLImageElement>();
  for (const id of sceneIds) {
    for (const prop of SCENES[id].props ?? []) propImages.set(prop.imgUrl, loadImage(prop.imgUrl));
  }

  let sceneId: SceneId = 'pihapiiri';
  let currentSeason: Season = 'spring'; // kept in sync with the chapter dropdown by main.ts
  let currentChapterId = 1; // ditto — drives MIINA_BY_CHAPTER
  let currentCharacterId = CHARACTERS[0].id;
  let x = (SCENES.pihapiiri.walkMinX + SCENES.pihapiiri.walkMaxX) / 2;
  let facingRight = false;
  let moving = false;
  let animTime = 0;
  let time = 0;

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
    // Ignore clicks on the chapter/character UI panel — only the canvas itself walks Jussi.
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
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
    autoWalkTargetX = null;
    pendingPortal = null;
  }

  function update(input: Input, dt: number): void {
    time += dt;

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
    const bg = bgImages[sceneId][currentSeason];
    if (bg.complete && bg.naturalWidth) {
      ctx.drawImage(bg, 0, 0, SCENE_W, SCENE_H);
    }

    const mouse = sceneMouse(scale, offX, offY);
    let hovering = false;
    for (const prop of scene.props ?? []) {
      const img = propImages.get(prop.imgUrl);
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        ctx.translate(prop.cx, prop.groundY);
        if (prop.rotationDeg) ctx.rotate((prop.rotationDeg * Math.PI) / 180);
        ctx.drawImage(img, -prop.width / 2, -prop.height, prop.width, prop.height);
        ctx.restore();
      }
      // Hit-test ignores rotation — close enough for a modest lean, and keeps this simple.
      const isHovered =
        mouse.x >= prop.cx - prop.width / 2 &&
        mouse.x <= prop.cx + prop.width / 2 &&
        mouse.y >= prop.groundY - prop.height &&
        mouse.y <= prop.groundY;
      hovering = hovering || isHovered;
    }
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
      if (isHovered) drawTooltip(ctx, b.cx, b.cy, b.label, 'none', b.ry + BUILDING_LABEL_GAP);
    }
    ctx.canvas.style.cursor = hovering ? 'pointer' : '';

    drawMiinaNpc(ctx, scene);
    drawCharacter(ctx, scene);

    ctx.restore();
  }

  function drawSpriteAt(
    ctx: CanvasRenderingContext2D,
    scene: SceneDef,
    charId: string,
    atX: number,
    anim: { moving: boolean; facingRight: boolean; animTime: number }
  ): void {
    const char = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
    const sprite = characterImages.get(char.id);
    if (!sprite || !sprite.complete || !sprite.naturalWidth) return;
    let sx: number;
    let sy: number;
    if (anim.moving) {
      const frame = Math.floor(anim.animTime / FRAME_TIME) % char.frameCount;
      sx = frame * char.cellW;
      sy = (anim.facingRight ? char.rows.walkRight : char.rows.walkLeft) * char.cellH;
    } else {
      sx = FRONT_FRAME * char.cellW;
      sy = char.rows.front * char.cellH;
    }

    const figureH = FIGURE_H * (char.heightScale ?? 1);
    const figureW = figureH * (char.cellW / char.cellH);
    ctx.save();
    ctx.translate(atX, scene.groundY);
    ctx.drawImage(sprite, sx, sy, char.cellW, char.cellH, -figureW / 2, -figureH, figureW, figureH);
    ctx.restore();
  }

  function drawCharacter(ctx: CanvasRenderingContext2D, scene: SceneDef): void {
    if (scene.noPlayerSprite) return;
    drawSpriteAt(ctx, scene, currentCharacterId, x, { moving, facingRight, animTime });
  }

  // Miina as ambient world dressing, sitting wherever MIINA_BY_CHAPTER puts her for the
  // current chapter — skipped entirely if she's the one currently being played, so
  // there's never two of her on screen at once (also skipped in noPlayerSprite scenes,
  // same reasoning as drawCharacter).
  function drawMiinaNpc(ctx: CanvasRenderingContext2D, scene: SceneDef): void {
    if (currentCharacterId === 'miina' || scene.noPlayerSprite) return;
    const spot = MIINA_BY_CHAPTER[currentChapterId];
    if (!spot || spot.scene !== sceneId) return;
    drawSpriteAt(ctx, scene, 'miina', spot.x, { moving: false, facingRight: false, animTime: 0 });
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

    drawGlow(ctx, r + 16, '244, 222, 165', alpha);

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

  function setSeason(season: Season): void {
    currentSeason = season;
  }

  function setChapter(id: number): void {
    currentChapterId = id;
  }

  function setCharacter(id: string): void {
    if (CHARACTERS.some((c) => c.id === id)) currentCharacterId = id;
  }

  function teleportTo(id: SceneId): void {
    const s = SCENES[id];
    enterScene(id, (s.walkMinX + s.walkMaxX) / 2);
  }

  function getLocationLabel(): string {
    return SCENES[sceneId].label;
  }

  return { update, render, setSeason, setChapter, setCharacter, teleportTo, getLocationLabel };
}
