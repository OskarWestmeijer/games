import { models as rawModels } from 'virtual:model-manifest';
import { initHomepage } from './home';
import './style.css';

// Types only — `import type` is erased at build time, so none of this pulls three.js into the
// initial chunk. Every one of these modules is reached through a dynamic `import()` below.
import type { createViewer } from './viewer';
import type { createPlanetView } from './planet-view';
import type { createPlanetInspect } from './planet-inspect';

type Viewer = ReturnType<typeof createViewer>;
type PlanetView = ReturnType<typeof createPlanetView>;
type PlanetInspect = ReturnType<typeof createPlanetInspect>;
type PlanetModule = typeof import('./planet-view');

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!;
const list = document.querySelector<HTMLUListElement>('#gallery-list')!;
const nameLabel = document.querySelector<HTMLDivElement>('#model-name')!;
const emptyState = document.querySelector<HTMLDivElement>('#empty-state')!;
const modeSwitcher = document.querySelector<HTMLDivElement>('#mode-switcher')!;
const modeSelect = document.querySelector<HTMLSelectElement>('#mode-select')!;
const homeView = document.querySelector<HTMLDivElement>('#home-view')!;
const getUp = document.querySelector<HTMLButtonElement>('#get-up')!;
const getUpLabel = document.querySelector<HTMLSpanElement>('#get-up-label')!;
const assetView = document.querySelector<HTMLDivElement>('#asset-view')!;
const planetView = document.querySelector<HTMLDivElement>('#planet-view')!;
const planetCanvas = document.querySelector<HTMLCanvasElement>('#planet-canvas')!;
const interactPrompt = document.querySelector<HTMLButtonElement>('#interact-prompt')!;
const inspectView = document.querySelector<HTMLDivElement>('#inspect-view')!;
const inspectCanvas = document.querySelector<HTMLCanvasElement>('#inspect-canvas')!;
const sunSlider = document.querySelector<HTMLInputElement>('#sun-azimuth')!;
const qualitySelect = document.querySelector<HTMLSelectElement>('#texture-quality')!;
const altitudeSlider = document.querySelector<HTMLInputElement>('#orbit-altitude')!;
const moveStick = document.querySelector<HTMLDivElement>('#move-stick')!;
const altitudeValue = document.querySelector<HTMLSpanElement>('#altitude-value')!;

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

initHomepage(homeView);

type Mode = 'home' | 'asset' | 'planet' | 'inspect';

/**
 * The homepage stand-in is what the site opens on now, so it takes the bare hash and planet
 * view moves to one of its own. That inversion is the whole point of the prototype: the world
 * has to be something you arrive at from a page, not the page itself.
 */
const MODE_HASHES: Record<Mode, string> = {
  home: '#',
  planet: '#pod',
  inspect: '#inspect',
  asset: '#assets'
};

// Every view is built the first time it's opened rather than up front. Each is a whole
// WebGL scene, and the gallery additionally fetches a model that runs to tens of megabytes —
// no reason to pay for any of them until someone actually looks.
let planet: PlanetView | null = null;
let inspect: PlanetInspect | null = null;
let currentMode: Mode = 'home';

/**
 * Whether this browser can render any of it at all. Worth the three lines: without the check,
 * a browser with WebGL disabled would download three quarters of a megabyte of three.js in
 * the background purely to find out it can't use it.
 */
const WEBGL_AVAILABLE = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
})();

/**
 * Whether to fetch the world before it is asked for. An easter egg does not get to spend
 * somebody's metered data uninvited, so on a save-data or slow connection the button is live
 * from the start and the wait happens on the click, where it is at least explained.
 * `NetworkInformation` is not in `lib.dom`, hence the local shape.
 */
const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
  .connection;
const PRELOAD_OK =
  WEBGL_AVAILABLE &&
  !connection?.saveData &&
  !['slow-2g', '2g'].includes(connection?.effectiveType ?? '');

/**
 * The world's modules, fetched once. `planet-view` and `planet-inspect` share three.js and
 * `space.ts`, so Vite emits one chunk for the pair and whichever is asked for first pays.
 */
let planetModule: Promise<PlanetModule> | null = null;
const loadPlanetModule = () => (planetModule ??= import('./planet-view'));

/**
 * The sliders' bounds come from the view module, not from the markup — the altitude floor is
 * a real constraint (the pod has to stay outside the atmosphere shell), not a UI preference.
 * They can only be configured once that module has loaded, which is fine: both sliders live
 * inside HUDs that are hidden until their view is open.
 */
