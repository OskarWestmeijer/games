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
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle']
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__fly, null, { timeout: 60000 });
await page.waitForFunction(() => window.__fly.mapsReady === true, null, { timeout: 180000 });
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const f = window.__fly;
  window.__boltLog = [];
  window.__probe = () => {
    const p = f.plane.position;
    const V = p.constructor;
    const up = p.clone().normalize();
    const fwd = f.plane.getWorldDirection(new V()).negate();
    const flatN = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize();
    const rightV = new V().crossVectors(flatN, up).normalize();
    let best = null, bestD = 1e9;
    for (const b of f.bombers.all) if (b.active) {
      const d = b.position.distanceTo(p);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) return null;
    const to = best.position.clone().sub(p);
    const flatT = to.clone().addScaledVector(up, -to.dot(up)).normalize();
    return {
      dist: Math.round(bestD),
      bearing: +Math.acos(Math.max(-1, Math.min(1, flatT.dot(flatN)))).toFixed(3),
      side: Math.sign(flatT.dot(rightV)),
      phase: best.phase, locked: f.locked, destroyed: f.destroyed
    };
  };
});

const probe = () => page.evaluate(() => window.__probe());
let held = null;
const hold = async (key) => {
  if (held === key) return;
  if (held) await page.keyboard.up(held);
  held = key;
  if (key) await page.keyboard.down(key);
};

// Chase the nearest bomber, firing the whole time, restarting if shot down. Every bolt is
// logged with the range it was fired at, so the outcome is a hit rate against range.
await page.keyboard.down('Space');
for (let i = 0; i < 1400; i++) {
  const s = await probe();
  if (!s) { await page.waitForTimeout(100); continue; }
  if (s.destroyed) { await page.keyboard.up('Space'); await page.keyboard.press('Space');
                     await page.keyboard.down('Space'); await page.waitForTimeout(200); continue; }
  await hold(s.bearing > 0.05 ? (s.side > 0 ? 'ArrowRight' : 'ArrowLeft') : null);
  await page.waitForTimeout(100);
}
await page.keyboard.up('Space');

const log = await page.evaluate(() => window.__boltLog);
const buckets = new Map();
for (const b of log) {
  if (b.range > 900) continue;
  const k = Math.floor(b.range / 50) * 50;
  const e = buckets.get(k) ?? { n: 0, hit: 0 };
  e.n++; if (b.hit) e.hit++;
  buckets.set(k, e);
}
console.log('\n range      shots   hits   hit rate');
for (const k of [...buckets.keys()].sort((a, b) => a - b)) {
  const e = buckets.get(k);
  console.log(`${String(k).padStart(4)}-${String(k + 49).padEnd(4)} ${String(e.n).padStart(7)} ${String(e.hit).padStart(6)}   ${Math.round(e.hit / e.n * 100)}%`);
}
await browser.close();
server.proc.kill();
