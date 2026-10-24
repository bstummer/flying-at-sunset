// Per-pass cost on software GL (?cpuprof: a fence after every pass), for one page or to compare two:
// world (generation + bakes), sky, trace (the cloud raymarch), taau, bird, post. Milliseconds summed
// over the frames; only ratios between pages are meaningful (a real GPU behaves differently).
//
//   node tools/checks/profile.mjs [pageB.html] [preset ...]     (page A = PAGE or index.html)
//   e.g. node tools/checks/profile.mjs /tmp/variant.html start side high2 tower
import fs from 'fs';
import { launch, openPage, pageURL, pagePath, waitDone } from '../lib/browser.mjs';

let args = process.argv.slice(2);
const pages = [pagePath()];
if (args[0] && fs.existsSync(args[0])) pages.push(args.shift());
const presets = args.length ? args : ['start', 'side', 'high2', 'tower'];
const browser = await launch();
for (const p of presets) {
  const rows = [];
  for (const pg of pages) {   // one at a time: timings suffer when runs overlap
    const { ctx, page } = await openPage(browser, { width: 640, height: 360 });
    await page.goto(pageURL(`test&preset=${p}&frames=12&w=640&h=360&scale=0.5&cpuprof`, pg), { timeout: 0 });
    await waitDone(page);
    rows.push(await page.evaluate(() => window.__gpu || {}));
    await ctx.close();
  }
  const keys = Object.keys(rows[0]);
  console.log(p.padEnd(8), keys.map(k => `${k} ${rows.map(r => (r[k] || 0).toFixed(0)).join(' / ')}${rows.length > 1 && rows[0][k] ? ` (${((rows[1][k] / rows[0][k] - 1) * 100).toFixed(0)}%)` : ''}`).join('  '));
}
await browser.close();
