// Sanity of the baked world volumes after a test render: NaNs, negative distances in the top slice
// of a clipmap level (cloud reaching the volume ceiling), and the value ranges of the column maps
// (R sea surface, G billow strength, B fine billows, A sea level without heaps).
//
//   node tools/checks/volumes.mjs ["preset=start"]
import { launch, openPage, pageURL, waitDone } from '../lib/browser.mjs';

const browser = await launch();
const { page, logs } = await openPage(browser, { width: 200, height: 120 });
await page.goto(pageURL('test&frames=2&w=160&h=90&' + (process.argv[2] || '')), { timeout: 0 });
await waitDone(page);
const res = await page.evaluate(async () => {
  const D = window.__debug, out = {}, N = 256;
  for (const [name, L] of [['L0', D.LEVELS[0]], ['L1', D.LEVELS[1]], ['L2', D.LEVELS[2]], ['TSV', D.TSVL]]) {
    const v = await D.readTexture(L.vol, 0, L.nz);    // one value per texel, slice after slice
    let nan = 0, neg = 0, topNeg = 0;
    for (let k = 0; k < v.length; k++) {
      if (!isFinite(v[k])) nan++;
      if (v[k] < 0) { neg++; if (k >= (L.nz - 1) * N * N) topNeg++; }
    }
    out[name] = { nan, neg, topNeg, valid: L.valid };
  }
  for (const [name, L] of [['C0', D.LEVELS[0]], ['C1', D.LEVELS[1]], ['C2', D.LEVELS[2]]]) {
    const buf = await D.readTexture(L.col);
    const mn = [1e9, 1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9, -1e9];
    let bad = 0;
    for (let p = 0; p < N * N; p++) for (let c = 0; c < 4; c++) { const v = buf[p * 4 + c]; if (!isFinite(v)) bad++; mn[c] = Math.min(mn[c], v); mx[c] = Math.max(mx[c], v); }
    out[name] = { min: mn.map(v => +v.toFixed(2)), max: mx.map(v => +v.toFixed(2)), bad };
  }
  out.stats = D.worldStats;
  return out;
});
console.log(JSON.stringify(res, null, 1));
for (const l of logs.filter(l => l.includes('error')).slice(0, 10)) console.log(l);
await browser.close();
