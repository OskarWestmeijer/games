/**
 * Bootstrap, and there is not much of one.
 *
 * The game was one of five scenes behind a mode dropdown once, sharing a page, a stylesheet and
 * a renderer budget with four three.js views. It is its own site now, so this is what is left of
 * `setMode()`: find the canvas, build the view, start it. Nothing is lazy because there is
 * nothing to be lazy about — no models, no textures, no half a megabyte of renderer.
 */

import './style.css';
import { createParkView } from './park-view';

const canvas = document.querySelector<HTMLCanvasElement>('#park-canvas')!;
const park = createParkView(canvas);
park.start();

// The view stops itself when the tab is hidden: a session left mid-roll would otherwise come
// back to a car still rolling towards a bay the player has not looked at since, and `stop()`
// re-arms the round for exactly that reason.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) park.stop();
  else park.start();
});
