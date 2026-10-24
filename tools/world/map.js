// Top-down map of a world: restlessness of the air (grey, brighter = more restless) and the towers
// (discs sized by cell potential P, coloured by top height: blue < 4 km < cyan < 6 km < yellow
// < 9 km < orange < 11.5 km < red). Magenta cross: the start. North (-Z, toward the sun) is up.
//
//   node tools/world/map.js out.png            HALF=200000 N=600 CX=0 CZ=0 QS="seed=3"
const W = require('./load.js');
const { writePNG } = require('../lib/png.js');
const out = process.argv[2] || 'map.png';
const half = parseFloat(process.env.HALF || '200000'), N = parseInt(process.env.N || '600', 10);
const cx = parseFloat(process.env.CX || '0'), cz = parseFloat(process.env.CZ || '0');
const img = Buffer.alloc(N * N * 3);
const hist = new Array(10).fill(0);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = cx - half + (i + 0.5) / N * 2 * half, z = cz - half + (j + 0.5) / N * 2 * half;
  const I = W.restAt(x, z);
  hist[Math.min(9, Math.floor(I * 10))]++;
  const p = (j * N + i) * 3, g = 40 + 150 * I;
  img[p] = g; img[p + 1] = g; img[p + 2] = g + 20;
}
console.log('restlessness histogram (tenths):', hist.map(h => (h / (N * N) * 100).toFixed(1) + '%').join(' '));
const ts = W.towersNear(cx, cz, half * 1.42);
const col = top => top > 11500 ? [255, 40, 40] : top > 9000 ? [255, 150, 30] : top > 6000 ? [255, 240, 60] : top > 4000 ? [80, 220, 255] : [60, 120, 255];
for (const t of ts) {
  const i0 = Math.floor((t.x - cx + half) / (2 * half) * N), j0 = Math.floor((t.z - cz + half) / (2 * half) * N);
  const rad = Math.max(1, Math.round(t.P / (2 * half) * N)), c = col(t.top);
  for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
    if (di * di + dj * dj > rad * rad) continue;
    const i = i0 + di, j = j0 + dj;
    if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const p = (j * N + i) * 3; img[p] = c[0]; img[p + 1] = c[1]; img[p + 2] = c[2];
  }
}
const si = Math.floor((0 - cx + half) / (2 * half) * N), sj = Math.floor((0 - cz + half) / (2 * half) * N);
for (let d = -4; d <= 4; d++) for (const [i, j] of [[si + d, sj], [si, sj + d]]) {
  if (i < 0 || j < 0 || i >= N || j >= N) continue;
  const p = (j * N + i) * 3; img[p] = 255; img[p + 1] = 0; img[p + 2] = 255;
}
writePNG(out, N, N, img);
console.log(`towers ${ts.length}, tops > 6 km ${ts.filter(t => t.top > 6000).length}, > 11.5 km ${ts.filter(t => t.top > 11500).length} -> ${out}`);
