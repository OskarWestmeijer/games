import './style.css';
import { createInput } from './input';
import { createFarmScene } from './farmScene';
import { startAudio, toggleMute } from './audio';

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

const scene = createFarmScene();
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

let last = performance.now();
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp after tab-out etc.

  scene.update(input, dt);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scene.render(ctx, window.innerWidth, window.innerHeight);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
