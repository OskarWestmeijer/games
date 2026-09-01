import * as THREE from 'three';

/**
 * The picture on the monitor: a miniature of the homepage you arrived from.
 *
 * It is drawn once into a 2D canvas rather than being a loaded image, so it costs one texture
 * upload and nothing per frame, and it stays in step with `home.css` because the colours below
 * are the same daisyUI *corporate* tokens, converted from their `oklch()` originals.
 *
 * It does not need to be legible — at the size the panel occupies in the window it reads as a
 * shape, not as text. It needs to be *recognisable*, so that a player who has just come from
 * the page knows without being told that this screen is the way back to it.
 */

/** The daisyUI corporate palette, in the sRGB hex the canvas context wants. */
const BASE_100 = '#ffffff';
const BASE_300 = '#eeeeee';
const BASE_CONTENT = '#18181b';
const PRIMARY = '#422ad5';

/** 16:10, near enough to the panel's own 0.62 x 0.38 that nothing is stretched. */
const WIDTH = 512;
const HEIGHT = 320;

/** Rounded rect, since `roundRect` is still not safe to assume across the target browsers. */
function roundedRect(
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
  ctx.fill();
}

export function makeScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const sans = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  ctx.fillStyle = BASE_100;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // --- the nav bar -----------------------------------------------------------------------
  ctx.fillStyle = BASE_CONTENT;
  ctx.font = `bold 17px ${sans}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Oskar Westmeijer', 28, 30);

  ctx.font = `11px ${sans}`;
  ctx.fillStyle = PRIMARY;
  ctx.fillText('ABOUT', 330, 30);
  ctx.fillStyle = '#6b6b73';
  ctx.fillText('PROJECTS', 392, 30);

  ctx.fillStyle = BASE_300;
  ctx.fillRect(0, 56, WIDTH, 1);

  // --- portrait + name -------------------------------------------------------------------
  // A grey block rather than the photograph: at this size it is four pixels of face, and the
  // silhouette of a portrait beside a heading is what carries the resemblance anyway.
  ctx.fillStyle = '#d8d8dc';
  roundedRect(ctx, 28, 88, 92, 92, 5);

  ctx.fillStyle = BASE_CONTENT;
  ctx.font = `bold 30px ${sans}`;
  ctx.fillText('Oskar Westmeijer', 140, 118);

  ctx.fillStyle = PRIMARY;
  ctx.font = `11px ${sans}`;
  ctx.fillText('SOFTWARE DEVELOPER · HAMBURG', 141, 150);

  ctx.fillStyle = BASE_CONTENT;
  ctx.fillRect(28, 206, 46, 2);

  // --- bio lines -------------------------------------------------------------------------
  // Bars, not sentences: real text at 9px would be a grey smear with worse rhythm than this.
  ctx.fillStyle = '#c9c9d0';
  const lineWidths = [420, 390, 436, 300];
  lineWidths.forEach((w, i) => ctx.fillRect(28, 232 + i * 15, w, 5));

  // --- the CTA ---------------------------------------------------------------------------
  // Square corners, like the `rounded-none` button the page actually uses.
  ctx.fillStyle = PRIMARY;
  ctx.fillRect(28, 292, 134, 26);
  ctx.fillStyle = '#e0e7ff';
  ctx.font = `10px ${sans}`;
  ctx.fillText('VIEW PROJECTS →', 44, 306);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
