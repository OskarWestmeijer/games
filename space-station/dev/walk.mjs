/**
 * Walk harness. Starts a Vite dev server, and inside the page replays the *exact* floor logic
 * of `fpv-controls.ts` — clamp, obstacle push-out, first-match `deckAt`, step guard — over a
 * scripted route through the station.
 *
 * `shots.mjs` says how the place looks. This says whether you can get anywhere in it, which is
 * the half of a staircase that a screenshot cannot show: a flight can be beautiful and still be
 * unboardable, or hand you a 40 cm hop onto its third tread, or refuse to let you back down.
 *
 * It drives the real `DECKS` and `obstacles` off `window.__station`, and imports `regions.ts`
 * from the dev server rather than reimplementing it. The one thing it leaves out is looking,
 * which no floor decision depends on.
 *
 *   node dev/walk.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

/**
 * Waypoints in station XZ. Each leg is walked in a straight line at full speed; the point is
 * the floor under the route, not the pathfinding.
 */
const ROUTE = [
  // You arrive on the bridge now, at the head of the stairs — so the tour starts upstairs, goes
  // down, does the lounge, and comes back up. Both directions on the flight get walked either
  // way, which is the half of this that catches a step-guard bug.
  { name: 'spawn', to: [3.42, 2.5] },
  { name: 'behind the console', to: [0, 3.9] },
  { name: 'round the globe, port', to: [-2.0, 5.2] },
  { name: 'back to the head of the stairs', to: [3.4, 2.1] },
  { name: 'down the flight', to: [3.7, -1.2] },
  { name: 'off at the foot', to: [3.0, -3.1] },
  // Out into the hall clear of the couch: the straight line from the stair foot passes 2.83 m
  // from the lounge's centre, against the 2.37 m its outer boxes reach once inflated.
  { name: 'out into the hall', to: [0.8, -1.1] },
  // Round the lounge to port and in through the mouth of the U. Every waypoint outside the couch
  // stays clear of r = 2.37 about (0, -4.2) — `couchOuter` plus the player radius — because the
  // ring is an obstacle you walk *around*, and a straight line that cuts the corner is testing the
  // push-out rather than the floor.
  { name: 'down the port side', to: [-2.6, -4.2] },
  { name: 'round the port bow', to: [-2.7, -5.3] },
  { name: 'in front of the mouth', to: [-1.3, -6.2] },
  // The pocket. Standing at the table facing the window is the shot the lounge exists for, and
  // stepping round the table to starboard is what proves the ring is a ring and not a dead end —
  // it sealed itself once, and wedged this harness in a sliver it could not push out of.
  { name: 'in to the table', to: [0, -5.0] },
  { name: 'round the table, starboard', to: [0.9, -4.2] },
  { name: 'back out through the mouth', to: [0.4, -6.1] },
  { name: 'round the starboard bow', to: [2.5, -5.8] },
  { name: 'to the foot of the stairs', to: [3.1, -2.9] },
  // Along the flight rather than at its top: you cannot board a staircase halfway up, so a
  // straight line to the head of it tests the step guard, not the stairs.
  { name: 'up the flight, lower half', to: [3.7, -1.2] },
  { name: 'up the flight, top', to: [3.6, 1.5] },
  { name: 'back to the spawn', to: [3.42, 2.5] }
];


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
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle']
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
// The bare URL: this project is the station and nothing else now, so there is no hash to
// name. `window.__station` still arrives a frame or two late — see the wait below.
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__station, null, { timeout: 60000 });

