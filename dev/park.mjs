/**
 * Precision Parking harness.
 *
 * `shots.mjs` says how the station looks and `walk.mjs` says whether you can get anywhere in it.
 * This says the two things about the parking game that are invisible by eye and would each
 * quietly break the whole point of it:
 *
 *  1. **The ladder is deterministic.** Level n has to be the same level n on every load, every
 *     device and every browser, or "how close did you get on level 7, against everyone else"
 *     is not a question anybody can answer. One `Math.random()` in `park/levels.ts` deletes
 *     that, and nothing on screen would look any different.
 *  2. **The stop is back-dated to the tap.** The car's position is interpolated from the event's
 *     own timestamp, not read at the next animation frame. At speed a frame is several board
 *     units against a nine-unit target, so a regression here would not crash anything — it would
 *     just make the game feel unfair, in a way no screenshot shows.
 *
 * It also walks the whole ladder asserting the geometry is legal: every zone on the street, every
 * fail line clear of the buffer block, and at least MIN_ROLL_SECONDS of approach.
 *
 *   node dev/park.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

function startVite() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    const onData = (d) => {
      buf += d.toString();
      const m = buf.match(/Local:\s+(http:\/\/[^\s]+)/);
      if (m) resolve({ proc, url: m[1].replace(/\/$/, '') });
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (c) => reject(new Error(`vite exited ${c}\n${buf}`)));
    setTimeout(() => reject(new Error(`vite did not start\n${buf}`)), 30000);
  });
}

const server = await startVite();
const browser = await chromium.launch();
// Portrait, because that is what the board is drawn for — though the board letterboxes itself
// and none of what is tested here depends on the viewport at all.
const page = await browser.newPage({ viewport: { width: 420, height: 820 } });

async function open() {
  // `#park` rather than the bare hash even though parking is the default: an explicit hash keeps
  // this harness working whichever view the site happens to open on.
  await page.goto(`${server.url}/#park`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__park, null, { timeout: 60000 });
}

const specs = () =>
  page.evaluate(() =>
    Array.from({ length: window.__park.ROUND_COUNT }, (_, i) => window.__park.roundSpec(i))
  );

await open();
const first = await specs();
await open();
const second = await specs();

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

check(
  "the session's five bays are identical across two page loads",
  JSON.stringify(first) === JSON.stringify(second),
  `${first.length} rounds`
);

// --- geometry --------------------------------------------------------------------------------

const { MAX_FAIL_LINE, START_X, TRACK_X0, TRACK_X1, CAR_HALF, MIN_ROLL_SECONDS } =
  await page.evaluate(async () => {
    const board = await import('/src/park/board.ts');
    const levels = await import('/src/park/levels.ts');
    return {
      MAX_FAIL_LINE: board.MAX_FAIL_LINE,
      START_X: board.START_X,
      TRACK_X0: board.TRACK_X0,
      TRACK_X1: board.TRACK_X1,
      CAR_HALF: board.CAR_HALF,
      MIN_ROLL_SECONDS: levels.MIN_ROLL_SECONDS
    };
  });

const bad = { fail: [], roll: [], road: [], park: [], start: [], reach: [] };
for (const spec of first) {
  const { centre, half } = spec.bay;
  if (spec.failLine > MAX_FAIL_LINE + 1e-6) bad.fail.push(spec.level);
  if ((centre - START_X) / spec.speed < MIN_ROLL_SECONDS - 1e-6) bad.roll.push(spec.level);
  if (centre - half < TRACK_X0 || centre + half > TRACK_X1) bad.road.push(spec.level);
  // The bay has to be longer than the car, or there is no place to park in it at all.
  if (spec.clearance <= 0 || Math.abs(half - CAR_HALF - spec.clearance) > 1e-9) {
    bad.park.push(spec.level);
  }
  // And it must not start where the car does, or the car begins the round already parked.
  if (centre - half < START_X + CAR_HALF) bad.start.push(spec.level);
  // The far half of the bay has to be reachable: the block must be far enough past the line that
  // the bumper does not arrive first.
  if (spec.failLine <= centre + spec.clearance) bad.reach.push(spec.level);
}

check('every fail line leaves room for the buffer block', bad.fail.length === 0, `${bad.fail}`);
check(
  `every round gives at least ${MIN_ROLL_SECONDS}s of approach`,
  bad.roll.length === 0,
  `${bad.roll}`
);
check('every bay is on the street', bad.road.length === 0, `${bad.road}`);
check('every bay is wider than the car it must hold', bad.park.length === 0, `${bad.park}`);
check('no bay starts where the car does', bad.start.length === 0, `${bad.start}`);
check('the far end of every bay is reachable', bad.reach.length === 0, `${bad.reach}`);

// The block sits directly after the bay, so overshooting means hitting it. Now that the whole
// car is measured, the nose and the judged edge are the same line, so the band between "your
// nose crossed the paint" and "your nose hit the wall" is exactly `BLOCK_GAP` on every round.
// It has to be more than nothing, or the far end of the bay would be unreachable, and it has to
// stay small, or the block goes back to being scenery.
const { BLOCK_GAP } = await page.evaluate(async () => {
  const b = await import('/src/park/board.ts');
  return { BLOCK_GAP: b.BLOCK_GAP };
});
const bands = first.map((spec) => spec.failLine - (spec.bay.centre + spec.clearance));
check(
  'overshooting the bay runs into the block almost immediately',
  BLOCK_GAP > 0 && BLOCK_GAP < 8 && bands.every((b) => Math.abs(b - BLOCK_GAP) < 1e-9),
  bands.map((b) => b.toFixed(1)).join(', ') + `u, all equal to BLOCK_GAP ${BLOCK_GAP}`
);

// The contract between what is drawn and what is judged. The bay is measured against the car's
// own outline, so nothing drawn may stick out past `CAR_HALF` — a wheel poking out past the
// bodywork would be a visible part of the car outside a bay the game called parked. (The other
// half of this contract, that the drawn length does not change under the brakes, is why the
// scene's overhead view splays the body sideways rather than squashing it; see `drawCar`.)
const drawn = await page.evaluate(async () => {
  const b = await import('/src/park/board.ts');
  return { tyre: b.WHEEL_X + b.WHEEL_R, carHalf: b.CAR_HALF };
});
check(
  'nothing drawn sticks out past the outline the scoring measures',
  drawn.tyre <= drawn.carHalf,
  `tyres reach ${drawn.tyre}, body ${drawn.carHalf}`
);

// A failure has to cost more than any successful park, or a round could be worth failing on
// purpose. The widest clearance in the session is the worst a park can score.
const widest = Math.max(...first.map((spec) => spec.clearance));
check(
  'failing always costs more than parking badly',
  40 > widest,
  `miss 40 vs worst park ${widest.toFixed(1)}`
);

// --- the back-dated tap ----------------------------------------------------------------------
// Launch a fast level, let it roll, then hand the game a tap timestamped a known distance into
// the future of the last simulated frame. Read at the frame instead, the answer would be the
// car's position now — several board units short.

const AHEAD_MS = 50;
await open();
const latency = await page.evaluate(async (ahead) => {
  const park = window.__park;
  park.reset();
  park.goTo(4); // the last and fastest bay of the session
  park.tap(); // launch
  await new Promise((r) => setTimeout(r, 180));
  if (park.phase !== 'rolling') return { error: `phase was ${park.phase}` };
  // Read and tap in one synchronous block: no animation frame can run between them, so the pair
  // is exact rather than nearly right.
  const { simTime, carX, spec } = park;
  const expected = carX + (spec.speed * ahead) / 1000;
  park.tapAt(simTime + ahead);
  return { speed: spec.speed, naive: carX, expected, got: park.result ? park.result.stopX : null };
}, AHEAD_MS);

if (latency.error) {
  check('the stop is back-dated to the tap', false, latency.error);
} else {
  const drift = Math.abs(latency.got - latency.expected);
  const worth = Math.abs(latency.expected - latency.naive);
  check('the stop is back-dated to the tap', drift < 1e-6, `off by ${drift.toExponential(1)}u`);
  check(
    'and back-dating is worth doing at all',
    worth > 3,
    `${AHEAD_MS}ms is ${worth.toFixed(1)}u at ${latency.speed.toFixed(0)} u/s`
  );
}

// --- scoring ---------------------------------------------------------------------------------
// A dead-centre stop is the maximum, and a stop past the fail line is a crash that ends the run.

await open();
const inZone = await page.evaluate(async () => {
  const park = window.__park;
  park.reset();
  park.goTo(2);
  park.tap();
  const { centre } = park.spec.bay;
  // Roll up to the zone a frame at a time, then hand it a tap timed to land on the mark.
  // `setTimeout` is not accurate enough to aim with in a headless browser — it was overshooting
  // the zone entirely, which is a fair thing for the game to call a miss and a useless test.
  const ahead = () => ((centre - park.carX) / park.spec.speed) * 1000;
  while (ahead() > 60) await new Promise((r) => requestAnimationFrame(r));
  park.tapAt(park.simTime + Math.max(ahead(), 0));
  const scored = { rating: park.result.rating, error: park.result.error, phase: park.phase };
  await new Promise((r) => setTimeout(r, 1700));
  return {
    ...scored,
    round: park.round,
    nextPhase: park.phase,
    totalOff: park.totalOff,
    // The verdict must not survive into the next round — see `arm()`.
    carriedOver: park.result
  };
});
check(
  'the whole car in the bay scores and the round advances',
  inZone.round === 3 && inZone.nextPhase === 'ready' && inZone.totalOff === inZone.error,
  `${inZone.rating} ${inZone.error.toFixed(2)}u → round ${inZone.round + 1}, total ${inZone.totalOff.toFixed(2)}`
);
check(
  'and the last verdict does not follow you into the next round',
  inZone.carriedOver === null,
  inZone.carriedOver ? `still showing ${inZone.carriedOver.rating}` : 'cleared'
);

// The win condition itself, at its own boundary: a tyre exactly on the line is in, and a tyre a
// tenth of a unit past it is out. Driven through `tapAt` so it goes through the same judging the
// real game does, rather than testing the arithmetic twice.
await open();
const boundary = await page.evaluate(async () => {
  const park = window.__park;
  const stopAt = async (round, offset) => {
    park.reset();
    park.goTo(round);
    park.tap();
    const target = park.spec.bay.centre + offset;
    const ahead = () => ((target - park.carX) / park.spec.speed) * 1000;
    // The phase guard matters: aim past the fail line and the car meets the block on its own,
    // at which point `carX` stops moving and a bare `while (ahead() > 60)` spins forever.
    while (ahead() > 60 && park.phase === 'rolling') {
      await new Promise((r) => requestAnimationFrame(r));
    }
    if (park.phase === 'rolling') park.tapAt(park.simTime + Math.max(ahead(), 0));
    return { rating: park.result.rating, error: park.result.error };
  };
  const clearance = park.roundSpec(2).clearance;
  return {
    clearance,
    on: await stopAt(2, clearance - 0.05),
    over: await stopAt(2, clearance + 0.1),
    long: await stopAt(2, clearance + 8)
  };
});
check(
  'the car exactly on the line is inside the bay',
  boundary.on.rating !== 'MISSED' && boundary.on.rating !== 'CRASHED',
  `${boundary.on.error.toFixed(2)}u off, clearance ${boundary.clearance.toFixed(2)} → ${boundary.on.rating}`
);
check(
  'and a hair past it is not',
  boundary.over.rating === 'MISSED',
  `${boundary.over.error.toFixed(2)}u off → ${boundary.over.rating}`
);
check(
  'overshooting properly hits the block',
  boundary.long.rating === 'CRASHED',
  `aimed ${(boundary.clearance + 8).toFixed(1)}u long → ${boundary.long.rating}`
);

// The structural promise: five bays every time, whatever happens on them. This is what makes one
// session's total comparable with another's, so it is the thing most worth asserting.
await open();
const session = await page.evaluate(async () => {
  const park = window.__park;
  park.reset();
  const log = [];
  // Park rounds 1 and 2, miss round 3 outright, crash round 4 by never tapping, park round 5.
  for (let i = 0; i < park.ROUND_COUNT; i++) {
    log.push({ round: park.round, phase: park.phase });
    park.tap();
    if (i === 3) {
      await new Promise((r) => setTimeout(r, 3200)); // never tap: into the block
    } else if (i === 2) {
      await new Promise((r) => setTimeout(r, 100));
      park.tapAt(park.simTime); // nowhere near the bay
    } else {
      const c = park.spec.bay.centre;
      const ahead = () => ((c - park.carX) / park.spec.speed) * 1000;
      while (ahead() > 60) await new Promise((r) => requestAnimationFrame(r));
      park.tapAt(park.simTime + Math.max(ahead(), 0));
    }
    await new Promise((r) => setTimeout(r, 1700));
  }
  const done = {
    phase: park.phase,
    scores: park.scores.map((s) => ({ score: s.score, rating: s.rating })),
    totalOff: park.totalOff,
    order: log
  };
  // `INPUT_LOCKOUT` runs from the moment the results appear, so a tap fired straight after them
  // is refused — which is the point of it, and the harness has to respect it like a player does.
  await new Promise((r) => setTimeout(r, 500));
  park.tapAt(performance.now());
  return { ...done, afterRound: park.round, afterPhase: park.phase, afterTotal: park.totalOff };
});

check(
  'a session always plays every round in order',
  session.order.every((s, i) => s.round === i && s.phase === 'ready'),
  session.order.map((s) => s.round).join(',')
);
check(
  'missing does not end the session',
  session.scores.length === first.length && session.scores[2].rating === 'MISSED',
  session.scores.map((s) => s.rating).join(' ')
);
check(
  'crashing does not end the session either',
  session.scores[3].rating === 'CRASHED',
  session.scores.map((s) => s.score.toFixed(1)).join(' ')
);
check(
  'a failed round costs a flat penalty, not the distance missed by',
  session.scores[2].score === 40 && session.scores[3].score === 60,
  `miss ${session.scores[2].score} / crash ${session.scores[3].score}`
);
check(
  'and crashing costs more than missing',
  session.scores[3].score > session.scores[2].score,
  `${session.scores[3].score} > ${session.scores[2].score}`
);
check(
  'the total is the sum of the rounds',
  Math.abs(session.totalOff - session.scores.reduce((a, s) => a + s.score, 0)) < 1e-9,
  session.totalOff.toFixed(2)
);
check(
  'the last round ends in results, not another bay',
  session.phase === 'results',
  session.phase
);
check(
  'and playing again starts a fresh session at round 1',
  session.afterRound === 0 && session.afterTotal === 0 && session.afterPhase === 'ready',
  `round ${session.afterRound + 1}, total ${session.afterTotal}`
);

// --- report ----------------------------------------------------------------------------------

console.log(
  `\nsession: ${first.length} bays, the same five for everybody\n`
);
for (const [i, spec] of first.entries()) {
  const roll = ((spec.bay.centre - START_X) / spec.speed).toFixed(2);
  const windowMs = ((2 * spec.clearance) / spec.speed) * 1000;
  console.log(
    `  round ${i + 1}  rung ${String(spec.level).padStart(2)}  ` +
      `${spec.speed.toFixed(0).padStart(3)} u/s  ` +
      `bay ${(2 * spec.bay.half).toFixed(0).padStart(3)}u at ${spec.bay.centre.toFixed(0).padStart(3)}  ` +
      `clearance ±${spec.clearance.toFixed(1).padStart(4)}u  ` +
      `roll ${roll}s  window ${windowMs.toFixed(0).padStart(3)}ms`
  );
}
console.log('');

let failures = 0;
for (const r of results) {
  if (!r.ok) failures++;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(52)} ${r.detail}`);
}

await browser.close();
server.proc.kill();
console.log(failures === 0 ? '\nall good\n' : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
