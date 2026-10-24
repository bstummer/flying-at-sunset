// Dynamic resolution in normal use: frame count and cloud resolution scale every second. Software GL
// is far over budget, so this exercises the "weak GPU" path (the scale should fall quickly to its
// floor, the page keep running). On a real GPU, run with CHROMIUM_ARGS="--use-angle=default" and
// a headed browser to see the scale settle where the frame rate holds.
//
//   node tools/checks/dynres.mjs [seconds]
import { launch, openPage, pageURL } from '../lib/browser.mjs';

const secs = +(process.argv[2] || 60);
const browser = await launch();
const { page, logs } = await openPage(browser, { width: 640, height: 360 });
await page.goto(pageURL('debug'), { timeout: 0 });
const out = [];
await page.waitForFunction(() => window.__debug && window.__frame > 0, null, { timeout: 600000, polling: 500 });
const t0 = Date.now();
while (Date.now() - t0 < secs * 1000) { await page.waitForTimeout(2000); out.push(await page.evaluate(() => window.__frame + '@' + window.__debug.R.scale.toFixed(2))); }
console.log('frame@scale every 2 s from the first frame:', out.join(' '));
console.log('DR', await page.evaluate(() => JSON.stringify(window.__debug.DR)));
for (const l of logs.filter(l => l.includes('error')).slice(0, 10)) console.log(l);
await browser.close();