let worldUiReady = false;

async function initWorldUi() {
  if (worldUiReady) return;
  worldUiReady = true;
  const [{ ALTITUDE_RANGE }, { DEFAULT_SUN_AZIMUTH }] = await Promise.all([
    loadPlanetModule(),
    import('./planet-inspect')
  ]);

  altitudeSlider.min = String(ALTITUDE_RANGE.min);
  altitudeSlider.max = String(ALTITUDE_RANGE.max);
  altitudeSlider.step = '5';
  altitudeSlider.value = String(ALTITUDE_RANGE.initial);
  altitudeValue.textContent = altitudeSlider.value;

  sunSlider.value = String(Math.round(DEFAULT_SUN_AZIMUTH));
}

altitudeSlider.addEventListener('input', () => {
  altitudeValue.textContent = altitudeSlider.value;
  planet?.setAltitude(Number(altitudeSlider.value));
});

sunSlider.addEventListener('input', () => inspect?.setSunAzimuth(Number(sunSlider.value)));

/**
 * Surface map resolution, shared by both planet scenes — they are the same world, and the
 * sets are cached in `space.ts`, so switching costs one download the first time and nothing
 * after that. Not persisted.
 *
 * The 8K set is 2.9 MB and ~180 MB of texture per renderer. That is a fair price when you
 * came to look at the planet, and not one to charge in the background of a page someone is
 * reading on a phone — so a coarse-pointer or data-saving device opens on 4K instead.
 */
if (!PRELOAD_OK || window.matchMedia('(any-pointer: coarse)').matches) {
  qualitySelect.value = '4k';
}

const quality = () => qualitySelect.value as '4k' | '8k';

qualitySelect.addEventListener('change', async () => {
  // 8K is a couple of megabytes; disabling the whole switcher is both the progress
  // indication and what stops a second change being fired mid-download.
  const switches = [modeSelect, qualitySelect];
  switches.forEach((el) => (el.disabled = true));
  try {
    await Promise.all([planet?.setTextureQuality(quality()), inspect?.setTextureQuality(quality())]);
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
    altitude: Number(altitudeSlider.value),
    joystick: moveStick,
    interactPrompt,
    onExit: leaveWorld
  });
  return planet;
}

/**
 * @param fromGesture Whether this switch is happening inside a click or a `change` — which is
 * the only time the browser will hand over the pointer lock. Entering the pod from the button
 * should put you straight into first person rather than dropping you in the room to click
 * again; entering it from a bare `#pod` URL has no gesture to spend and simply doesn't.
 */
async function setMode(mode: Mode, fromGesture = false) {
  currentMode = mode;

  // Unhide first — the renderers measure their canvas, which is 0x0 while its container is
  // still hidden.
  homeView.hidden = mode !== 'home';
  assetView.hidden = mode !== 'asset';
  planetView.hidden = mode !== 'planet';
  inspectView.hidden = mode !== 'inspect';
  // Nothing in the asset view or on the homepage has a surface map.
  qualitySelect.hidden = mode === 'asset' || mode === 'home';
  // The homepage is pretending to be a website; a dropdown reading "Planet View / Planet
  // Inspector" in its corner undoes that in one glance, and it has no counterpart on the real
  // site. Kept in dev, where the other views need to stay one click away.
  modeSwitcher.hidden = mode === 'home' && !import.meta.env.DEV;
  // The 3D views are a fixed full-screen canvas; the homepage is a document that scrolls and
  // whose text you can select. See the `body.world-mode` rules in style.css.
  document.body.classList.toggle('world-mode', mode !== 'home');
  modeSelect.value = mode;

  // Park every other view's render loop, so no two WebGL scenes compete for the GPU.
  if (mode !== 'asset') viewer?.setActive(false);
  if (mode !== 'planet') planet?.stop();
  if (mode !== 'inspect') inspect?.stop();

  if (mode === 'asset') {
    await ensureViewer();
    viewer?.setActive(true);
  } else if (mode === 'planet') {
    const view = await ensurePlanet();
    view.start();
    // Only microtasks have passed since the click when the world is already warmed, so the
    // gesture is still live. If it isn't — a slow path, or no Pointer Lock API at all — this
    // is a no-op and the player clicks the canvas as before.
    if (fromGesture) view.capturePointer();
    markWorldReady();
  } else if (mode === 'inspect') {
    const { createPlanetInspect } = await import('./planet-inspect');
    await initWorldUi();
    inspect ??= createPlanetInspect(inspectCanvas, { quality: quality() });
    inspect.setSunAzimuth(Number(sunSlider.value));
    inspect.start();
  }
}

