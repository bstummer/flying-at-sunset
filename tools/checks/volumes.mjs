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
const res = await page.evaluate(() => {
  const gl = document.getElementById('view').getContext('webgl2');
  const D = window.__debug, out = {};
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  for (const [name, L] of [['L0', D.LEVELS[0]], ['L1', D.LEVELS[1]], ['L2', D.LEVELS[2]], ['TSV', D.TSVL]]) {
    const N = 256, buf = new Float32Array(N * N * 4), top = new Float32Array(N * N);
    let nan = 0, neg = 0;
    for (let z = 0; z < L.nz; z++) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, L.vol.tex, 0, z);
      gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, buf);
      for (let p = 0; p < N * N; p++) { const v = buf[p * 4]; if (!isFinite(v)) nan++; if (v < 0) neg++; if (z === L.nz - 1) top[p] = v; }
    }
    let topNeg = 0;
    for (let p = 0; p < N * N; p++) if (top[p] < 0) topNeg++;
    out[name] = { nan, neg, topNeg, valid: L.valid };
  }
  for (const [name, L] of [['C0', D.LEVELS[0]], ['C1', D.LEVELS[1]], ['C2', D.LEVELS[2]]]) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, L.col.tex, 0);
    const N = 256, buf = new Float32Array(N * N * 4);
    gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, buf);
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
