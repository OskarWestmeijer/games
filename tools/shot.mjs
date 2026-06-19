// Self-review screenshot tool.
// Boots the Vite dev server, loads the game in headless Chromium, lets it render
// for a moment, optionally walks the player, and writes a PNG to tools/shots/.
//
//   node tools/shot.mjs [name] [--wait ms] [--keys WASD] [--w 1280] [--h 800]
//
// Lets Claude review the rendered game without the user supplying screenshots.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const shotsDir = join(__dirname, 'shots');
mkdirSync(shotsDir, { recursive: true });

const args = process.argv.slice(2);
const name = args[0] && !args[0].startsWith('--') ? args[0] : 'shot';
function opt(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const waitMs = Number(opt('--wait', '1500'));
const keys = opt('--keys', '');
const W = Number(opt('--w', '1280'));
const H = Number(opt('--h', '800'));

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (async function poll() {
      try {
        const r = await fetch(url);
        if (r.ok) return resolve();
      } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error('server timeout'));
      setTimeout(poll, 200);
    })();
  });
}

const PORT = 5199;
const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});

let browser;
try {
  const url = `http://localhost:${PORT}/`;
  await waitForServer(url);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(waitMs);

  // Optionally drive the player so we can review motion / different spots.
  for (const k of keys) {
    const code = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD' }[k.toLowerCase()];
    if (!code) continue;
    await page.keyboard.down(code);
    await page.waitForTimeout(700);
    await page.keyboard.up(code);
  }
  if (keys) await page.waitForTimeout(400);

  const out = join(shotsDir, `${name}.png`);
  await page.screenshot({ path: out });
  if (errors.length) console.error('PAGE ERRORS:\n' + errors.join('\n'));
  console.log(out);
} finally {
  if (browser) await browser.close();
  dev.kill('SIGTERM');
}
