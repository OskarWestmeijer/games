import { models as rawModels } from 'virtual:model-manifest';
import { createViewer } from './viewer';
import { ALTITUDE_RANGE, createPlanetView } from './planet-view';
import { createPlanetInspect, DEFAULT_SUN_AZIMUTH } from './planet-inspect';
import type { TextureQuality } from './space';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!;
const list = document.querySelector<HTMLUListElement>('#gallery-list')!;
const nameLabel = document.querySelector<HTMLDivElement>('#model-name')!;
const emptyState = document.querySelector<HTMLDivElement>('#empty-state')!;
const modeSelect = document.querySelector<HTMLSelectElement>('#mode-select')!;
const assetView = document.querySelector<HTMLDivElement>('#asset-view')!;
const planetView = document.querySelector<HTMLDivElement>('#planet-view')!;
const planetCanvas = document.querySelector<HTMLCanvasElement>('#planet-canvas')!;
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

let viewer: ReturnType<typeof createViewer> | null = null;
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

type Mode = 'asset' | 'planet' | 'inspect';

/** Planet view is the default, so it gets the bare hash rather than one of its own. */
const MODE_HASHES: Record<Mode, string> = {
  planet: '#',
  inspect: '#inspect',
  asset: '#assets'
};

// Every view is built the first time it's opened rather than up front. Each is a whole
// WebGL scene, and the gallery additionally fetches a model that runs to tens of megabytes —
// no reason to pay for any of them until someone actually looks.
let planet: ReturnType<typeof createPlanetView> | null = null;
let inspect: ReturnType<typeof createPlanetInspect> | null = null;

function ensureViewer() {
  if (viewer || models.length === 0) return;
  viewer = createViewer(canvas);
  selectModel(selectedIndex);
}

/**
 * Orbit altitude. The bounds live with the view rather than in the markup — the floor is a
 * real constraint (the pod has to stay outside the atmosphere shell), not a UI preference.
 */
altitudeSlider.min = String(ALTITUDE_RANGE.min);
altitudeSlider.max = String(ALTITUDE_RANGE.max);
altitudeSlider.step = '5';
altitudeSlider.value = String(ALTITUDE_RANGE.initial);

function applyAltitude() {
  altitudeValue.textContent = altitudeSlider.value;
  planet?.setAltitude(Number(altitudeSlider.value));
}

altitudeSlider.addEventListener('input', applyAltitude);
applyAltitude();

sunSlider.value = String(Math.round(DEFAULT_SUN_AZIMUTH));
sunSlider.addEventListener('input', () => inspect?.setSunAzimuth(Number(sunSlider.value)));

/**
 * Surface map resolution, shared by both planet scenes — they are the same world, and the
 * sets are cached in `space.ts`, so switching costs one download the first time and nothing
 * after that. Not persisted: the page should always open on the cheap set.
 */
const quality = () => qualitySelect.value as TextureQuality;

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

function setMode(mode: Mode) {
  // Unhide first — the renderers measure their canvas, which is 0x0 while its container is
  // still hidden.
  assetView.hidden = mode !== 'asset';
  planetView.hidden = mode !== 'planet';
  inspectView.hidden = mode !== 'inspect';
  // Nothing in the asset view has a surface map.
  qualitySelect.hidden = mode === 'asset';

  // Park every other view's render loop, so no two WebGL scenes compete for the GPU.
  if (mode !== 'asset') viewer?.setActive(false);
  if (mode !== 'planet') planet?.stop();
  if (mode !== 'inspect') inspect?.stop();

  if (mode === 'asset') {
    ensureViewer();
    viewer?.setActive(true);
  } else if (mode === 'planet') {
    planet ??= createPlanetView(planetCanvas, {
      onLockChange: (locked) => document.body.classList.toggle('pointer-locked', locked),
      quality: quality(),
      altitude: Number(altitudeSlider.value),
      joystick: moveStick
    });
    planet.start();
  } else {
    inspect ??= createPlanetInspect(inspectCanvas, { quality: quality() });
    inspect.setSunAzimuth(Number(sunSlider.value));
    inspect.start();
  }
}

modeSelect.addEventListener('change', () => {
  const mode = modeSelect.value as Mode;
  // Reflect the mode in the URL so a view can be linked to directly. `replaceState` rather
  // than assigning `location.hash`, which would pile up history entries on every toggle.
  history.replaceState(null, '', MODE_HASHES[mode]);
  setMode(mode);
});

// Planet view is what the site opens on; the other two are one hash away.
const startMode: Mode =
  (Object.keys(MODE_HASHES) as Mode[]).find((mode) => MODE_HASHES[mode] === window.location.hash) ??
  'planet';
modeSelect.value = startMode;
setMode(startMode);
