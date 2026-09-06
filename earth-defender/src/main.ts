import { models as rawModels } from 'virtual:model-manifest';
import './style.css';

// Types only — `import type` is erased at build time, so none of this pulls three.js into the
// initial chunk. Every one of these modules is reached through a dynamic `import()` below.
import type { createViewer } from './viewer';
import type { createPlanetView } from './planet-view';
import type { createPlanetInspect } from './planet-inspect';
import type { createFlyView } from './fly-view';

type Viewer = ReturnType<typeof createViewer>;
type PlanetView = ReturnType<typeof createPlanetView>;
type PlanetInspect = ReturnType<typeof createPlanetInspect>;
type FlyView = ReturnType<typeof createFlyView>;
type PlanetModule = typeof import('./planet-view');

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!;
const list = document.querySelector<HTMLUListElement>('#gallery-list')!;
const nameLabel = document.querySelector<HTMLDivElement>('#model-name')!;
const emptyState = document.querySelector<HTMLDivElement>('#empty-state')!;
const modeSelect = document.querySelector<HTMLSelectElement>('#mode-select')!;
const assetView = document.querySelector<HTMLDivElement>('#asset-view')!;
const planetView = document.querySelector<HTMLDivElement>('#planet-view')!;
const planetCanvas = document.querySelector<HTMLCanvasElement>('#planet-canvas')!;
const interactPrompt = document.querySelector<HTMLButtonElement>('#interact-prompt')!;
const inspectView = document.querySelector<HTMLDivElement>('#inspect-view')!;
const inspectCanvas = document.querySelector<HTMLCanvasElement>('#inspect-canvas')!;
const sunSlider = document.querySelector<HTMLInputElement>('#sun-azimuth')!;
const flyView = document.querySelector<HTMLDivElement>('#fly-view')!;
const flyCanvas = document.querySelector<HTMLCanvasElement>('#fly-canvas')!;
const flySpeed = document.querySelector<HTMLSpanElement>('#fly-speed')!;
const flyAltitude = document.querySelector<HTMLSpanElement>('#fly-altitude')!;
const flyDowned = document.querySelector<HTMLSpanElement>('#fly-downed')!;
const flyAmmo = document.querySelector<HTMLSpanElement>('#fly-ammo')!;
const flyRockets = document.querySelector<HTMLSpanElement>('#fly-rockets')!;
const flyLost = document.querySelector<HTMLSpanElement>('#fly-lost')!;
const flyMarker = document.querySelector<SVGSVGElement>('#minimap-plane')!;
const flyContact = document.querySelector<SVGSVGElement>('#minimap-ufo')!;
const flyPost = document.querySelector<SVGSVGElement>('#minimap-post')!;
const flyReticle = document.querySelector<HTMLDivElement>('#fly-reticle')!;
const flyPaths = document.querySelector<SVGSVGElement>('#minimap-paths')!;
const flyAlerts = document.querySelector<HTMLDivElement>('#fly-alerts')!;
const flyBomberHealth = document.querySelector<HTMLDivElement>('#fly-bomber-health')!;
const flyPlaneHealth = document.querySelector<HTMLDivElement>('#fly-plane-health')!;
const flySpaceLabel = document.querySelector<HTMLSpanElement>('#fly-space-label')!;
const flyPlaneHealthFill = document.querySelector<HTMLDivElement>('#fly-plane-health-fill')!;
const flyMessage = document.querySelector<HTMLDivElement>('#fly-message')!;
const flyMessageText = document.querySelector<HTMLSpanElement>('#fly-message .message-text')!;
const qualitySelect = document.querySelector<HTMLSelectElement>('#texture-quality')!;
const moveStick = document.querySelector<HTMLDivElement>('#move-stick')!;

/**
 * Manifest URLs are publicDir-relative with no leading slash (see `ModelEntry` in
 * vite.config.ts) — resolve them against the deployed base path (e.g. "/games/" on
 * GitHub Pages) rather than the domain root, the same way the old game's audio player
 * did for its track paths.
 */