const report = await page.evaluate(async (route) => {
  const { clampToRegions, deckAt } = await import('/src/regions.ts');

  // The three constants the floor logic is written against, copied from `fpv-controls.ts`.
  const MAX_STEP = 0.25;
  const PLAYER_RADIUS = 0.32;
  const SPEED = 2.4;
  // The dt cap. Every guard in the station is sized against the worst legitimate frame, so the
  // walk is run at it rather than at a comfortable one.
  const DT = 0.1;

  const { decks, obstacles, spawn } = window.__station.station;

  const pos = { x: spawn.x, z: spawn.z };
  let level = spawn.level;
  let floorY = null;
  const legs = [];

  // A `Vector2` without importing three by a bare specifier, which the page cannot resolve:
  // every region is already a list of them.
  const Vector2 = decks[0].region[0].constructor;
  const scratch = new Vector2();

  function stepTo(tx, tz) {
    const priorX = pos.x;
    const priorZ = pos.z;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const len = Math.hypot(dx, dz);
    const move = Math.min(len, SPEED * DT);
    if (len > 1e-6) {
      pos.x += (dx / len) * move;
      pos.z += (dz / len) * move;
    }

    const active = decks.filter((d) => d.levels.includes(level));
    const regions = active.map((d) => d.region);

    scratch.set(pos.x, pos.z);
    clampToRegions(scratch, regions);
    pos.x = scratch.x;
    pos.z = scratch.y;

    for (let pass = 0; pass < 2; pass++) {
      for (const obstacle of obstacles) {
        if (obstacle.level !== level) continue;
        const minX = obstacle.box.min.x - PLAYER_RADIUS;
        const maxX = obstacle.box.max.x + PLAYER_RADIUS;
        const minZ = obstacle.box.min.y - PLAYER_RADIUS;
        const maxZ = obstacle.box.max.y + PLAYER_RADIUS;
        if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue;
        const least = Math.min(pos.x - minX, maxX - pos.x, pos.z - minZ, maxZ - pos.z);
        if (least === pos.x - minX) pos.x = minX;
        else if (least === maxX - pos.x) pos.x = maxX;
        else if (least === pos.z - minZ) pos.z = minZ;
        else pos.z = maxZ;
      }
    }

    let deck = deckAt(pos.x, pos.z, active) ?? active[0];
    let next = deck.floorAt(pos.x, pos.z);
    let refused = false;
    if (floorY !== null && Math.abs(next - floorY) > MAX_STEP) {
      refused = true;
      pos.x = priorX;
      pos.z = priorZ;
      deck = deckAt(priorX, priorZ, active) ?? deck;
      next = deck.floorAt(priorX, priorZ);
    }
    const rise = floorY === null ? 0 : next - floorY;
    floorY = next;
    level = deck.levelAt(pos.x, pos.z);
    return { refused, rise };
  }

  for (const leg of route) {
    const [tx, tz] = leg.to;
    let frames = 0;
    let stuck = 0;
    let biggest = 0;
    const startY = floorY;
    // Generous: a 12 m leg at 0.24 m a frame is 50 frames. Anything over 400 is not walking.
    while (Math.hypot(tx - pos.x, tz - pos.z) > 0.05 && frames < 400) {
      const before = { x: pos.x, z: pos.z };
      const { refused, rise } = stepTo(tx, tz);
      if (Math.abs(rise) > Math.abs(biggest)) biggest = rise;
      if (refused || Math.hypot(pos.x - before.x, pos.z - before.z) < 1e-4) stuck++;
      else stuck = 0;
      // Ten frames of no progress is a wall, not a slow corner.
      if (stuck > 10) break;
      frames++;
    }
    legs.push({
      name: leg.name,
      arrived: Math.hypot(tx - pos.x, tz - pos.z) <= 0.35,
      at: [Number(pos.x.toFixed(2)), Number(pos.z.toFixed(2))],
      floor: Number((floorY ?? 0).toFixed(2)),
      climbed: startY === null ? 0 : Number(((floorY ?? 0) - startY).toFixed(2)),
      biggestStep: Number(biggest.toFixed(3)),
      level,
      frames
    });
  }
  return { legs, MAX_STEP, DT };
}, ROUTE);

let failures = 0;
console.log(`walking at the ${report.DT}s dt cap, MAX_STEP ${report.MAX_STEP}\n`);
for (const leg of report.legs) {
  const ok = leg.arrived && Math.abs(leg.biggestStep) <= report.MAX_STEP + 1e-6;
  if (!ok) failures++;
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} ${leg.name.padEnd(36)} ` +
      `at (${String(leg.at[0]).padStart(6)},${String(leg.at[1]).padStart(6)}) ` +
      `floor ${String(leg.floor).padStart(5)} storey ${leg.level} ` +
      `climbed ${String(leg.climbed).padStart(6)} biggest step ${leg.biggestStep}`
  );
}
console.log(failures ? `\n${failures} leg(s) failed` : '\nall legs walked');

await browser.close();
server.proc.kill();
process.exit(failures ? 1 : 0);
