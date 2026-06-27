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
import pihapiiriUrl from '../assets/pihapiiri/farm-scene.svg';
import peltoSpringUrl from '../assets/pelto/field-scene-spring.svg';
import peltoSpringTilledUrl from '../assets/pelto/field-scene-spring-tilled.svg';
import peltoSummerUrl from '../assets/pelto/field-scene-summer.svg';
import peltoHarvestUrl from '../assets/pelto/field-scene-harvest.svg';
import peltoAutumnUrl from '../assets/pelto/field-scene-autumn.svg';
import peltoWinterUrl from '../assets/pelto/field-scene-winter.svg';
import metsalaidunSpringUrl from '../assets/metsalaidun/metsalaidun-scene-spring.svg';
import metsalaidunSummerUrl from '../assets/metsalaidun/metsalaidun-scene-summer.svg';
import metsalaidunWinterUrl from '../assets/metsalaidun/metsalaidun-scene-winter.svg';
import aittaInteriorUrl from '../assets/aitta/aitta-interior-scene.svg';
import navettaInteriorUrl from '../assets/navetta/navetta-interior-scene.svg';
import kuokkaUrl from '../assets/props/kuokka.svg';
import kylvoLakanaUrl from '../assets/kylvo-lakana-spritesheet.svg';
import cowSpriteUrl from '../assets/cow-sprite-sheet.svg';

// Tools whose equip visual is a sprite-sheet overlay drawn on top of Jussi in sync with
// his walk frames, rather than a static image held at shoulder/hand position.
// Sheet layout: rows 0-1 right-facing (idle then walk), rows 2-3 pre-mirrored left-facing.
interface OverlayDef {
  cellW: number;
  cellH: number;
  frameCount: number;
  rows: { walkRight: number; walkLeft: number; front: number };
}
const TOOL_OVERLAYS: Readonly<Record<string, OverlayDef>> = {
  [kylvoLakanaUrl]: { cellW: 180, cellH: 280, frameCount: 4, rows: { walkRight: 1, walkLeft: 3, front: 0 } },
};

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

// A tool carried once equipped (the kuokka, picked up in the Aitta — see SceneProp.equip
// and drawCarriedTool). Two poses: hoisted over the shoulder while walking, planted on the
// ground and held by the shaft while standing still. Geometry is relative to the player's
// figure box and tuned by eye against Jussi's sprite via tools/shot.mjs; it's drawn only
// for Jussi (heightScale 1), so these don't need to account for other characters.
//
// Walking — over the shoulder:
const CARRY_SHOULDER_UP = 0.72; // shoulder height as a fraction of FIGURE_H up from the feet
const CARRY_SHOULDER_DX = 0.05; // shoulder offset from centre, fraction of figure width toward facing dir
const CARRY_W = 56; // on-shoulder hoe size, scene px
const CARRY_H = 210;
const CARRY_ANGLE_DEG = 40; // tip the blade back over the shoulder, handle forward
const CARRY_PIVOT = 0.4; // point along the shaft (0 = blade tip, 1 = handle) that rests on the shoulder
const CARRY_SWAY_DEG = 2.5; // subtle sway over the walk cycle — kept tiny (calm, not jittery)
//
// Standing still — planted upright on the ground, held by the shaft:
const REST_W = 52; // standing hoe size, scene px
const REST_H = 205; // base on the ground line, blade up near shoulder height
const REST_DX = 0.2; // beside his hand, fraction of figure width toward last-faced dir
const REST_ANGLE_DEG = 5; // a hair off-vertical, leaning toward him, so it doesn't read as CAD-perfect

// A vertical strip of the field that Jussi can till with the kuokka. When cleared, the
// corresponding region is drawn from the scene's tilledBgUrl instead of the rough base bg.
// Six strips cover the full scene width so completing all of them fully transforms the field.
interface FieldStrip {
  x1: number; // left edge in scene space
  x2: number; // right edge in scene space
}

// What Jussi says (Finnish) when asked to clear a patch bare-handed — also the hint that
// tells the player where the tool is.
const NEED_KUOKKA_SPEECH = 'Tarvitsen kuokan aitasta.';
const NEED_SIEMENET_SPEECH = 'Tarvitsen siemenet.';
const SPEECH_DURATION = 3.4; // seconds the bubble stays up, including its fade-out

