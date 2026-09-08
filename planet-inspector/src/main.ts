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

/**
 * There is no surface-resolution control any more, and no device that gets a smaller map.
 * The 8K set — 2.9 MB, and ~180 MB of texture on the GPU — is the only one `space.ts` has,
 * because this project is a lens on the planet and quietly handing a thumb-held device the
 * blurrier planet is the one thing a lens must not do. The select, the `saveData` sniff and
 * the `any-pointer: coarse` downgrade that used to live here all went with it.
 *
 * What survives of that caution is the pixel-ratio cap in `planet-inspect.ts`, which costs
 * nothing to look at.
 */
sunSlider.value = String(Math.round(DEFAULT_SUN_AZIMUTH));

const inspect = createPlanetInspect(inspectCanvas);
inspect.setSunAzimuth(Number(sunSlider.value));

sunSlider.addEventListener('input', () => inspect.setSunAzimuth(Number(sunSlider.value)));

/**
 * A lost context takes the whole scene with it and three.js will not silently rebuild it.
 * Stop the loop first — it would otherwise keep calling into a dead context every frame.
 * There is nowhere to navigate to and back from any more, so recovering is a reload.
 */
inspectCanvas.addEventListener('webglcontextlost', () => inspect.stop());

inspect.start();