function withBase(path: string): string {
  return import.meta.env.BASE_URL + path;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

// Resolve manifest paths against the deployed base path once, up front.
const models = rawModels.map((m) => ({
  ...m,
  url: withBase(m.url),
  thumbnail: m.thumbnail ? withBase(m.thumbnail) : null
}));

let viewer: Viewer | null = null;
let selectedIndex = 0;

if (models.length === 0) {
  emptyState.hidden = false;
} else {
  models.forEach((model, i) => {
    const item = document.createElement('li');
    item.className = 'gallery-item';
    item.dataset.index = String(i);

    if (model.thumbnail) {
      const img = document.createElement('img');
      img.className = 'gallery-thumb';
      img.src = model.thumbnail;
      img.alt = '';
      item.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'gallery-thumb placeholder';
      placeholder.textContent = '3D';
      item.appendChild(placeholder);
    }

    const meta = document.createElement('div');
    meta.className = 'gallery-meta';
    const name = document.createElement('div');
    name.className = 'gallery-name';
    name.textContent = model.name;
    const source = document.createElement('div');
    source.className = 'gallery-source';
    source.textContent = `${model.source} · ${formatBytes(model.sizeBytes)}`;
    meta.append(name, source);
    item.appendChild(meta);

    item.addEventListener('click', () => selectModel(i));
    list.appendChild(item);
  });
}

/**
 * Highlights a gallery entry and loads it. Safe to call before the viewer exists — the
 * selection is remembered in `selectedIndex` and picked up by `ensureViewer()`.
 */
async function selectModel(index: number) {
  selectedIndex = index;
  const model = models[index];
  list.querySelectorAll('.gallery-item').forEach((el) => el.classList.remove('active'));
  list.querySelector(`[data-index="${index}"]`)?.classList.add('active');
  nameLabel.textContent = `${model.name} — ${model.source} — ${formatBytes(model.sizeBytes)}`;
  await viewer?.load(model.url);
}

type Mode = 'asset' | 'planet' | 'inspect' | 'fly';

/** Flight view is what the site opens on, so it takes the bare hash — it took `#fly` while the
 *  parking game was the landing view here, and that game is its own project now. Listed in the
 *  dropdown's own order, which is not load-bearing: the hashes are unique, so the reverse lookup
 *  below cannot care. */
const MODE_HASHES: Record<Mode, string> = {
  fly: '#',
  planet: '#planet',
  inspect: '#inspect',
  asset: '#assets'
};

// Every view is built the first time it's opened rather than up front. Each is a whole
// WebGL scene, and the gallery additionally fetches a model that runs to tens of megabytes —
// no reason to pay for any of them until someone actually looks.
let planet: PlanetView | null = null;
let inspect: PlanetInspect | null = null;
let fly: FlyView | null = null;
let currentMode: Mode = 'fly';

/**
 * The world's modules, fetched once. `planet-view` and `planet-inspect` share three.js and
 * `space.ts`, so Vite emits one chunk for the pair and whichever is asked for first pays.
 */
let planetModule: Promise<PlanetModule> | null = null;
const loadPlanetModule = () => (planetModule ??= import('./planet-view'));

/**
 * The sun slider's opening value comes from the view module rather than the markup, so the
 * knob starts where the sun actually is.
 *
 * Planet view has no slider left to configure. Altitude, attitude, orbit mode and the clock
 * are on the navigation console you walk to — deleting UI rather than adding it, and the
 * reason the station has a navigation room at all. The inspector keeps its sun slider: it is
 * a study tool, not a place, and there is nobody in it to walk anywhere.
 */
let worldUiReady = false;

async function initWorldUi() {
  if (worldUiReady) return;
  worldUiReady = true;
  const { DEFAULT_SUN_AZIMUTH } = await import('./planet-inspect');
  sunSlider.value = String(Math.round(DEFAULT_SUN_AZIMUTH));
}

sunSlider.addEventListener('input', () => inspect?.setSunAzimuth(Number(sunSlider.value)));

/**
 * Surface map resolution, shared by both planet scenes — they are the same world, and the
 * sets are cached in `space.ts`, so switching costs one download the first time and nothing
 * after that. Not persisted.
 *
 * The 8K set is 2.9 MB and ~180 MB of texture per renderer. That is a fair price when you
 * came to look at the planet, and not one to charge on a coarse-pointer or data-saving device,
 * which opens on 4K instead. `NetworkInformation` is not in `lib.dom`, hence the local shape.
 */
const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
  .connection;
const SLOW_CONNECTION =
  !!connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '');
if (SLOW_CONNECTION || window.matchMedia('(any-pointer: coarse)').matches) {
  qualitySelect.value = '4k';
}

const quality = () => qualitySelect.value as '4k' | '8k';

