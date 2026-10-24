// Side views (orthographic, looking along +Z, 40 km wide x 16 km tall) of the biggest towers in an
// area, one tile each, with a 1 km tick (bottom left, red) and the ceiling (dashed red). Large
// shapes only (the bubbles and the sea level), shaded by one light: for judging tower silhouettes.
//
//   node tools/world/catalog.js out.png        CX=0 CZ=0 R=150000 K=12 MINTOP=... ONE=1 (only the
//                                              tower's own bubbles, not its neighbours')
const W = require('./load.js');
const { writePNG } = require('../lib/png.js');
const out = process.argv[2] || 'catalog.png';
const cx = parseFloat(process.env.CX || '0'), cz = parseFloat(process.env.CZ || '0'), R = parseFloat(process.env.R || '150000');
const K = parseInt(process.env.K || '12', 10), TW = 300, TH = 150, SPANX = 40000, SPANY = 16000;
const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
let ts = W.towersNear(cx, cz, R).sort((a, b) => b.top - a.top);
if (process.env.MINTOP) ts = ts.filter(t => t.top > parseFloat(process.env.MINTOP));
// skip towers within 15 km of a bigger one already shown (the same complex)
const pick = [];
for (const t of ts) { if (pick.length >= K) break; if (pick.every(p => Math.hypot(p.x - t.x, p.z - t.z) > 15000)) pick.push(t); }
const cols = 3, rows = Math.max(1, Math.ceil(pick.length / cols));
const img = Buffer.alloc(cols * TW * rows * TH * 3, 255);
const L = [-0.55, 0.5, -0.67]; { const l = Math.hypot(...L); L[0] /= l; L[1] /= l; L[2] /= l; }
pick.forEach((t, n) => {
  const bub = [];
  W.forEachSys(t.x - SPANX, t.z - SPANX, t.x + SPANX, t.z + SPANX, c => { for (const b of c.bub) if ((!process.env.ONE || b.cell === t.cell) && Math.abs(b.x - t.x) < SPANX / 2 + b.br && Math.abs(b.z - t.z) < SPANX) bub.push(b); });
  const sea = t.y0, ox = (n % cols) * TW, oy = Math.floor(n / cols) * TH;
  for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
    const x = t.x - SPANX / 2 + (px + 0.5) / TW * SPANX, y = SPANY * (1 - (py + 0.5) / TH);
    const cand = bub.filter(b => Math.abs(b.x - x) < b.br + 300 && Math.abs(b.y - y) < b.br + 300);
    const sdf = (xx, yy, zz) => { let d = 2000; for (const b of cand) d = smin(d, W.ellDist(b, xx, yy, zz), b.k); const above = yy - sea; return smin(above, d, 700 + (60 - 700) * ss(0, 1800, above)); };
    let z = t.z - SPANX, hit = false;
    for (let k = 0; k < 160 && z < t.z + SPANX; k++) { const d = sdf(x, y, z); if (d < 20) { hit = true; break; } z += Math.max(d * 0.9, 30); }
    const p = ((oy + py) * cols * TW + ox + px) * 3;
    if (!hit) { const s = 200 + 40 * py / TH; img[p] = s - 50; img[p + 1] = s - 25; img[p + 2] = 245; continue; }
    const e = 40, nx = sdf(x + e, y, z) - sdf(x - e, y, z), ny = sdf(x, y + e, z) - sdf(x, y - e, z), nz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const nl = Math.hypot(nx, ny, nz) || 1, c = 0.3 + 0.7 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / nl);
    img[p] = 255 * c; img[p + 1] = 240 * c; img[p + 2] = 220 * c;
  }
  for (let k = 0; k < 8; k++) { const p = ((oy + TH - 3) * cols * TW + ox + 4 + k) * 3; img[p] = 255; img[p + 1] = 0; img[p + 2] = 0; }
  const cy = Math.round(TH * (1 - t.ceil / SPANY));
  for (let px = 0; px < TW; px += 3) { const p = ((oy + cy) * cols * TW + ox + px) * 3; img[p] = 255; img[p + 1] = 60; img[p + 2] = 60; }
  console.log(n, `(${(t.x / 1000).toFixed(1)}, ${(t.z / 1000).toFixed(1)}) km  P ${t.P.toFixed(0)}  top ${(t.top / 1000).toFixed(1)} km  wide ${(t.wide / 1000).toFixed(1)} km  bubbles ${bub.length}`);
});
writePNG(out, cols * TW, rows * TH, img);
console.log('->', out);
