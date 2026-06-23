import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = '/home/oskar/development/games';
const PORT = 5192;
const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (async function poll() {
      try { const r = await fetch(url); if (r.ok) return resolve(); } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
      setTimeout(poll, 200);
    })();
  });
}

let browser;
try {
  await waitForServer(`http://localhost:${PORT}/`);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.click('#admin-toggle');
  await page.waitForTimeout(200);
  await page.selectOption('#character-select', 'miina');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${root}/tools/shots/miina-idle.png` });

  // Walk right to see the walk-right cycle.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${root}/tools/shots/miina-walk-right.png` });
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(200);

  // Walk left to see the walk-left cycle.
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${root}/tools/shots/miina-walk-left.png` });
  await page.keyboard.up('KeyA');

  console.log('done');
} finally {
  if (browser) await browser.close();
  dev.kill('SIGTERM');
}
