/**
 * Precision Parking — the fifth scene, and the only one here that is a game outright.
 *
 * A chunky toy car rolls left to right along a fixed track towards a painted target. One tap
 * stops it dead. The score is how close its centre landed to the target's centre; overshoot and
 * the bumper meets the buffer block and the run is over. That is the whole of it, and the
 * reasoning below is mostly about the ways it could have been more and deliberately is not.
 *
 * **Plain 2D canvas, not three.js.** The other four modes are one WebGL world seen four ways.
 * This shares nothing with them: no GPU contention, no `webglcontextlost` handler to write, no
 * surface maps and so no part in the texture-quality switch. It is chunky flat vector art
 * because that loads instantly, stays crisp on a phone at any pixel ratio, and looks like a toy
 * rather than like the rest of the site.
 *
 * **A letterboxed 360x640 board, not a canvas that fills the window.** Every number in the game
 * is in board units and the whole field is mapped onto the canvas by one transform. This is not
 * about looking right in portrait — it is what makes two runs the same run. If the board
 * stretched to the viewport, "you stopped 4 units off centre" would mean a different thing on a
 * phone and on a desktop, and the per-level comparison this scene is shaped around (see
 * `park/levels.ts`) could never be made.
 *
 * **The field is fixed and entirely visible; the camera never scrolls.** You can see the car,
 * the gap and the target from the moment it launches. That is what makes the tap a judgement
 * rather than a reaction, which is the feeling being aimed at. The cost is that the track is only
 * 308 units long, which puts a ceiling on speed — so difficulty is carried by the target
 * shrinking five-fold instead, and the speed curve asymptotes well short of unwatchable.
 *
 * **The stop is instantaneous, and back-dated to the tap.** There is no braking curve and no
 * skid, because either would put a second skill between the tap and the result, and the tap *is*
 * the result. More importantly the position is computed from the *event's* timestamp rather than
 * read at the next animation frame: at 200 units a second one frame of latency is 3.3 board
 * units, against a level-20 target half-width of 9. Sampled at the frame, a third of the target
 * would be eaten by the frame clock and no amount of skill would get it back. What the player
 * gets instead of brakes is weight — a nose dip, a squash and a puff of tyre smoke, all of which
 * are cosmetic and none of which move the judged number.
 *
 * **One life.** A crash ends the run. There is no timer, nothing to collect and no objective
 * beyond the score — which makes this the third and loudest exception to the "no score, no
 * timers, no objectives" rule in CLAUDE.md. That rule is about the station, which is a place to
 * be; this is a toy on a mat.
 */

import {
  BOARD_H,
  BOARD_W,
  CAR_HALF,
  COLORS,
  GROUND_Y,
  START_X
} from './park/board';
import { ROUND_COUNT, roundSpec, type LevelSpec } from './park/levels';
import { createEffects } from './park/effects';
import { createBest } from './park/best';
import {
  drawScene,
  type Phase,
  type Rating,
  type RoundScore,
  type Scene,
  type StopResult
} from './park/draw';

/**
 * Dead centre, in board units — floored so it stays achievable in level 1's roomy bay and scaled
 * so it does not become pure luck in level 25's tight one. Measured against the level's
 * clearance, not against the bay: the bay barely changes size down the ladder and the clearance
 * changes by nine times.
 *
 * This decides the word on the screen and the confetti, and nothing else. **The score is the
 * distance itself** — see `judge()`.
 */
const perfectBand = (clearance: number) => Math.max(1.5, clearance * 0.06);

/** How long the verdict holds before the next round arms itself. */
const JUDGE_SECONDS = 1.4;

/**
 * What a failed round costs, in board units, flat.
 *
 * A failure has to be scored as *something*, because the session always runs its five rounds and
 * a round with no number in it would leave the total meaningless. Both are flat figures rather
 * than the distance actually missed by: that distance can be two hundred units if you stop at
 * the start line, which would let one flubbed round swamp four good ones and turn the session
 * score into a record of your worst moment.
 *
 * `MISS_PENALTY` is 40, which is more than the widest round can score by parking badly (round
 * one's clearance is 36) — so failing is always worse than any successful park, however sloppy.
 *
 * **A crash costs half as much again, because it is worse.** Stopping outside the bay is bad
 * parking; putting the bumper through the block is bad parking *and* hitting something, and a
 * game that charged the same for both would be saying the block is scenery. It also gives the
 * two failures different shapes to play against: overshooting long is cheaper than overshooting
 * into the wall, so when a round is already lost there is still something to get right.
 */