/** Reflects the mode in the URL and switches to it. `replaceState` rather than assigning
 *  `location.hash`, which would pile up a history entry on every toggle. */
function goTo(mode: Mode) {
  history.replaceState(null, '', MODE_HASHES[mode]);
  void setMode(mode, true);
}

/**
 * Sitting back down at the desk. `stop()` first, and only then reveal the page: it disables
 * the controls, which releases the pointer lock, and the browser can deliver a stray `click`
 * to the canvas as that lock drops. With the controls already disabled that click is a no-op;
 * the other way round it re-locks and the player is thrown back into the room.
 */
function leaveWorld() {
  planet?.stop();
  goTo('home');
}

// --- preloading the world ------------------------------------------------------------------
// The homepage is the product and the easter egg is not, so nothing here runs until the page
// has loaded and the main thread is idle. Then the whole scene is built, compiled and warmed
// in an 8-pixel corner (see `#planet-view.warming`), and only then does the button come alive.
// Every cost that would otherwise land on the click — the chunk, 1-3 MB of surface maps,
// shader compilation, texture upload — is paid here, where nobody is waiting on it.

const READY_LABEL = 'Get up and look around';

/**
 * The button is a promise that clicking it will not stall, so it comes alive exactly when the
 * world can be entered instantly. That is either once the warm-up finishes, or — landing
 * straight on `#pod`, where there is nothing to preload — the moment the view is running, so
 * that sitting back down leaves a live button behind rather than a dead one.
 */
function markWorldReady() {
  getUp.disabled = false;
  getUp.classList.add('ready');
  getUpLabel.textContent = READY_LABEL;
}

async function preloadWorld() {
  // Never warm a view somebody is already looking at. Warming shrinks the container to eight
  // pixels, and a renderer that resizes itself down while it is on screen stays that way —
  // the full-size render only comes back on the next `start()`. Landing straight on `#pod`
  // is exactly that case: the view is open before the idle callback ever fires.
  // Read through a function, not the variable: the early return would otherwise narrow
  // `currentMode` for the rest of the body, and the mode can change during the awaits below.
  const showingWorld = () => currentMode === 'planet';
  if (planet || showingWorld() || !WEBGL_AVAILABLE) return;
  planetView.hidden = false;
  planetView.classList.add('warming');
  try {
    await (await ensurePlanet()).warm();
  } finally {
    planetView.classList.remove('warming');
    if (showingWorld()) {
      // The view was opened while it was being warmed in the corner. Its container is full
      // size again but the renderer is still eight pixels across, and `start()` — which is
      // what normally re-measures — has already run.
      window.dispatchEvent(new Event('resize'));
    } else {
      planetView.hidden = true;
    }
  }
  markWorldReady();
}

getUp.addEventListener('click', async () => {
  if (!planet) {
    // Only reachable on the save-data path, where nothing was prefetched. Drop back to the
    // booting look so the wait is visible rather than a button that just stops responding.
    getUp.disabled = true;
    getUp.classList.remove('ready');
    getUpLabel.textContent = 'Spinning up the orbit';
    await preloadWorld();
  }
  goTo('planet');
});

// A lost context takes everything warmed with it, and three.js will not silently rebuild the
// scene. Say so rather than leaving a button that does nothing.
planetCanvas.addEventListener('webglcontextlost', () => {
  // Stop the loop first: it would otherwise keep calling into a dead context every frame.
  planet?.stop();
  planet = null;
  getUp.disabled = true;
  getUp.classList.remove('ready');
  getUpLabel.textContent = 'Reload to look around';
  if (currentMode === 'planet') goTo('home');
});

if (!WEBGL_AVAILABLE) {
  getUp.hidden = true;
} else if (PRELOAD_OK) {
  window.addEventListener(
    'load',
    () => {
      const go = () => void preloadWorld();
      if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 });
      else setTimeout(go, 300);
    },
    { once: true }
  );
} else {
  // Nothing was prefetched, so the wait moves to the click.
  getUp.disabled = false;
}

modeSelect.addEventListener('change', () => goTo(modeSelect.value as Mode));

// The homepage is what the site opens on; the three 3D views are one hash away. Note that a
// bare URL has an empty `location.hash`, not "#", so the lookup below misses and the `??`
// supplies the same answer.
const startMode: Mode =
  (Object.keys(MODE_HASHES) as Mode[]).find((mode) => MODE_HASHES[mode] === window.location.hash) ??
  'home';
void setMode(startMode);
