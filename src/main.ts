import { models as rawModels } from 'virtual:model-manifest';
import { createViewer } from './viewer';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!;
const list = document.querySelector<HTMLUListElement>('#gallery-list')!;
const nameLabel = document.querySelector<HTMLDivElement>('#model-name')!;
const emptyState = document.querySelector<HTMLDivElement>('#empty-state')!;
const modeSingleBtn = document.querySelector<HTMLButtonElement>('#mode-single')!;
const modeSceneBtn = document.querySelector<HTMLButtonElement>('#mode-scene')!;

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

if (models.length === 0) {
  emptyState.hidden = false;
} else {
  const viewer = createViewer(canvas);
  let lastSingleIndex = 0;

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

    item.addEventListener('click', () => {
      lastSingleIndex = i;
      setMode('single');
    });
    list.appendChild(item);
  });

  async function selectModel(index: number) {
    const model = models[index];
    list.querySelectorAll('.gallery-item').forEach((el) => el.classList.remove('active'));
    list.querySelector(`[data-index="${index}"]`)?.classList.add('active');
    nameLabel.textContent = `${model.name} — ${model.source} — ${formatBytes(model.sizeBytes)}`;
    await viewer.load(model.url);
  }

  /** Switches between inspecting one model at a time and viewing all of them together. */
  function setMode(mode: 'single' | 'scene') {
    modeSingleBtn.classList.toggle('active', mode === 'single');
    modeSceneBtn.classList.toggle('active', mode === 'scene');
    list.classList.toggle('inert', mode === 'scene');

    if (mode === 'single') {
      selectModel(lastSingleIndex);
    } else {
      list.querySelectorAll('.gallery-item').forEach((el) => el.classList.remove('active'));
      const totalBytes = models.reduce((sum, m) => sum + m.sizeBytes, 0);
      nameLabel.textContent = `All ${models.length} models — ${formatBytes(totalBytes)} total`;
      viewer.loadScene(models);
    }
  }

  modeSingleBtn.addEventListener('click', () => setMode('single'));
  modeSceneBtn.addEventListener('click', () => setMode('scene'));

  setMode('single');
}
