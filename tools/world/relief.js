// Shaded relief of the sea surface as the clipmap column data holds it (sea level, domes heaped on
// it, slope-limited), seen from above. Shows the 2D part of the world: swells, valleys, heaps.
//
//   node tools/world/relief.js out.png         CX=0 CZ=-15000 HALF=12000 CELL=128 (LOD from CELL)
const W = require('./load.js');
const { writePNG } = require('../lib/png.js');
const out = process.argv[2] || 'relief.png';
const cx = parseFloat(process.env.CX || '0'), cz = parseFloat(process.env.CZ || '-15000'), half = parseFloat(process.env.HALF || '12000');
const cell = parseFloat(process.env.CELL || '128'), lod = cell >= 2048 ? 2 : cell >= 512 ? 1 : 0;
const n = Math.ceil(2 * half / cell / 32) * 32, gi0 = Math.floor((cx - half) / cell), gj0 = Math.floor((cz - half) / cell);
const hs = new Float32Array(n * n), blk = new Float32Array(32 * 32 * 4);
for (let bj = 0; bj < n; bj += 32) for (let bi = 0; bi < n; bi += 32) {
  W.fillColumns(cell, lod, gi0 + bi, gj0 + bj, 32, 32, blk);
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) hs[(bj + j) * n + bi + i] = blk[(j * 32 + i) * 4];
}
let lo = 1e9, hi = -1e9;
for (const v of hs) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
const img = Buffer.alloc(n * n * 3);
const L = [0.5, 0.6, -0.62], ll = Math.hypot(...L);
for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
  const gx = (hs[j * n + i + 1] - hs[j * n + i - 1]) / (2 * cell), gz = (hs[(j + 1) * n + i] - hs[(j - 1) * n + i]) / (2 * cell);
  const nl = Math.hypot(gx, 1, gz), d = Math.max(0, (-gx * L[0] + L[1] - gz * L[2]) / nl / ll), t = (hs[j * n + i] - lo) / (hi - lo);
  const p = (j * n + i) * 3;
  img[p] = 60 + 190 * d * (0.6 + 0.4 * t); img[p + 1] = 60 + 175 * d * (0.6 + 0.4 * t); img[p + 2] = 80 + 150 * d;
}
writePNG(out, n, n, img);
console.log(`height range ${lo.toFixed(0)} .. ${hi.toFixed(0)} m, ${n}x${n} cells of ${cell} m -> ${out}`);
