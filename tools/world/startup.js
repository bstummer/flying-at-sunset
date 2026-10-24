// CPU cost of the page's first frame: column data and bubble gathering of every block of every
// clipmap level, in the order and with the arguments the page uses (runJob in index.html; keep in
// sync). The GPU bakes are not included. Node's V8 is close to the browser's.
//
//   node tools/world/startup.js
const W = require('./load.js');
const LV = [
  { cell: 128, lod: 0, chunk: 32, maxD: 1200, minBR: 0 },
  { cell: 512, lod: 1, chunk: 32, maxD: 4000, minBR: 200 },
  { cell: 2048, lod: 2, chunk: 16, maxD: 12000, minBR: 900 },
];
const CLIP_N = 256;
const bub = new Float32Array(1024 * 4 * 3 * 4);
let tot = 0;
for (let l = LV.length - 1; l >= 0; l--) {   // the page shifts the coarse levels first
  const L = LV[l], t0 = Date.now();
  let nb = 0, maxb = 0, blocks = 0;
  for (let bj = -CLIP_N / 2; bj < CLIP_N / 2; bj += L.chunk) for (let bi = -CLIP_N / 2; bi < CLIP_N / 2; bi += L.chunk)
    W.fillColumns(L.cell, L.lod, bi, bj, L.chunk, L.chunk, new Float32Array(L.chunk * L.chunk * 4));
  const t1 = Date.now();
  for (let bj = -CLIP_N / 2; bj < CLIP_N / 2; bj += L.chunk) for (let bi = -CLIP_N / 2; bi < CLIP_N / 2; bi += L.chunk) {
    const ox = bi * L.cell, oz = bj * L.cell;
    const n = W.gatherBubbles(ox, oz, ox + L.chunk * L.cell, oz + L.chunk * L.cell, L.maxD + 300, L.minBR, ox, oz, bub, 4096, L.lod >= 2);
    nb += n; maxb = Math.max(maxb, n); blocks++;
  }
  const t2 = Date.now();
  console.log(`level ${String(L.cell).padStart(4)} m: columns ${t1 - t0} ms, bubbles ${t2 - t1} ms; bubbles per block avg ${(nb / blocks).toFixed(0)}, max ${maxb} (cap 4096)`);
  tot += t2 - t0;
}
console.log(`total ${tot} ms, heap ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB`);
