/**
 * Particles and screen shake.
 *
 * One fixed pool made once and parked, the rule `fly/bolts.ts` was written under: a game whose
 * whole feel is the instant between a tap and a result must not stop to allocate in the middle of
 * it. Nothing here is a physics system — everything is a thrown dot with gravity, a lifetime and
 * a fade, which is all a puff of dust or a burst of confetti has ever been.
 *
 * The shake is here rather than in the drawing code because it is applied to the board transform,
 * before anything is drawn, and because it decays on the same clock the particles do.
 */

import { COLORS } from './board';

type Shape = 'dot' | 'chip';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  drag: number;
  angle: number;
  spin: number;
  color: string;
  shape: Shape;
}

const POOL = 180;
const GROUND_FADE = 0.86;

export function createEffects() {
  const pool: Particle[] = Array.from({ length: POOL }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 1,
    gravity: 0,
    drag: 1,
    angle: 0,
    spin: 0,
    color: '#fff',
    shape: 'dot' as Shape
  }));

  let cursor = 0;
  let shakeAmount = 0;
  let shakePhase = 0;

  /** Round-robin rather than a search for a free slot: at this pool size the oldest particle is
   *  always the one worth losing, and it costs nothing to find. */
  function take(): Particle {
    const p = pool[cursor];
    cursor = (cursor + 1) % POOL;
    p.active = true;
    return p;
  }

  function emit(
    n: number,
    x: number,
    y: number,
    make: (p: Particle, i: number) => void
  ) {
    for (let i = 0; i < n; i++) {
      const p = take();
      p.x = x;
      p.y = y;
      p.angle = 0;
      p.spin = 0;
      p.shape = 'dot';
      p.drag = 1;
      make(p, i);
      p.life = p.maxLife;
    }
  }

  /** Thrown from the tyres while the car rolls — the only thing on the mat that says "moving"
   *  besides the dashes going past, and it is what makes a stop read as a stop. */
  function dust(x: number, y: number, speed: number) {
    emit(1, x, y, (p) => {
      p.vx = -speed * 0.12 - Math.random() * 16;
      p.vy = -14 - Math.random() * 18;
      p.gravity = 42;
      p.drag = 0.9;
      p.maxLife = 0.32 + Math.random() * 0.2;
      p.size = 2 + Math.random() * 2.4;
      p.color = COLORS.matShade;
    });
  }

  /** The stop itself: a puff off both axles, from the contact patch rather than the axle — it
   *  has to come out from *under* the car, or it reads as dirt thrown onto the paintwork. */
  function smoke(x: number, y: number, speed: number) {
    emit(16, x, y, (p, i) => {
      const back = i % 2 === 0 ? -1 : 1;
      p.x = x + back * 17;
      p.vx = back * (26 + Math.random() * speed * 0.3);
      p.vy = -14 - Math.random() * 26;
      p.gravity = 26;
      p.drag = 0.86;
      p.maxLife = 0.45 + Math.random() * 0.35;
      p.size = 3 + Math.random() * 3.5;
      p.color = COLORS.smoke;
    });
  }

  /** The payoff. Chips rather than dots, tumbling, in the target's own yellow plus white. */
  function confetti(x: number, y: number) {
    emit(30, x, y, (p) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
      const v = 110 + Math.random() * 150;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.gravity = 280;
      p.drag = 0.99;
      p.maxLife = 0.9 + Math.random() * 0.6;
      p.size = 3 + Math.random() * 3.5;
      p.angle = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 18;
      p.shape = 'chip';
      p.color = Math.random() < 0.45 ? COLORS.text : COLORS.zone;
      });
  }

  /** The crash. Splinters off the buffer block, thrown back down the track. */
  function debris(x: number, y: number) {
    emit(22, x, y, (p) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 90 + Math.random() * 190;
      p.vx = Math.cos(a) * v - 60;
      p.vy = Math.sin(a) * v;
      p.gravity = 300;
      p.drag = 0.99;
      p.maxLife = 0.7 + Math.random() * 0.7;
      p.size = 2.5 + Math.random() * 4;
      p.angle = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 22;
      p.shape = 'chip';
      p.color = Math.random() < 0.5 ? COLORS.wood : COLORS.bodyDark;
    });
  }

  function shake(amount: number) {
    shakeAmount = Math.max(shakeAmount, amount);
  }

  function update(dt: number) {
    for (const p of pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
    }
    shakePhase += dt * 47;
    shakeAmount *= Math.pow(0.02, dt);
    if (shakeAmount < 0.02) shakeAmount = 0;
  }

  function draw(ctx: CanvasRenderingContext2D) {
    for (const p of pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t / GROUND_FADE);
      ctx.fillStyle = p.color;
      if (p.shape === 'chip') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Parked with the view, so a run left mid-explosion does not come back to it frozen. */
  function clear() {
    for (const p of pool) p.active = false;
    shakeAmount = 0;
  }

  return {
    dust,
    smoke,
    confetti,
    debris,
    shake,
    update,
    draw,
    clear,
    /** Applied to the board transform, so the whole field moves and nothing has to know. */
    shakeX: () => Math.sin(shakePhase) * shakeAmount,
    shakeY: () => Math.cos(shakePhase * 1.7) * shakeAmount * 0.6
  };
}

export type Effects = ReturnType<typeof createEffects>;
