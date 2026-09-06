/**
 * Particles and screen shake.
 *
 * One fixed pool made once and parked, the rule `fly/bolts.ts` was written under: a game whose
 * whole feel is the instant between a tap and a result must not stop to allocate in the middle of
 * it. Nothing here is a physics system — everything is a thrown dot with a lifetime and a fade,
 * which is all a puff of dust or a burst of confetti has ever been.
 *
 * **There is no gravity, because the scene is seen from above.** Every emitter used to arc its
 * particles downward, which is right in a side view and nonsense in a plan one: from overhead a
 * thrown thing slides outward and stops, so `drag` does the whole job and the fall is gone. It is
 * one field less to reason about and one fewer way for an effect to look wrong.
 *
 * The shake is here rather than in the drawing code because it is applied to the board transform,
 * before anything is drawn, and because it decays on the same clock the particles do.
 */

import { COLORS, WHEEL_X, WHEEL_Y } from './board';

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
  drag: number;
  angle: number;
  spin: number;
  color: string;
  shape: Shape;
}

const POOL = 180;
/** Particles hold full opacity for the first stretch of their life and fade over the rest. */
const FADE_FROM = 0.86;

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

  function emit(n: number, x: number, y: number, make: (p: Particle, i: number) => void) {
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

  /** Grit kicked out from under the tail while the car rolls — the only thing on the street that
   *  says "moving" besides the speed lines, and it is what makes a stop read as a stop. */
  function dust(x: number, y: number, speed: number) {
    emit(1, x, y, (p) => {
      p.y = y + (Math.random() - 0.5) * 18;
      p.vx = -speed * 0.1 - Math.random() * 16;
      p.vy = (Math.random() - 0.5) * 36;
      p.drag = 0.87;
      p.maxLife = 0.3 + Math.random() * 0.2;
      p.size = 1.8 + Math.random() * 2.2;
      p.color = COLORS.grit;
    });
  }

  /** The stop itself: a puff at each of the four contact patches, thrown outward from under the
   *  car — anywhere else and it reads as dirt landing on the paintwork. */
  function smoke(x: number, y: number, speed: number) {
    emit(16, x, y, (p, i) => {
      const back = i % 2 === 0 ? -1 : 1;
      const side = i % 4 < 2 ? -1 : 1;
      p.x = x + back * WHEEL_X;
      p.y = y + side * WHEEL_Y;
      p.vx = back * (18 + Math.random() * speed * 0.24);
      p.vy = side * (16 + Math.random() * 30);
      p.drag = 0.85;
      p.maxLife = 0.45 + Math.random() * 0.35;
      p.size = 3 + Math.random() * 3.5;
      p.color = COLORS.smoke;
    });
  }

  /** The payoff. Chips rather than dots, tumbling, thrown out in every direction — from above
   *  there is no up for them to go. */
  function confetti(x: number, y: number) {
    emit(30, x, y, (p, i) => {
      const a = Math.random() * Math.PI * 2;
      const v = 90 + Math.random() * 170;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.drag = 0.9;
      p.maxLife = 0.8 + Math.random() * 0.6;
      p.size = 3 + Math.random() * 3.5;
      p.angle = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 18;
      p.shape = 'chip';
      p.color = i % 3 === 0 ? COLORS.text : i % 3 === 1 ? COLORS.bodyLight : COLORS.good;
    });
  }

  /** What comes off the taxi when it hits somebody: the roof sign, a hubcap, a bit of trim.
   *  Bigger and slower than the debris, because a sign cartwheeling down the street is the joke
   *  and a paint flake is not. */
  function trim(x: number, y: number) {
    emit(10, x, y, (p, i) => {
      const a = (Math.random() - 0.5) * 2.4;
      const v = 120 + Math.random() * 150;
      p.vx = Math.cos(a) * v * 0.5 - 60;
      p.vy = Math.sin(a) * v;
      p.drag = 0.93;
      p.maxLife = 0.9 + Math.random() * 0.6;
      p.size = 4 + Math.random() * 3;
      p.angle = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 14;
      p.shape = 'chip';
      p.color = i % 3 === 0 ? COLORS.hub : COLORS.sign;
    });
  }

  /** The crash. Paint flakes and glass off both cars, thrown back down the street. */
  function debris(x: number, y: number) {
    emit(22, x, y, (p, i) => {
      const a = Math.PI + (Math.random() - 0.5) * 2.6;
      const v = 90 + Math.random() * 190;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v * 0.8;
      p.drag = 0.9;
      p.maxLife = 0.7 + Math.random() * 0.7;
      p.size = 2.5 + Math.random() * 3.5;
      p.angle = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 22;
      p.shape = 'chip';
      p.color = i % 3 === 0 ? COLORS.body : i % 3 === 1 ? COLORS.aheadDark : COLORS.glass;
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
      ctx.globalAlpha = Math.min(1, t / FADE_FROM);
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
    trim,
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
