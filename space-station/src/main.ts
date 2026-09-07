import './style.css';
import { createPlanetView } from './planet-view';

/**
 * One view, one page. This was one of four modes behind a dropdown; the flight game, the
 * planet inspector and the asset gallery are their own projects now (see the repo root), so
 * there is nothing to switch to and no hash to read.
 *
 * Note what is *not* here: no altitude, attitude, orbit-mode or clock control. Those are keys
 * on the navigation console you walk to (`station/console.ts`), which is the reason the
 * station has a navigation room at all. The map-resolution select is the one exception — it
 * is a download, not something the station does.
 */
const planetCanvas = document.querySelector<HTMLCanvasElement>('#planet-canvas')!;
const interactPrompt = document.querySelector<HTMLButtonElement>('#interact-prompt')!;
const qualitySelect = document.querySelector<HTMLSelectElement>('#texture-quality')!;
const moveStick = document.querySelector<HTMLDivElement>('#move-stick')!;

/**
 * Surface map resolution. The 8K set is 2.9 MB and ~180 MB of texture on the GPU — a fair
 * price when you came to look at the planet, and not one to charge on a coarse-pointer or
 * data-saving device, which opens on 4K instead. `NetworkInformation` is not in `lib.dom`,
 * hence the local shape. Not persisted.
 */
const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
  .connection;
const SLOW_CONNECTION =
  !!connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '');
if (SLOW_CONNECTION || window.matchMedia('(any-pointer: coarse)').matches) {
  qualitySelect.value = '4k';
}

const quality = () => qualitySelect.value as '4k' | '8k';

const planet = createPlanetView(planetCanvas, {
  onLockChange: (locked) => document.body.classList.toggle('pointer-locked', locked),
  quality: quality(),
  joystick: moveStick,
  interactPrompt
});

qualitySelect.addEventListener('change', async () => {
  // A couple of megabytes; disabling the select is both the progress indication and what
  // stops a second change being fired mid-download.
  qualitySelect.disabled = true;
  try {
    await planet.setTextureQuality(quality());
  } finally {
    qualitySelect.disabled = false;
  }
});

/**
 * A lost context takes the whole scene with it and three.js will not silently rebuild it.
 * Stop the loop first — it would otherwise keep calling into a dead context every frame.
 * There is nowhere to navigate to and back from any more, so recovering is a reload.
 */
planetCanvas.addEventListener('webglcontextlost', () => planet.stop());

planet.start();
