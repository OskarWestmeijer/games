// Screenshots a local static HTML/SVG mockup to PNG for self-review.
//   node design/farm-layout/shot.mjs <file.html> <out.png>
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const [, , file, out] = process.argv;
const url = 'file://' + resolve(file);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
await page.screenshot({ path: resolve(out), fullPage: true });
await browser.close();
console.log('wrote', out);
