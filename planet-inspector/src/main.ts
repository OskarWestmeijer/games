import './style.css';
import { createPlanetInspect, DEFAULT_SUN_AZIMUTH } from './planet-inspect';

/**
 * One view, one page. This was one of four modes behind a dropdown; the flight game, the
 * space station and the asset gallery are their own projects now (see the repo root).
 *
 * The inspector keeps its sun slider where the station does not: it is a study tool, not a
 * place, and there is nobody in it to walk to a console. The knob's opening value comes from
 * the view module rather than the markup, so it starts where the sun actually is.
 */
const inspectCanvas = document.querySelector<HTMLCanvasElement>('#inspect-canvas')!;
const sunSlider = document.querySelector<HTMLInputElement>('#sun-azimuth')!;
const qualitySelect = document.querySelector<HTMLSelectElement>('#texture-quality')!;

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

sunSlider.value = String(Math.round(DEFAULT_SUN_AZIMUTH));

const inspect = createPlanetInspect(inspectCanvas, { quality: quality() });
inspect.setSunAzimuth(Number(sunSlider.value));

sunSlider.addEventListener('input', () => inspect.setSunAzimuth(Number(sunSlider.value)));

qualitySelect.addEventListener('change', async () => {
  // A couple of megabytes; disabling the select is both the progress indication and what
  // stops a second change being fired mid-download.
  qualitySelect.disabled = true;
  try {
    await inspect.setTextureQuality(quality());
  } finally {
    qualitySelect.disabled = false;
  }
});

/**
 * A lost context takes the whole scene with it and three.js will not silently rebuild it.
 * Stop the loop first — it would otherwise keep calling into a dead context every frame.
 * There is nowhere to navigate to and back from any more, so recovering is a reload.
 */
inspectCanvas.addEventListener('webglcontextlost', () => inspect.stop());

inspect.start();
