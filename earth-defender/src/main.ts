import './style.css';
import { createFlyView } from './fly-view';

/**
 * One view, one page. This was a mode dropdown over four scenes sharing a renderer budget;
 * the station, the inspector and the asset gallery are their own projects now (see the repo
 * root), so there is nothing to switch to, nothing to hide and no hash to read. What is left
 * is: find the elements, pick a map resolution, build the view, start it.
 *
 * Everything is imported statically for the same reason it used to be dynamic — three.js is
 * half a megabyte, and the argument for deferring it was that you might never ask for a scene
 * that needed it. Here you always do.
 */
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

const fly = createFlyView(flyCanvas, {
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

qualitySelect.addEventListener('change', async () => {
  // A couple of megabytes; disabling the select is both the progress indication and what
  // stops a second change being fired mid-download.
  qualitySelect.disabled = true;
  try {
    await fly.setTextureQuality(quality());
  } finally {
    qualitySelect.disabled = false;
  }
});

/**
 * A lost context takes the whole scene with it and three.js will not silently rebuild it.
 * Stop the loop first — it would otherwise keep calling into a dead context every frame.
 * There is nowhere to navigate to and back from any more, so recovering is a reload.
 */
flyCanvas.addEventListener('webglcontextlost', () => fly.stop());

fly.start();
