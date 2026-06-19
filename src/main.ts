import './style.css';
import { generateWorld } from './world';
import { createInput } from './input';
import { update } from './update';
import { render } from './render';
import { startAudio, toggleMute } from './audio';
import type { GameState } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;

// Camera zoom — keep the character a clear presence, landscape large around it.
// Higher = closer. See inspiration/art-style (Pentiment sits close).
const ZOOM = 2.85;

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

const world = generateWorld(52, 52);
const input = createInput();

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
const state: GameState = {
  world,
  player: world.player,
  camera: { x: world.player.wx, y: world.player.wy },
  time: 0
};

let last = performance.now();
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp after tab-out etc.
  state.time += dt;

  update(state, input, dt);

  // Scale by ZOOM on top of DPR; pass the (smaller) logical viewport so the world
  // is centred and culled correctly while everything is drawn larger / closer.
  ctx.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, 0, 0);
  render(ctx, state, window.innerWidth / ZOOM, window.innerHeight / ZOOM);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
