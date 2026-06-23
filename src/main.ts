import './style.css';
import { createInput } from './input';
import { createSceneManager, listSceneIds, type SceneId } from './scenes';
import { startAudio, toggleMute } from './audio';
import { CHAPTERS } from './chapters';
import { CHARACTERS } from './characters';
import { createIntro } from './intro';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;

let dpr = 1;
function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize);
resize();

const scene = createSceneManager();
const input = createInput();
const intro = createIntro();

// Chapter + character dropdowns — always visible, switchable at any time (see
// "Active build" in CLAUDE.md). Chapter only swaps which seasonal scene art is shown
// for now; it isn't wired to gameplay/days yet.
const adminToggle = document.getElementById('admin-toggle') as HTMLButtonElement;
const uiPanel = document.getElementById('ui-panel') as HTMLDivElement;
const sceneSelect = document.getElementById('scene-select') as HTMLSelectElement;
const chapterSelect = document.getElementById('chapter-select') as HTMLSelectElement;
const characterSelect = document.getElementById('character-select') as HTMLSelectElement;
const chapterTitleEl = document.getElementById('chapter-info-title')!;
const chapterMonthsEl = document.getElementById('chapter-info-months')!;
const chapterDescEl = document.getElementById('chapter-info-desc')!;

adminToggle.addEventListener('click', () => {
  uiPanel.hidden = !uiPanel.hidden;
});

for (const s of listSceneIds()) {
  const opt = document.createElement('option');
  opt.value = s.id;
  opt.textContent = s.label;
  sceneSelect.appendChild(opt);
}
for (const ch of CHAPTERS) {
  const opt = document.createElement('option');
  opt.value = String(ch.id);
  opt.textContent = `${ch.id}. ${ch.title}`;
  chapterSelect.appendChild(opt);
}
for (const c of CHARACTERS) {
  const opt = document.createElement('option');
  opt.value = c.id;
  opt.textContent = c.label;
  characterSelect.appendChild(opt);
}

sceneSelect.addEventListener('change', () => scene.teleportTo(sceneSelect.value as SceneId));

function applyChapter(id: number): void {
  const chapter = CHAPTERS.find((c) => c.id === id) ?? CHAPTERS[0];
  scene.setSeason(chapter.season);
  scene.setChapter(chapter.id);
  chapterTitleEl.textContent = chapter.title;
  chapterMonthsEl.textContent = chapter.months;
  chapterDescEl.textContent = chapter.description;
}

chapterSelect.addEventListener('change', () => applyChapter(Number(chapterSelect.value)));
characterSelect.addEventListener('change', () => scene.setCharacter(characterSelect.value));

applyChapter(CHAPTERS[0].id);
characterSelect.value = CHARACTERS[0].id;
sceneSelect.value = 'pihapiiri';

// Always-on location HUD, top-left — distinct from the admin panel above: this one is
// in-world UI, kept in sync with whichever scene Jussi is currently standing in.
const locationText = document.getElementById('location-text')!;
let lastLocationLabel = '';

// Audio starts on the first user gesture (browser autoplay policy); M toggles it.
const hint = document.getElementById('hint');
function kickAudio(): void {
  startAudio();
  window.removeEventListener('keydown', kickAudio);
  window.removeEventListener('pointerdown', kickAudio);
}
window.addEventListener('keydown', kickAudio);
window.addEventListener('pointerdown', kickAudio);
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') {
    const m = toggleMute();
    if (hint) hint.textContent = m ? 'music off (M)' : 'music on (M)';
  }
});

let last = performance.now();
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp after tab-out etc.

  // Held off while the title/chapter-intro overlay covers the screen, so Jussi can't
  // be walked around, off-screen, before the player has even seen the world.
  if (!intro.isActive()) scene.update(input, dt);

  const label = scene.getLocationLabel();
  if (label !== lastLocationLabel) {
    lastLocationLabel = label;
    locationText.textContent = label;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scene.render(ctx, window.innerWidth, window.innerHeight);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
