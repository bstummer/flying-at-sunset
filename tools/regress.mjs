// Render regression: a fixed set of small deterministic renders compared with recorded baselines.
// Test renders are deterministic (fixed time step, all world bakes done each frame, the probe read
// back at once), and software GL gives bit-identical images on the same Chromium build, so a
// refactor that changes nothing shows zero difference. Other Chromium versions may differ
// slightly: tolerances below.
//
//   node tools/regress.mjs                 compare all views with tools/baseline/ (exit 1 on failure)
//   node tools/regress.mjs start tower     only these views
//   node tools/regress.mjs record [views]  (re)record baselines from the current page
//   PAGE=dist/index.html node tools/regress.mjs     test another page (e.g. the built output)
//   OUT=dir   where to write the new renders (default tools/out/regress)
//   TOL_MEAN=1.0 TOL_OVER16=0.01   tolerated mean channel difference (0..255) and fraction of
//                                  pixels differing by more than 16
import fs from 'fs';
import path from 'path';
import { TOOLS, launch, openPage, pageURL, pagePath, waitDone, canvasPNG, comparePNG, pool } from './lib/browser.mjs';

// name: query (w, h, frames, scale are added). Views cover the start, every light direction, high
// above, towers near and far, under and inside a tower, another seed, and the cloud geometry alone.
const VIEWS = {
  start: '',
  sun: 'preset=sun', away: 'preset=away', side: 'preset=side', skim: 'preset=skim', high2: 'preset=high2',
  tower: 'preset=tower', giant: 'preset=giant', anvil: 'preset=anvil', close: 'preset=close',
  under: 'preset=under', inside: 'preset=inside',
  seed3: 'seed=3', geometry: 'preset=side&dbg=1',
};
const SIZE = '&w=320&h=180&frames=8&scale=0.5';
const dir = path.join(TOOLS, 'baseline');
const out = process.env.OUT ? path.resolve(process.env.OUT) : path.join(TOOLS, 'out', 'regress');
const args = process.argv.slice(2);
const record = args[0] === 'record';
const names = (record ? args.slice(1) : args).length ? (record ? args.slice(1) : args) : Object.keys(VIEWS);
for (const n of names) if (!(n in VIEWS)) { console.error('unknown view ' + n + '; views: ' + Object.keys(VIEWS).join(' ')); process.exit(2); }
const tolMean = +(process.env.TOL_MEAN || 1.0), tolOver16 = +(process.env.TOL_OVER16 || 0.01);
fs.mkdirSync(record ? dir : out, { recursive: true });

const browser = await launch();
const results = await pool(names, 2, async name => {
  const { ctx, page, logs } = await openPage(browser, { width: 320, height: 180 });
  const t0 = Date.now();
  await page.goto(pageURL('test&' + VIEWS[name] + SIZE), { timeout: 0 });
  await waitDone(page);
  const err = await page.evaluate(() => window.__error || null);
  const png = await canvasPNG(page);
  await ctx.close();
  const pageErrors = logs.filter(l => l.startsWith('[pageerror]'));
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (record) {
    fs.writeFileSync(path.join(dir, name + '.png'), png);
    console.log(`recorded ${name} (${secs} s)${err ? ' ERROR ' + err : ''}`);
    return { name, ok: !err && !pageErrors.length };
  }
  fs.writeFileSync(path.join(out, name + '.png'), png);
  const base = path.join(dir, name + '.png');
  if (!fs.existsSync(base)) { console.log(`?    ${name}: no baseline`); return { name, ok: false }; }
  const d = await comparePNG(browser, fs.readFileSync(base), png);
  const ok = !err && !pageErrors.length && !d.sizeMismatch && d.mean <= tolMean && d.over16 <= tolOver16;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(9)} mean ${d.mean !== undefined ? d.mean.toFixed(3) : '-'}  max ${d.max}  >4: ${d.over4 !== undefined ? (d.over4 * 100).toFixed(2) : '-'}%  >16: ${d.over16 !== undefined ? (d.over16 * 100).toFixed(2) : '-'}%  (${secs} s)${err ? '  error: ' + err : ''}${pageErrors.length ? '  ' + pageErrors[0] : ''}`);
  return { name, ok };
});
if (record) {
  const manifest = { recorded: new Date().toISOString(), page: path.relative(path.dirname(TOOLS), pagePath()), chromium: browser.version(), size: SIZE, views: VIEWS };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
}
await browser.close();
const bad = results.filter(r => !r.ok).map(r => r.name);
console.log(record ? `baselines in ${dir}` : bad.length ? `FAILED: ${bad.join(' ')} (new renders in ${out})` : `all ${results.length} views match (new renders in ${out})`);
process.exit(bad.length ? 1 : 0);