export type SceneId = 'pihapiiri' | 'pelto' | 'metsalaidun' | 'aittaInterior' | 'navettaInterior';

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
// background and anchored bottom-centre at (cx, groundY) like a character. Hovering shows
// a name tooltip if `label` is set (same drawTooltip as buildings/exits, dir 'none').
interface SceneProp {
  imgUrl?: string; // absent for invisible drop zones (e.g. a rack hit-area drawn into the scene SVG)
  label?: string;  // shown on hover; omit for drop zones and unlabelled props
  cx: number;
  groundY: number;
  width: number;
  height: number;
  rotationDeg?: number; // tilts around the (cx, groundY) anchor, e.g. leaning against a wall
  src?: { x: number; y: number; w: number; h: number }; // source-rect clip for sprite sheets — shows one cell
  // If set, clicking the prop equips this tool URL onto the player (carried over the
  // shoulder, see drawCarriedTool) and the prop vanishes from the scene — it's now in
  // hand, not on the floor. Same URL convention as imgUrl; usually equip === imgUrl.
  equip?: string;
  // If set, clicking here while that tool URL is equipped returns it to the scene
  // (unequips). Used for diegetic drop spots, e.g. a rack drawn into the scene SVG.
  unequip?: string;
}

interface SceneDef {
  label: string; // shown in the location HUD, and in exit tooltips
  bgUrl: string; // default art, used as-is if `seasonal` has no entry for the current season
  seasonal?: Partial<Record<Season, string>>; // per-chapter-season art override (see chapters.ts)
  // Full-field "tilled" version composited strip by strip as Jussi works the field.
  tilledBgUrl?: string;
  // Top of the field area in scene space — strips are drawn and clickable from here to SCENE_H.
  fieldY?: number;
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
  fieldStrips?: FieldStrip[];
  // Bounds for seed rendering inside fieldStrips — tighter than the strip x-bounds because
  // the foreground trees overlap the outermost columns and the soil art starts below fieldY.
  // Default: walkMinX/walkMaxX for x, fieldY for y.
  fieldSeedMinX?: number;
  fieldSeedMaxX?: number;
  fieldSeedMinY?: number;
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
      // No Aitta or Navetta hotspot — their doorway portals below cover naming + entry.
      { label: 'Tupa', cx: 995, cy: 520, rx: 320, ry: 185 },
    ],
    portals: [
      // The gap between aitta and tupa — a path out into the forest pasture beyond.
      { x: 560, to: 'metsalaidun', arriveAt: 950, label: 'Metsälaidun', arrow: 'up' },
      // The aitta's own doorway, straight ahead into its interior.
      { x: 305, to: 'aittaInterior', arriveAt: 960, label: 'Aitta', arrow: 'up' },
      // The navetta's doorway.
      { x: 1525, to: 'navettaInterior', arriveAt: 960, label: 'Navetta', arrow: 'up' },
    ],
  },
  pelto: {
    label: 'Pelto ja riihi',
    bgUrl: peltoSummerUrl,
    seasonal: {
      spring: peltoSpringUrl,
      summer: peltoSummerUrl,
      harvest: peltoHarvestUrl,
      autumn: peltoAutumnUrl,
      winter: peltoWinterUrl,
    },
    // Spring tilling: six strips across the full scene width. Each click (with kuokka)
    // blits that strip from the tilled background onto the rough spring base.
    tilledBgUrl: peltoSpringTilledUrl,
    fieldY: 490, // click/tilling threshold — soil art starts lower; see fieldSeedMinY
    fieldSeedMinX: 250,  // left foreground spruce extends to ~x=200 into the soil area
    fieldSeedMaxX: 1700, // right foreground spruce extends from ~x=1748
    fieldSeedMinY: 640,  // brown soil path starts at y=622; give a small margin
    fieldStrips: [
      { x1:    0, x2:  320 },
      { x1:  320, x2:  640 },
      { x1:  640, x2:  960 },
      { x1:  960, x2: 1280 },
      { x1: 1280, x2: 1600 },
      { x1: 1600, x2: 1920 },
    ],
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
    // Tools on the left wall. Kuokka hangs from the upper peg (teline); kylvölakana from
    // a separate hook (naula) lower on the same wall, clearly below and left of the pegs.
    // Each has an invisible drop zone so the player can return it to its spot.
    props: [
      { imgUrl: kuokkaUrl, label: 'Kuokka', cx: 283, groundY: 665, width: 46, height: 170, equip: kuokkaUrl },
      { cx: 283, groundY: 525, width: 220, height: 100, unequip: kuokkaUrl },
      { imgUrl: kylvoLakanaUrl, label: 'Kylvölakana', cx: 170, groundY: 890, width: 210, height: 225, src: { x: 40, y: 87, w: 88, h: 97 }, equip: kylvoLakanaUrl },
      { cx: 170, groundY: 780, width: 280, height: 140, unequip: kylvoLakanaUrl },
    ],
  },
  navettaInterior: {
    label: 'Navetta',
    bgUrl: navettaInteriorUrl,
    // groundY at the stall floor — used for the cow's feet position.
    groundY: 750,
    walkMinX: 100,
    walkMaxX: 1820,
    noPlayerSprite: true,
    portals: [{ x: 960, to: 'pihapiiri', arriveAt: 1525, label: 'Pihapiiri', arrow: 'down' }],
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

const SEASONS: Season[] = ['spring', 'summer', 'harvest', 'autumn', 'winter'];

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

export interface TaskState {
  fetchedKuokka: boolean;
  tilledField: boolean;
  fetchedLakana: boolean;
  sownField: boolean;
}

export interface SceneManager {
  update(input: Input, dt: number): void;
  render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number): void;
  setSeason(season: Season): void;
  setChapter(id: number): void;
  setCharacter(id: string): void;
  teleportTo(id: SceneId): void;
  getLocationLabel(): string;
  getTaskState(): TaskState;
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
  const tilledImages = new Map<SceneId, HTMLImageElement>();
  for (const id of sceneIds) {
    const scene = SCENES[id];
    if (scene.tilledBgUrl) tilledImages.set(id, loadImage(scene.tilledBgUrl));
  }
  const characterImages = new Map<string, HTMLImageElement>();
  for (const c of CHARACTERS) characterImages.set(c.id, loadImage(c.spriteUrl));
  const cowImage = loadImage(cowSpriteUrl);
  const propImages = new Map<string, HTMLImageElement>();
  for (const id of sceneIds) {
    for (const prop of SCENES[id].props ?? []) {
      if (prop.imgUrl) propImages.set(prop.imgUrl, loadImage(prop.imgUrl));
    }
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

  // The tool the player is currently carrying, or null. Set by clicking a prop with an
  // `equip` URL (see the click handler); persists across scene changes, so once picked up
  // in the Aitta it rides on Jussi everywhere. A single slot, not an inventory — only the
  // kuokka exists for now (see CLAUDE.md's "no traditional inventory" constraint).
  let equippedToolUrl: string | null = null;
  const isPropHidden = (prop: SceneProp): boolean => prop.equip != null && prop.equip === equippedToolUrl;

  // Field strips already hoed clear, keyed `${sceneId}:${index}`; persists across scenes.
  const clearedStrips = new Set<string>();
  // Field strips that have been sown (kylvölakana used on a cleared strip).
  const sownStrips = new Set<string>();
  const stripKey = (id: SceneId, i: number): string => `${id}:${i}`;
  // Task progress — set once when each tool is first picked up.
  let kuokkaEverEquipped = false;
  let lakanaEverEquipped = false;

  // A short cartoon speech line above Jussi (e.g. "I need the kuokka"). Cleared by time in
  // render(), and on a scene change so it can't linger into the next stage.
  let speechText: string | null = null;
  let speechStart = 0; // value of `time` when it appeared

  // Lehmä (cow) NPC — wanders the metsälaidun, grazes and idles between walks.
  const COW_CELL_W = 180;
  const COW_CELL_H = 280;
  const COW_H = 330; // display height in scene space — larger than Jussi's 235 feels right for a cow
  const COW_W = COW_H * (COW_CELL_W / COW_CELL_H);
  const COW_FRAME_GRAZE = 0.38;  // eating — languid
  const COW_FRAME_STAND = 0.50;  // standing idle — very slow subtle sway
  const COW_FRAME_WALK  = 0.18;  // walking — moderate stride
  const COW_WALK_SPEED = 55; // scene px/s
  const COW_MIN_X = 350;
  const COW_MAX_X = 1550;

  type CowPhase = 'grazing' | 'standing' | 'walking';
  let cowX = 600;
  let cowFacingRight = false;
  let cowPhase: CowPhase = 'grazing';
  let cowAnimTime = 0;
  let cowPhaseTimer = 0;
  let cowPhaseDuration = 7 + Math.random() * 6; // seconds in current phase
  let cowTargetX = 950;
  // Navetta cow — simpler two-state idle: standing or lying.
  type CowNavettaPhase = 'standing' | 'lying';
  let cowNavettaPhase: CowNavettaPhase = 'standing';
  let cowNavettaTimer = 0;
  let cowNavettaDuration = 8 + Math.random() * 10;

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

    // A click on an exit or portal marker steps directly to the destination.
    const groundMarkerY = scene.groundY - MARKER_Y_OFFSET;
    for (const { markerX, exit } of edgeExits(scene)) {
      if (Math.hypot(mx - markerX, my - groundMarkerY) <= MARKER_HOVER_RADIUS) {
        enterScene(exit.to, exit.arriveAt);
        return;
      }
    }
    for (const portal of scene.portals ?? []) {
      if (Math.hypot(mx - portal.x, my - groundMarkerY) <= MARKER_HOVER_RADIUS) {
        enterScene(portal.to, portal.arriveAt);
        return;
      }
    }
    // A click on a rack/drop zone returns the matching carried tool to the scene.
    for (const prop of scene.props ?? []) {
      if (!prop.unequip || prop.unequip !== equippedToolUrl) continue;
      if (
        mx >= prop.cx - prop.width / 2 && mx <= prop.cx + prop.width / 2 &&
        my >= prop.groundY - prop.height && my <= prop.groundY
      ) {
        equippedToolUrl = null;
        return;
      }
    }
    // A click on an equippable prop picks it up (it then rides on the player — see
    // drawCarriedTool) rather than walking. Same unrotated bounding box as the hover
    // hit-test in render(); skipped once equipped, since the prop's then hidden.
    for (const prop of scene.props ?? []) {
      if (!prop.equip || isPropHidden(prop)) continue;
      if (
        mx >= prop.cx - prop.width / 2 && mx <= prop.cx + prop.width / 2 &&
        my >= prop.groundY - prop.height && my <= prop.groundY
      ) {
        equippedToolUrl = prop.equip;
        if (prop.equip === kuokkaUrl) kuokkaEverEquipped = true;
        if (prop.equip === kylvoLakanaUrl) lakanaEverEquipped = true;
        return;
      }
    }
    // Clicking a field strip in spring:
    //   uncleared → hoe it (kuokka) or say need kuokka
    //   cleared but unsown → sow it (kylvölakana) or say need siemenet
    //   sown → fall through to walk so the player can still move around the field
    const strips = scene.fieldStrips ?? [];
    if (currentSeason === 'spring' && strips.length > 0 && scene.fieldY != null && my >= scene.fieldY) {
      for (let i = 0; i < strips.length; i++) {
        const s = strips[i];
        if (mx < s.x1 || mx >= s.x2) continue;
        const key = stripKey(sceneId, i);
        if (!clearedStrips.has(key)) {
          if (equippedToolUrl === kuokkaUrl) {
            clearedStrips.add(key);
          } else {
            speechText = NEED_KUOKKA_SPEECH;
            speechStart = time;
          }
          return;
        }
        if (!sownStrips.has(key)) {
          if (equippedToolUrl === kylvoLakanaUrl) {
            sownStrips.add(key);
          } else {
            speechText = NEED_SIEMENET_SPEECH;
            speechStart = time;
          }
          return;
        }
        // Already sown — fall through to ground-walk.
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
    speechText = null; // don't let a speech bubble linger into the next stage
  }

  function update(input: Input, dt: number): void {
    time += dt;
    updateCow(dt);

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
    const seasonBg = bgImages[sceneId][currentSeason];
    const tilledBg = tilledImages.get(sceneId);
    const strips = scene.fieldStrips ?? [];
    // Tilling progress only applies in spring — in other seasons just show the seasonal bg.
    const tillingActive = currentSeason === 'spring';
    // If any strips are cleared, use the tilled bg as the base — cleared strips then show
    // through it seamlessly with no per-strip compositing. Uncleared strips paint the
    // rough seasonal bg back on top in one compound clip (see drawFieldStrips).
    const anyCleared = tillingActive && strips.length > 0 && strips.some((_, i) => clearedStrips.has(stripKey(sceneId, i)));
    const baseBg = anyCleared && tilledBg?.complete && tilledBg.naturalWidth ? tilledBg : seasonBg;
    if (baseBg.complete && baseBg.naturalWidth) {
      ctx.drawImage(baseBg, 0, 0, SCENE_W, SCENE_H);
    }

    const mouse = sceneMouse(scale, offX, offY);
    let hovering = false;
    hovering = tillingActive && drawFieldStrips(ctx, scene, mouse, seasonBg) || hovering;
    if (tillingActive) hovering = drawSownSeeds(ctx, scene, mouse) || hovering;
    for (const prop of scene.props ?? []) {
      const hidden = isPropHidden(prop);
      // Render the prop image when visible and an image exists (drop zones have no imgUrl).
      if (!hidden && prop.imgUrl) {
        const img = propImages.get(prop.imgUrl);
        if (img && img.complete && img.naturalWidth) {
          ctx.save();
          ctx.translate(prop.cx, prop.groundY);
          if (prop.rotationDeg) ctx.rotate((prop.rotationDeg * Math.PI) / 180);
          if (prop.src) {
            ctx.drawImage(img, prop.src.x, prop.src.y, prop.src.w, prop.src.h, -prop.width / 2, -prop.height, prop.width, prop.height);
          } else {
            ctx.drawImage(img, -prop.width / 2, -prop.height, prop.width, prop.height);
          }
          ctx.restore();
        }
      }
      // Hover/pointer cursor:
      // - equip prop: hoverable when not hidden (i.e. not already picked up)
      // - unequip drop zone: hoverable only when the matching tool is currently equipped
      const isInteractive = prop.unequip
        ? prop.unequip === equippedToolUrl
        : !hidden;
      if (isInteractive) {
        const isHit =
          mouse.x >= prop.cx - prop.width / 2 &&
          mouse.x <= prop.cx + prop.width / 2 &&
          mouse.y >= prop.groundY - prop.height &&
          mouse.y <= prop.groundY;
        hovering = hovering || isHit;
        if (isHit && prop.label) {
          const tipY = prop.groundY - prop.height;
          drawTooltip(ctx, prop.cx, tipY, prop.label, 'none', 0);
        }
      }
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

    drawCow(ctx, scene);
    drawMiinaNpc(ctx, scene);
    drawCharacter(ctx, scene);

    // Speech bubble above Jussi, fading out over its last stretch. Never in a scene with
    // no player figure (nothing to speak from).
    if (speechText && !scene.noPlayerSprite) {
      const elapsed = time - speechStart;
      if (elapsed >= SPEECH_DURATION) {
        speechText = null;
      } else {
        const fade = 0.6;
        const alpha = elapsed > SPEECH_DURATION - fade ? (SPEECH_DURATION - elapsed) / fade : 1;
        drawSpeechBubble(ctx, x, scene.groundY - FIGURE_H - 8, speechText, alpha);
      }
    }

    ctx.restore();
  }

  // For each cleared strip, blits that horizontal band from the tilled background on top
  // of the rough base — building up the fully-worked field one strip at a time.
  // Returns true if the mouse is over any un-cleared strip (for the pointer cursor).
  // Composites the spring tilling progress. The tilled bg is already the base when any
  // strips are cleared (see render()). This function paints the rough seasonal bg back
  // over ALL uncleared strips in a single compound clip and one drawImage call — so there
  // is only one SVG rasterization, no inter-strip edges, and no seams between strips.
  function drawFieldStrips(
    ctx: CanvasRenderingContext2D,
    scene: SceneDef,
    mouse: { x: number; y: number },
    roughBg: HTMLImageElement
  ): boolean {
    const strips = scene.fieldStrips;
    if (!strips || !scene.tilledBgUrl) return false;
    const fieldY = scene.fieldY ?? 0;
    const fieldH = SCENE_H - fieldY;

    const uncleared: FieldStrip[] = [];
    let hovering = false;
    for (let i = 0; i < strips.length; i++) {
      const s = strips[i];
      if (clearedStrips.has(stripKey(sceneId, i))) continue;
      uncleared.push(s);
      hovering = hovering || (mouse.x >= s.x1 && mouse.x < s.x2 && mouse.y >= fieldY);
    }

    // Paint rough bg back over every uncleared strip in one draw call — no per-strip
    // edges, so the only visible boundary is the natural tilled/rough field edge.
    if (uncleared.length > 0 && roughBg.complete && roughBg.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      for (const s of uncleared) ctx.rect(s.x1, fieldY, s.x2 - s.x1, fieldH);
      ctx.clip();
      ctx.drawImage(roughBg, 0, 0, SCENE_W, SCENE_H);
      ctx.restore();
    }

    return hovering;
  }

  // Scatter grain seeds visually on each sown strip. Returns true if the mouse is over
  // any cleared-but-unsown strip (so the cursor stays interactive before sowing too).
  function drawSownSeeds(
    ctx: CanvasRenderingContext2D,
    scene: SceneDef,
    mouse: { x: number; y: number }
  ): boolean {
    const strips = scene.fieldStrips;
    if (!strips || !scene.fieldY) return false;
    const fieldY = scene.fieldY;
    const fieldH = SCENE_H - fieldY;
    let hovering = false;

    for (let i = 0; i < strips.length; i++) {
      const s = strips[i];
      const key = stripKey(sceneId, i);
      if (!clearedStrips.has(key)) continue;

      if (!sownStrips.has(key)) {
        // Cleared but unsown — still interactive; nothing to draw yet.
        if (mouse.x >= s.x1 && mouse.x < s.x2 && mouse.y >= fieldY) hovering = true;
        continue;
      }

      // Clamp seed placement to the visible soil area — fieldSeedMin/Max bounds are set
      // per-scene to avoid foreground trees (which overlap the outermost strip columns)
      // and the green transition zone above the actual brown soil art.
      const seedX1 = Math.max(s.x1, scene.fieldSeedMinX ?? scene.walkMinX);
      const seedX2 = Math.min(s.x2, scene.fieldSeedMaxX ?? scene.walkMaxX);
      if (seedX2 <= seedX1) continue;
      const seedY0 = scene.fieldSeedMinY ?? fieldY;
      const seedW = seedX2 - seedX1;
      const seedH = SCENE_H - seedY0;
      const count = Math.floor(seedW / 4); // ~1 seed per 4 scene-px of strip width
      for (let j = 0; j < count; j++) {
        const base = i * 10000 + j;
        const sx = seedX1 + seededRand(base) * seedW;
        const sy = seedY0 + seededRand(base + 1) * seedH;
        const angle = seededRand(base + 2) * Math.PI;
        const rx = 5 + seededRand(base + 3) * 4;
        const ry = 2 + seededRand(base + 4) * 1.5;
        const alpha = 0.55 + seededRand(base + 5) * 0.35;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.fillStyle = `rgba(180, 138, 42, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    return hovering;
  }

  function seededRand(n: number): number {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
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
    // The carried tool rides on top of the figure. Only Jussi carries it — the geometry
    // is tuned to his sprite, and a cat with a hoe makes no sense; switching to Miina just
    // hides it (it's still "equipped", shown again when you switch back). Two poses: over
    // the shoulder while walking, planted on the ground when standing still.
    if (equippedToolUrl && currentCharacterId === 'jussi') {
      const img = loadImage(equippedToolUrl);
      if (img.complete && img.naturalWidth) {
        const overlayDef = TOOL_OVERLAYS[equippedToolUrl];
        if (overlayDef) {
          drawOverlayTool(ctx, scene, img, x, facingRight, animTime, overlayDef);
        } else {
          if (moving) drawShoulderTool(ctx, scene, img, x, facingRight, animTime);
          else drawRestingTool(ctx, scene, img, x, facingRight);
        }
      }
    }
  }

  // Walking pose — the tool hoisted over Jussi's shoulder, mirrored by facing direction.
  // The torso/head stay at a fixed height across the walk frames (only the legs cycle), so
  // pinning to a fixed shoulder anchor tracks him correctly as he walks; a tiny angle sway
  // over the walk cycle sells that it's being carried rather than floating.
  function drawShoulderTool(
    ctx: CanvasRenderingContext2D,
    scene: SceneDef,
    img: HTMLImageElement,
    atX: number,
    facing: boolean,
    anim: number
  ): void {
    const jussi = CHARACTERS.find((c) => c.id === 'jussi') ?? CHARACTERS[0];
    const figureW = FIGURE_H * (jussi.cellW / jussi.cellH);
    const dir = facing ? 1 : -1;
    const shoulderX = atX + dir * CARRY_SHOULDER_DX * figureW;
    const shoulderY = scene.groundY - CARRY_SHOULDER_UP * FIGURE_H;

    // One gentle sway per walk cycle (frameCount frames of FRAME_TIME each).
    const sway = Math.sin((anim / (jussi.frameCount * FRAME_TIME)) * Math.PI * 2) * CARRY_SWAY_DEG;
    const angle = ((CARRY_ANGLE_DEG + sway) * Math.PI) / 180;

    ctx.save();
    ctx.translate(shoulderX, shoulderY);
    ctx.scale(dir, 1); // mirror the whole frame so one angle works for both facings
    ctx.rotate(-angle); // tip the blade (top of the image) back, handle forward
    // Draw so the point CARRY_PIVOT down the shaft sits at the shoulder (origin).
    ctx.drawImage(img, -CARRY_W / 2, -CARRY_PIVOT * CARRY_H, CARRY_W, CARRY_H);
    ctx.restore();
  }

  // Standing pose — the tool stood upright on the ground beside his hand, held by the
  // shaft, leaning a touch toward him. Base anchored on the ground line, blade up.
  function drawRestingTool(
    ctx: CanvasRenderingContext2D,
    scene: SceneDef,
    img: HTMLImageElement,
    atX: number,
    facing: boolean
  ): void {
    const jussi = CHARACTERS.find((c) => c.id === 'jussi') ?? CHARACTERS[0];
    const figureW = FIGURE_H * (jussi.cellW / jussi.cellH);
    const dir = facing ? 1 : -1;
    const handX = atX + dir * REST_DX * figureW;
    const angle = ((REST_ANGLE_DEG * Math.PI) / 180) * dir; // lean the top toward his body

    ctx.save();
    ctx.translate(handX, scene.groundY);
    ctx.rotate(-angle);
    ctx.drawImage(img, -REST_W / 2, -REST_H, REST_W, REST_H); // bottom-centre anchor, blade up
    ctx.restore();
  }

  // Body-overlay tools (kylvölakana etc.) — drawn on top of Jussi in sync with his walk
  // frames, covering him like a piece of clothing rather than being held at arm's length.
  // The sheet's left-facing rows have the mirror baked in, so no ctx.scale flip is needed.
  function drawOverlayTool(
    ctx: CanvasRenderingContext2D,
    scene: SceneDef,
    img: HTMLImageElement,
    atX: number,
    facingRight: boolean,
    anim: number,
    def: OverlayDef
  ): void {
    const { cellW, cellH, frameCount, rows } = def;
    let sx: number;
    let sy: number;
    if (moving) {
      const frame = Math.floor(anim / FRAME_TIME) % frameCount;
      sx = frame * cellW;
      sy = (facingRight ? rows.walkRight : rows.walkLeft) * cellH;
    } else {
      sx = FRONT_FRAME * cellW;
      sy = rows.front * cellH;
    }
    // Draw at exactly Jussi's figure dimensions so the overlay aligns with his body.
    const jussi = CHARACTERS.find((c) => c.id === 'jussi') ?? CHARACTERS[0];
    const figureH = FIGURE_H;
    const figureW = figureH * (jussi.cellW / jussi.cellH);
    ctx.save();
    ctx.translate(atX, scene.groundY);
    ctx.drawImage(img, sx, sy, cellW, cellH, -figureW / 2, -figureH, figureW, figureH);
    ctx.restore();
  }

  function updateCow(dt: number): void {
    cowAnimTime += dt;
    cowPhaseTimer += dt;
    cowNavettaTimer += dt;
    if (cowNavettaTimer >= cowNavettaDuration) {
      cowNavettaPhase = cowNavettaPhase === 'standing' ? 'lying' : 'standing';
      cowNavettaTimer = 0;
      cowNavettaDuration = cowNavettaPhase === 'standing' ? 8 + Math.random() * 10 : 15 + Math.random() * 20;
    }
    if (cowPhase === 'walking') {
      const dir = cowTargetX > cowX ? 1 : -1;
      cowFacingRight = dir > 0;
      cowX += dir * COW_WALK_SPEED * dt;
      const arrived = dir > 0 ? cowX >= cowTargetX : cowX <= cowTargetX;
      if (arrived || cowPhaseTimer >= cowPhaseDuration) {
        cowX = clamp(arrived ? cowTargetX : cowX, COW_MIN_X, COW_MAX_X);
        // After walking, alternate between grazing and standing still.
        cowPhase = Math.random() < 0.6 ? 'grazing' : 'standing';
        cowPhaseTimer = 0;
        cowAnimTime = 0;
        cowPhaseDuration = cowPhase === 'grazing' ? 5 + Math.random() * 8 : 3 + Math.random() * 6;
      }
    } else {
      // grazing or standing — both are stationary; after the duration, either switch
      // to the other stationary state or pick a new walk destination.
      if (cowPhaseTimer >= cowPhaseDuration) {
        const roll = Math.random();
        if (roll < 0.4) {
          // Switch to the other idle pose.
          cowPhase = cowPhase === 'grazing' ? 'standing' : 'grazing';
          cowPhaseDuration = cowPhase === 'grazing' ? 5 + Math.random() * 8 : 3 + Math.random() * 6;
        } else {
          // Walk to a new spot.
          cowTargetX = COW_MIN_X + Math.random() * (COW_MAX_X - COW_MIN_X);
          cowFacingRight = cowTargetX > cowX;
          cowPhase = 'walking';
          cowPhaseDuration = Math.abs(cowTargetX - cowX) / COW_WALK_SPEED + 2;
        }
        cowPhaseTimer = 0;
        cowAnimTime = 0;
      }
    }
  }

  function drawCowSprite(
    ctx: CanvasRenderingContext2D,
    atX: number, atY: number,
    row: number, frame: number
  ): void {
    // Clip to the exact display rect so adjacent cells in the sheet can't bleed through.
    ctx.save();
    ctx.translate(atX, atY);
    ctx.beginPath();
    ctx.rect(-COW_W / 2, -COW_H, COW_W, COW_H);
    ctx.clip();
    ctx.drawImage(cowImage, frame * COW_CELL_W, row * COW_CELL_H, COW_CELL_W, COW_CELL_H, -COW_W / 2, -COW_H, COW_W, COW_H);
    ctx.restore();
  }

  function drawCow(ctx: CanvasRenderingContext2D, scene: SceneDef): void {
    if (!cowImage.complete || !cowImage.naturalWidth) return;
    const indoors = currentChapterId === 1 || currentChapterId === 5;

    if (sceneId === 'navettaInterior' && indoors) {
      // Kevät and winter: standing (row 1) or lying (row 3), no grazing/walking.
      const row = cowNavettaPhase === 'lying' ? 3 : 1;
      const frame = Math.floor(cowAnimTime / COW_FRAME_STAND) % 4;
      drawCowSprite(ctx, 325, scene.groundY, row, frame);
      return;
    }

    if (sceneId === 'metsalaidun' && !indoors) {
      // Summer / harvest / autumn: outside grazing and wandering.
      let row: number;
      let frameTime: number;
      if (cowPhase === 'grazing') {
        row = 2;
        frameTime = COW_FRAME_GRAZE;
      } else {
        row = cowFacingRight ? 1 : 0;
        frameTime = cowPhase === 'walking' ? COW_FRAME_WALK : COW_FRAME_STAND;
      }
      const frame = Math.floor(cowAnimTime / frameTime) % 4;
      drawCowSprite(ctx, cowX, scene.groundY, row, frame);
    }
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

  // A cartoon speech bubble centred over (atX, tipY) — tipY is where the tail points, just
  // above Jussi's head — with a rounded body sitting above it. One closed path for body +
  // tail so the outline strokes cleanly around both. Parchment fill to match the HUD.
  function drawSpeechBubble(
    ctx: CanvasRenderingContext2D,
    atX: number,
    tipY: number,
    text: string,
    alpha: number
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '32px ui-sans-serif, system-ui, sans-serif';
    const padX = 26;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 64;
    const r = 16;
    const tailW = 15; // half-width of the tail base
    const tailDrop = 24; // how far the tail hangs below the body
    const x = atX - w / 2;
    const yBottom = tipY - tailDrop; // body's bottom edge
    const y = yBottom - h;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, yBottom - r);
    ctx.arcTo(x + w, yBottom, x + w - r, yBottom, r);
    ctx.lineTo(atX + tailW, yBottom);
    ctx.lineTo(atX, tipY); // tail tip
    ctx.lineTo(atX - tailW, yBottom);
    ctx.lineTo(x + r, yBottom);
    ctx.arcTo(x, yBottom, x, yBottom - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();

    ctx.fillStyle = 'rgba(253, 250, 242, 0.97)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(58, 45, 28, 0.85)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = '#3a2d1c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, atX, y + h / 2 + 1);
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

  function getTaskState(): TaskState {
    const numStrips = SCENES.pelto.fieldStrips?.length ?? 0;
    return {
      fetchedKuokka: kuokkaEverEquipped,
      tilledField: numStrips > 0 && clearedStrips.size >= numStrips,
      fetchedLakana: lakanaEverEquipped,
      sownField: numStrips > 0 && sownStrips.size >= numStrips,
    };
  }

  return { update, render, setSeason, setChapter, setCharacter, teleportTo, getLocationLabel, getTaskState };
}
