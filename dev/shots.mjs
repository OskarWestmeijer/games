/**
 * Screenshot harness. Starts a Vite dev server, drives planet view with a headless
 * Chromium, and writes a PNG per scripted camera pose.
 *
 * The point of it is that the station's shape is only judgeable by eye, and the numeric
 * checks in `walk.mjs` say nothing about how it looks. Run it after any change to the
 * hull, then actually look at the output.
 *
 *   node dev/shots.mjs [outDir]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'dev/shots';
const VIEW = { width: 1280, height: 800 };

/** Poses are station-local: the camera is a child of `stationRig`. */
const POSES = [
  { name: '1-spawn', note: 'where you arrive: head of the stairs, cap window ahead' },
  { name: '2-nose', pos: [0, 1.78, -5.2], look: [0, 1.5, -12] },
  { name: '3-lounge-fwd', pos: [0, 1.6, -0.4], look: [0, 1.2, -12] },
  { name: '4-aft-fwd', pos: [0, 1.6, 5.4], look: [0, 1.5, -12] },
  { name: '5-console', pos: [0, 4.35, 4.2], look: [0, 3.6, -12] },
  { name: '6-bridge-aft', pos: [0, 4.35, 2.4], look: [0, 4.2, 8] },
  { name: '7-stair-foot', pos: [1.9, 1.6, -3.9], look: [3.8, 3.0, 1.0] },
  { name: '8-nose-up', pos: [0, 1.6, -2.4], look: [0, 4.0, -8.2] },
  { name: '9-side', pos: [-3.6, 2.0, -1.2], look: [1.6, 1.6, -7.0] },
  { name: '10-lounge-up', pos: [0, 1.6, -3.0], look: [0, 6.5, -5.0] },
  { name: '11-lounge-stbd', pos: [-0.8, 1.6, -2.4], look: [8.0, 2.6, -3.0] },
  { name: '12-lounge-port', pos: [0.8, 1.6, -2.4], look: [-8.0, 2.6, -3.0] },
  // The two the couch exists for: standing in the mouth of the U, and looking back at it.
  { name: '13-in-the-U', pos: [0, 1.78, -5.3], look: [0, 1.4, -12] },
  { name: '14-couch-back', pos: [0, 1.9, -7.2], look: [0, 1.0, -1.0] },
  { name: '15-stair-down', pos: [3.5, 4.0, 1.4], look: [1.5, 0.6, -6.0] },
  // Outside. The station's silhouette is the one thing about it nobody aboard can ever see —
  // there is no exterior view in the site — so every previous shape mistake (the open tail, the
  // spike of a nose) was found by accident from inside, late. `pose()` takes station-local
  // coordinates and the camera is a child of the rig, so standing off the hull costs nothing.
  { name: '16-outside-bow', pos: [-13, 6.5, -13], look: [0.5, 2.6, 0.5], note: 'the concept art\'s own 3/4' },
  { name: '17-outside-side', pos: [-24, 3.2, -0.4], look: [0, 3.2, -0.4], note: 'profile silhouette' },
  { name: '18-outside-nose', pos: [0, 3.0, -20], look: [0, 3.0, 0], note: 'the cap window head-on' },
  { name: '19-outside-plan', pos: [-5, 22, -0.4], look: [0, 1.5, -0.4], note: 'the ovoid in plan' }
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
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    // Headless Chromium has no GPU, so WebGL has to come from SwiftShader. Without both
    // of these the context creation fails silently and every shot is a blank canvas.
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--disable-lcd-text'
  ]
});
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

await page.goto(`${server.url}/#`, { waitUntil: 'load' });

// The HUD is not what is being reviewed, and the mode switcher sits exactly where the roof
// of the nose lands in half these framings.
await page.addStyleTag({ content: '#mode-switcher,.hud,#planet-credit,#crosshair{display:none!important}' });

// The debug handle is installed by `planet-view.ts` under import.meta.env.DEV, once the
// scene exists — which is after a dynamic import, so it is never there on first paint.
await page.waitForFunction(() => !!window.__station, null, { timeout: 60000 });
// Then wait for the planet maps: until they resolve the shader draws its procedural
// stand-in, and a shot taken early is of a world that is not the one being reviewed.
await page.waitForFunction(() => window.__station.mapsReady === true, null, { timeout: 120000 });
await page.waitForTimeout(1500);

for (const pose of POSES) {
  if (pose.pos) {
    await page.evaluate(([p, l]) => window.__station.pose(p, l), [pose.pos, pose.look]);
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `${OUT}/${pose.name}.png` });
  console.log(`  ${OUT}/${pose.name}.png${pose.note ? '  — ' + pose.note : ''}`);
}

if (problems.length) {
  console.log('\nconsole output:');
  for (const p of [...new Set(problems)].slice(0, 20)) console.log('  ' + p);
}

await browser.close();
server.proc.kill();
