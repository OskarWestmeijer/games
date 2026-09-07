import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = process.argv[2];
const VIEW = { width: 1280, height: 800 };

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
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__fly, null, { timeout: 60000 });
await page.waitForFunction(() => window.__fly.mapsReady === true, null, { timeout: 180000 });
await page.waitForTimeout(2000);

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const st = await page.evaluate(() => ({
    speed: Math.round(window.__fly.speed),
    alt: Math.round(window.__fly.plane.position.length() - 300)
  }));
  console.log(`  ${name}.png  speed=${st.speed} alt=${st.alt}`);
};

await shot('1-level');
await page.waitForTimeout(9000);
await shot('1b-still-level');

// Hold left arrow: should roll and then carve a banked turn.
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(1400);
await shot('2-banking-left');
await page.waitForTimeout(9000);
await shot('2b-held-turn');
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(3000);
await shot('3-rolled-out');

// Pitch up towards space.
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(1200);
await shot('4-pitch-up');
await page.keyboard.up('ArrowUp');

// Throttle up, then brake with S.
await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
await shot('5-throttle-open');
await page.keyboard.up('KeyW');
await page.keyboard.down('KeyS');
await page.waitForTimeout(2000);
await shot('6-braking');
await page.keyboard.up('KeyS');

// Dive back at the planet and hold it there — tests the altitude floor.
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(2600);
await page.keyboard.up('ArrowDown');
await page.waitForTimeout(6000);
await shot('7-low-pass');

// Rudder only.
await page.keyboard.down('KeyD');
await page.waitForTimeout(1500);
await shot('8-rudder');
await page.keyboard.up('KeyD');

if (problems.length) {
  console.log('\nconsole output:');
  for (const p of [...new Set(problems)].slice(0, 20)) console.log('  ' + p);
}

await browser.close();
server.proc.kill();
