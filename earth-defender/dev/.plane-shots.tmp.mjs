// Scratch harness for the aeroplane itself — the model and the two gauges on it, which is
// what `.fly-shots.tmp.mjs` next door is *not* about (that one is the flight model, and its
// frames are too wide to judge a bar three units long).
//
//   node dev/.plane-shots.tmp.mjs dev/shots/plane
//
// Two kinds of frame, and both are needed:
//
//   plane-*  the whole aeroplane at the chase camera's own distance, which is the only place
//            it is ever seen from — so this is where the silhouette either reads or does not.
//   gauge-*  the magazine cropped tight out of a 2560-wide render. There is no zoom here, and
//            a bar you cannot resolve is a bar you will tune wrong: the fill's bloom halo makes
//            it measure fuller than it is, which is exactly the sort of thing only a crop shows.
//
// **Both sides of the terminator matter.** The gauge's surround is unlit for a reason (see
// `buildPlane()`), and the failure it is guarding against only appears in sunlight. The orbit
// walks across the terminator on its own during a run, so take the whole set and look at all
// of it rather than the first frame that looks right.
//
// The magazine is 120 rounds at about two a second, so emptying it is the best part of a
// minute of held fire. That is why this takes ~3 minutes; there is no way to set the count
// from outside, and adding one to the view for a harness's sake is not worth it.
import { spawn } from 'node:child_process';
import { mkdirSync, appendFileSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = process.argv[2];

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
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle', '--disable-lcd-text']
});
// Rendered at 2560 and cropped, never scaled: cropping a big render is the only zoom there is.
const page = await browser.newPage({ viewport: { width: 2560, height: 1600 }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__fly, null, { timeout: 60000 });
// Until the surface maps resolve, every frame is of the procedural stand-in and not of Earth.
await page.waitForFunction(() => window.__fly.mapsReady === true, null, { timeout: 180000 });
await page.waitForTimeout(2500);

const PLANE = { x: 940, y: 560, width: 700, height: 540 };
const GAUGE = { x: 1020, y: 650, width: 560, height: 130 };

const shot = async (name, clip) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, clip });
  const st = await page.evaluate(() => ({
    rds: document.querySelector('#fly-ammo').textContent,
    rkt: document.querySelector('#fly-rockets').textContent
  }));
  // To a file as well as to stdout: a picture of a gauge is unreadable without the number it
  // is meant to be showing, and stdout from a backgrounded run is easy to lose.
  const line = `  ${name}.png  rds=${st.rds} rkt=${st.rkt}\n`;
  process.stdout.write(line);
  appendFileSync(`${OUT}/readings.txt`, line);
};

await shot('plane-full', PLANE);
await shot('gauge-full', GAUGE);

// Banked, for the one view of the aeroplane that is not dead astern.
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(1500);
await shot('plane-banked', PLANE);
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(3000);

// Two rockets off the rack: the outer pair goes first, so this is the frame that says whether
// an emptying rack still looks like a rack.
await page.keyboard.press('KeyR');
await page.waitForTimeout(600);
await page.keyboard.press('KeyR');
await page.waitForTimeout(1500);
await shot('plane-two-rockets', PLANE);

// …and down through the magazine, a frame every fourteen seconds.
await page.keyboard.down('Space');
for (const n of ['a', 'b', 'c', 'd', 'e']) {
  await page.waitForTimeout(14000);
  await shot(`gauge-${n}`, GAUGE);
}
await shot('plane-dry', PLANE);
await page.keyboard.up('Space');

if (problems.length) {
  console.log('\nconsole output:');
  for (const p of [...new Set(problems)].slice(0, 20)) console.log('  ' + p);
}

await browser.close();
server.proc.kill();