qualitySelect.addEventListener('change', async () => {
  // 8K is a couple of megabytes; disabling the whole switcher is both the progress
  // indication and what stops a second change being fired mid-download.
  const switches = [modeSelect, qualitySelect];
  switches.forEach((el) => (el.disabled = true));
  try {
    await Promise.all([
      planet?.setTextureQuality(quality()),
      inspect?.setTextureQuality(quality()),
      fly?.setTextureQuality(quality())
    ]);
  } finally {
    switches.forEach((el) => (el.disabled = false));
  }
});

async function ensureViewer() {
  if (viewer || models.length === 0) return;
  const { createViewer } = await import('./viewer');
  viewer ??= createViewer(canvas);
  selectModel(selectedIndex);
}

async function ensurePlanet(): Promise<PlanetView> {
  const { createPlanetView } = await loadPlanetModule();
  await initWorldUi();
  planet ??= createPlanetView(planetCanvas, {
    onLockChange: (locked) => document.body.classList.toggle('pointer-locked', locked),
    quality: quality(),
    joystick: moveStick,
    interactPrompt
  });
  return planet;
}

async function setMode(mode: Mode) {
  currentMode = mode;

  // Unhide first — the renderers measure their canvas, which is 0x0 while its container is
  // still hidden.
  assetView.hidden = mode !== 'asset';
  planetView.hidden = mode !== 'planet';
  inspectView.hidden = mode !== 'inspect';
  flyView.hidden = mode !== 'fly';
  // Nothing in the asset view has a surface map.
  qualitySelect.hidden = mode === 'asset';
  modeSelect.value = mode;

  // Park every other view's render loop, so no two WebGL scenes compete for the GPU.
  if (mode !== 'asset') viewer?.setActive(false);
  if (mode !== 'planet') planet?.stop();
  if (mode !== 'inspect') inspect?.stop();
  if (mode !== 'fly') fly?.stop();

  if (mode === 'asset') {
    await ensureViewer();
    viewer?.setActive(true);
  } else if (mode === 'planet') {
    const view = await ensurePlanet();
    view.start();
  } else if (mode === 'inspect') {
    const { createPlanetInspect } = await import('./planet-inspect');
    await initWorldUi();
    inspect ??= createPlanetInspect(inspectCanvas, { quality: quality() });
    inspect.setSunAzimuth(Number(sunSlider.value));
    inspect.start();
  } else if (mode === 'fly') {
    const { createFlyView } = await import('./fly-view');
    fly ??= createFlyView(flyCanvas, {
      quality: quality(),
      speedLabel: flySpeed,
      altitudeLabel: flyAltitude,
      downedLabel: flyDowned,
      ammoLabel: flyAmmo,
      rocketLabel: flyRockets,
      lostLabel: flyLost,
      planeMarker: flyMarker,
      ufoMarker: flyContact,
      postMarker: flyPost,
      reticle: flyReticle,
      mapOverlay: flyPaths,
      alertPanel: flyAlerts,
      bomberHealthLayer: flyBomberHealth,
      planeHealthBar: flyPlaneHealth,
      planeHealthFill: flyPlaneHealthFill,
      spaceLabel: flySpaceLabel,
      messagePanel: flyMessage,
      messageText: flyMessageText
    });
    fly.start();
  }
}

/** Reflects the mode in the URL and switches to it. `replaceState` rather than assigning
 *  `location.hash`, which would pile up a history entry on every toggle. */
function goTo(mode: Mode) {
  history.replaceState(null, '', MODE_HASHES[mode]);
  void setMode(mode);
}

// A lost context takes everything with it, and three.js will not silently rebuild the scene.
planetCanvas.addEventListener('webglcontextlost', () => {
  // Stop the loop first: it would otherwise keep calling into a dead context every frame.
  planet?.stop();
  planet = null;
});

flyCanvas.addEventListener('webglcontextlost', () => {
  fly?.stop();
  fly = null;
});

modeSelect.addEventListener('change', () => goTo(modeSelect.value as Mode));

// Flight view is what the site opens on; the station, the inspector and the asset view are one
// hash away. Note that a bare URL has an empty `location.hash`, not "#", so the lookup below
// misses and the `??` supplies the same answer.
const startMode: Mode =
  (Object.keys(MODE_HASHES) as Mode[]).find((mode) => MODE_HASHES[mode] === window.location.hash) ??
  'fly';
void setMode(startMode);
