// Streaming: fly from the start for 480 frames (2 min of flight at dt 0.25 s, about 8 km), then
// start fresh at the exact same pose; the two images must match (apart from the slow drift of the
// billows with time). Saves <outdir>/stream_flown.png and stream_fresh.png and prints the difference.
//
//   node tools/checks/stream.mjs [outdir]
import fs from 'fs';
import path from 'path';
import { launch, openPage, pageURL, waitDone, canvasPNG, comparePNG } from '../lib/browser.mjs';

const dir = process.argv[2] || '.';
const browser = await launch();
async function run(q, out) {
  const { ctx, page, logs } = await openPage(browser, { width: 480, height: 270 });
  await page.goto(pageURL('test&' + q), { timeout: 0 });
  await waitDone(page, 3600000);
  const r = await page.evaluate(() => { const b = window.__debug.bird; return { pos: b.pos, yaw: b.yaw, gamma: b.gamma, bank: b.bank, jobs: window.__debug.worldStats.jobs, err: window.__error || null }; });
  const png = await canvasPNG(page);
  fs.writeFileSync(out, png);
  for (const l of logs.filter(l => l.startsWith('[pageerror]'))) console.log(l);
  await ctx.close();
  return { r, png };
}
const a = await run('preset=start&frames=480&dt=0.25&w=480&h=270&scale=0.5', path.join(dir, 'stream_flown.png'));
console.log('flown', JSON.stringify(a.r));
const p = a.r.pos;
const b = await run(`pose=${p[0]},${p[1]},${p[2]},${a.r.yaw},${a.r.gamma},${a.r.bank}&frames=12&w=480&h=270&scale=0.5`, path.join(dir, 'stream_fresh.png'));
console.log('fresh', JSON.stringify(b.r));
console.log('difference', JSON.stringify(await comparePNG(browser, a.png, b.png)), '(the billows drift with time, so expect small differences, but no missing or extra clouds)');
await browser.close();