const MISS_PENALTY = 40;
const CRASH_PENALTY = 60;

/** How far the body pitches when the brakes bite, in radians. **Positive is nose-down** — the
 *  canvas y axis points down, so this was lifting the nose under braking while calling itself a
 *  dip. `draw.ts` pitches the body alone; the wheels stay on the road. */
const NOSE_DIP = 0.07;

/** A tap is ignored for this long after a stop. The tap that stopped the car is very often still
 *  on its way up, and without this the same press would stop the car and launch the next level. */
const INPUT_LOCKOUT = 0.35;

/** A back-dated tap is trusted this far and no further — a stale or bogus event timestamp must
 *  not be able to teleport the car down the track. */
const MAX_BACKDATE_MS = 120;

export interface ParkViewOptions {
  /** Called when a session's five rounds are done, so a host could react. Nothing does today —
   *  it is the hook a leaderboard would hang off. */
  onSessionEnd?: (totalOff: number) => void;
}

export function createParkView(canvas: HTMLCanvasElement, options: ParkViewOptions = {}) {
  const ctx = canvas.getContext('2d')!;
  const effects = createEffects();
  const best = createBest();

  // Unlike `fly-view.ts`, which caps a coarse-pointer device at 1.5, this takes the full 2. That
  // cap is there because nearly every pixel in flight view is shader work under a bloom
  // composer; this is a few dozen flat fills, and crisp text at arm's length is worth more here
  // than the fragments saved.
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  const coarse = window.matchMedia('(pointer: coarse)').matches;

  let phase: Phase = 'ready';
  let phaseTime = 0;
  /** Which of the session's `ROUND_COUNT` bays is up, 0-based. */
  let round = 0;
  let spec: LevelSpec = roundSpec(0);
  let carX = START_X;
  let carTilt = 0;
  let wheelAngle = 0;
  /** The session's score: every round's score added up. Lower is better. */
  let totalOff = 0;
  /** What each round scored, in order, for the results screen. */
  let scores: RoundScore[] = [];
  let result: StopResult | null = null;
  let lockout = 0;
  let dustTimer = 0;
  /** Set once at the end of a session, so the results screen can say so. */
  let sessionBest = false;

  /** The wall clock at the last simulated frame, and the car's position then. The tap is
   *  interpolated from this pair, which is the whole latency story. */
  let simTime = performance.now();

  function arm(next: number) {
    round = next;
    spec = roundSpec(round);
    carX = START_X;
    carTilt = 0;
    phase = 'ready';
    phaseTime = 0;
    // The last level's verdict has to go with the last level. Both the ruler and the verdict are
    // drawn whenever the phase is not `ready`, so a `result` left lying here reappeared the
    // instant the *next* level was launched — the previous stop's word and distance, under a car
    // that had not been anywhere yet.
    result = null;
  }

  /** A whole new session. Also what `start()` leans on the first time the view is opened. */
  function reset() {
    totalOff = 0;
    scores = [];
    sessionBest = false;
    result = null;
    lockout = 0;
    wheelAngle = 0;
    effects.clear();
    arm(0);
  }

  /**
   * One round's score is settled and the session moves on — **whatever happened**. There is no
   * way to end a session early: five bays are attempted every time, so every session's score is
   * a total over the same five, which is the only reason two players' numbers mean the same
   * thing. Failing costs `MISS_PENALTY` and the car rolls up to the next bay.
   */
  function settle(score: number, rating: Rating) {
    totalOff += score;
    scores.push({ score, rating, best: best.noteRound(round, score) });
    phase = 'judging';
    phaseTime = 0;
    lockout = INPUT_LOCKOUT;
  }

  // --- judging -------------------------------------------------------------------------------

  /**
   * **Parked means the whole car between the bay's lines.** The judged point is the car's centre
   * — one number, and the only one a tap can move — but the band it has to land in is
   * `spec.clearance`, which is the bay's half-width less `CAR_HALF`. So the car's own size is
   * part of the question, which is what makes the bay read as a bay rather than as a painted
   * mark you aim the middle of the bonnet at.
   *
   * A parked round scores the distance itself; a failed one scores `MISS_PENALTY`. Either way
   * the session carries on to the next bay.
   */
  function judge(stopX: number) {
    const bay = spec.bay;

    // Past the fail line the car has already met the block. Outside the clearance a tyre is over
    // a line. Neither ends the session any more — see `fail()`.
    if (stopX > spec.failLine) {
      fail('CRASHED', spec.failLine);
      return;
    }
    const error = Math.abs(stopX - bay.centre);
    if (error > spec.clearance) {
      fail('MISSED', stopX);
      return;
    }

    const perfect = error <= perfectBand(spec.clearance);

    // GREAT has to be measured from the perfect band as well as from the clearance: at the top of
    // the ladder a quarter of the clearance is *narrower* than the perfect band itself, and a
    // rating whose window sits entirely inside the one tested before it can never be awarded.
    // These three words are feedback, not scoring — they decide the colour and the confetti.
    const great = Math.max(perfectBand(spec.clearance) * 2.5, spec.clearance * 0.25);
    const rating: Rating = perfect ? 'PERFECT' : error <= great ? 'GREAT' : 'CLOSE';

    carX = stopX;
    carTilt = NOSE_DIP;
    effects.smoke(carX, GROUND_Y - 6, spec.speed);
    if (perfect) {
      effects.confetti(carX, GROUND_Y - 46);
      effects.shake(2.5);
    }

    settle(error, rating);
    result = {
      round,
      stopX,
      error,
      rating,
      personalBest: scores[scores.length - 1].best,
      bayCentre: bay.centre,
      clearance: spec.clearance
    };
  }

  /**
   * A round failed: a tyre over a line, or the bumper into the block. It costs `MISS_PENALTY`
   * and the session carries on — **failing does not end anything**, which reverses the one-life
   * rule this file used to carry. That rule made every session a different length, and a total
   * over a variable number of rounds is not a number two players can compare; see `SESSION` in
   * `park/levels.ts` for the whole argument.
   *
   * The two ways to get here differ only in what they look like. `CRASHED` has the car past the
   * fail line and into the block, so it throws debris and shakes hard; `MISSED` is a car parked
   * politely in the wrong place, which deserves a puff of smoke and nothing else.
   */
  function fail(rating: Rating, stopX: number) {
    const bay = spec.bay;
    carX = stopX;
    carTilt = rating === 'CRASHED' ? NOSE_DIP * 2 : NOSE_DIP;
    effects.smoke(stopX, GROUND_Y - 6, spec.speed);
    if (rating === 'CRASHED') {
      effects.debris(stopX + CAR_HALF, GROUND_Y - 24);
      effects.shake(9);
    } else {
      effects.shake(2);
    }

    settle(rating === 'CRASHED' ? CRASH_PENALTY : MISS_PENALTY, rating);
    result = {
      round,
      stopX,
      // The distance actually missed by, for the verdict to show. It is *not* what the round
      // scored — see `MISS_PENALTY`.
      error: Math.abs(stopX - bay.centre),
      rating,
      // Never announced on a failure: "your best here" under a word that just cost you forty
      // units reads as congratulation for failing.
      personalBest: false,
      bayCentre: bay.centre,
      clearance: spec.clearance
    };
  }

  // --- input ---------------------------------------------------------------------------------

  /**
   * One action for the whole game, whatever it was pressed with. `at` is the wall clock of the
   * gesture itself — for a pointer event that is the browser's own hardware timestamp, which is
   * a frame better than `performance.now()` inside the handler.
   */
  function tapAt(at: number) {
    if (!running || lockout > 0) return;
    if (phase === 'ready') {
      phase = 'rolling';
      phaseTime = 0;
      return;
    }
    if (phase === 'rolling') {
      const ahead = Math.min(Math.max(at - simTime, 0), MAX_BACKDATE_MS);
      judge(carX + (spec.speed * ahead) / 1000);
      return;
    }
    if (phase === 'results') reset();
  }

  const tap = () => tapAt(performance.now());

  function onPointerDown(event: PointerEvent) {
    // Bound to the canvas rather than the window, so a tap on the mode switcher floating above
    // the view cannot stop the car.
    event.preventDefault();
    // Pointer events carry a `timeStamp` on the same origin as `performance.now()`; it is the
    // instant the gesture happened rather than the instant this handler ran. Guarded because a
    // synthetic event can carry 0.
    const t = event.timeStamp > 0 ? event.timeStamp : performance.now();
    tapAt(Math.min(t, performance.now()));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!running) return;
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    // Or the space bar scrolls whatever is behind the canvas a page at a time.
    event.preventDefault();
    if (event.repeat) return;
    tapAt(event.timeStamp > 0 ? Math.min(event.timeStamp, performance.now()) : performance.now());
  }

  // --- the loop ------------------------------------------------------------------------------

  function update(dt: number) {
    phaseTime += dt;
    lockout = Math.max(0, lockout - dt);
    effects.update(dt);

    if (phase === 'rolling') {
      carX += spec.speed * dt;
      wheelAngle += (spec.speed / 11) * dt;
      dustTimer -= dt;
      if (dustTimer <= 0) {
        dustTimer = 0.03;
        effects.dust(carX - 16, GROUND_Y - 2, spec.speed);
      }
      // Nobody tapped. The car meets the block, which is the same event as overshooting.
      if (carX >= spec.failLine) fail('CRASHED', spec.failLine);
    } else if (phase === 'judging') {
      // The nose settles back out of its dip.
      carTilt += (0 - carTilt) * Math.min(1, dt * 9);
      if (phaseTime < JUDGE_SECONDS) return;
      if (round + 1 < ROUND_COUNT) {
        arm(round + 1);
      } else {
        sessionBest = best.noteSession(totalOff);
        options.onSessionEnd?.(totalOff);
        phase = 'results';
        phaseTime = 0;
        lockout = INPUT_LOCKOUT;
      }
    }
  }

  function render() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const ratio = dpr();

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = COLORS.surround;
    ctx.fillRect(0, 0, w, h);

    // The board, centred and letterboxed. Everything past this point is in board units.
    const scale = Math.min(w / BOARD_W, h / BOARD_H);
    ctx.translate(
      (w - BOARD_W * scale) / 2 + effects.shakeX() * scale,
      (h - BOARD_H * scale) / 2 + effects.shakeY() * scale
    );
    ctx.scale(scale, scale);

    const scene: Scene = {
      phase,
      phaseTime,
      spec,
      carX,
      carTilt,
      wheelAngle,
      rolling: phase === 'rolling',
      round,
      totalOff,
      bestTotal: best.total,
      sessionBest,
      scores,
      result,
      coarse
    };
    drawScene(ctx, scene, effects);
  }

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    // 0 while the container is still hidden; `start()` unhides first and calls this again.
    if (clientWidth === 0 || clientHeight === 0) return;
    const ratio = dpr();
    canvas.width = Math.round(clientWidth * ratio);
    canvas.height = Math.round(clientHeight * ratio);
  }

  let rafId = 0;
  let running = false;

  function tick(now: number) {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min((now - simTime) / 1000, 0.1);
    simTime = now;
    update(dt);
    render();
  }

  // Bound once at construction and never removed — there is no dispose, the same as `fly-view`.
  // Every handler is gated on `running`, so a keypress meant for another view cannot reach in.
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);

  reset();

  function start() {
    if (running) return;
    running = true;
    resize();
    simTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    // A car left mid-roll would come back still rolling, into a bay the player has not looked at
    // since. Re-arm the round instead: the session and its total are kept, the launch is not.
    if (phase === 'rolling') arm(round);
    effects.clear();
  }

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__park = {
      get phase() {
        return phase;
      },
      get round() {
        return round;
      },
      get scores() {
        return scores;
      },
      get spec() {
        return spec;
      },
      get carX() {
        return carX;
      },
      get totalOff() {
        return totalOff;
      },
      get result() {
        return result;
      },
      get simTime() {
        return simTime;
      },
      roundSpec,
      ROUND_COUNT,
      tap,
      tapAt,
      reset,
      /** Jump straight to a round, for the harness. Not reachable from the game. */
      goTo: (n: number) => arm(n)
    };
  }

  return { start, stop, reset };
}
