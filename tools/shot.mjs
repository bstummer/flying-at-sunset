// Render one deterministic frame sequence of the page and save the canvas as PNG.
//
//   node tools/shot.mjs out.png "preset=start&frames=12&w=640&h=360&scale=0.5" [timeoutSec]
//
// `test` is added to the query (fixed time step, stops after `frames`). Prints one JSON line
// ({err, frame, gpu, secs}; gpu holds per-pass times with &cpuprof) and then the page's console
// messages. The viewport is the w x h of the query. PAGE=... renders another page (see lib).
import fs from 'fs';
import { launch, openPage, pageURL, waitDone, canvasPNG } from './lib/browser.mjs';

const [, , out, query = 'preset=start', tmo = '1200'] = process.argv;
if (!out) { console.error('usage: node tools/shot.mjs out.png "query" [timeoutSec]'); process.exit(2); }
const params = new URLSearchParams(query);
const w = parseInt(params.get('w') || '960', 10), h = parseInt(params.get('h') || '540', 10);
const browser = await launch();
const { page, logs } = await openPage(browser, { width: w, height: h });
const t0 = Date.now();
await page.goto(pageURL('test&' + query), { timeout: 0 });
try { await waitDone(page, parseFloat(tmo) * 1000); } catch (e) { logs.push('[timeout] ' + e.message.split('\n')[0]); }
const info = await page.evaluate(() => ({
  err: window.__error || null, frame: window.__frame,
  gpu: window.__gpu ? Object.fromEntries(Object.entries(window.__gpu).map(([k, v]) => [k, +v.toFixed(1)])) : null,
}));
fs.writeFileSync(out, await canvasPNG(page));
console.log(JSON.stringify({ ...info, secs: (Date.now() - t0) / 1000 }));
for (const l of logs.slice(0, 40)) console.log(l.slice(0, 3000));
await browser.close();
