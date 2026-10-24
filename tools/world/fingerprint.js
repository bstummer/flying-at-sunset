// Fingerprint of the generated world: everything the page asks of the CPU world generator for a
// fixed set of places (air, sea columns, column blocks of every clipmap level, bubble blocks as the
// bakes gather them, towers, surface heights), hashed. A refactor that keeps the world the same
// keeps the hash; any change to the generator changes it (the parts show where).
//
//   node tools/world/fingerprint.js            compare with fingerprint.json (exit 1 if different)
//   node tools/world/fingerprint.js --write    record the current world as the expected one
//   WSRC=src/world.js node tools/world/fingerprint.js   the world from other files (see load.js)
//   QS="seed=3" node tools/world/fingerprint.js         another seed: parts listed, nothing compared
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const W = require('./load.js');

const parts = {};
function put(name, values) {
  const a = Float64Array.from(values);
  const h = crypto.createHash('sha256').update(Buffer.from(a.buffer)).digest('hex').slice(0, 16);
  let sum = 0, abs = 0;
  for (const v of a) { sum += v; abs += Math.abs(v); }
  parts[name] = { n: a.length, sum: +sum.toPrecision(12), abs: +abs.toPrecision(12), hash: h };
}
const t0 = Date.now();

// the air and the sea columns on a coarse grid around the start
{
  const air = [], col = [], o = {};
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const x = i * 7300 + 130, z = j * 7300 - 410;
    const A = W.airAt(x, z);
    air.push(A.I, A.zs, A.ceil, A.moist, A.ux, A.uz, A.cap, A.dry, A.bmax, A.el);
    for (const lod of [0, 1, 2]) { W.columnFields(x, z, lod, o); col.push(o.hb, o.amp, o.fine, o.rest); }
  }
  put('air', air);
  put('columnFields', col);
}
// column blocks and bubble blocks the way the page's bake jobs ask for them (LEVELS in index.html)
const LV = [
  { cell: 128, lod: 0, chunk: 32, maxD: 1200, minBR: 0 },
  { cell: 512, lod: 1, chunk: 32, maxD: 4000, minBR: 200 },
  { cell: 2048, lod: 2, chunk: 16, maxD: 12000, minBR: 900 },
];
for (const L of LV) {
  const cols = [], bubs = [];
  // (near the start, and in the restless air off to the right of the sun where the towers stand)
  const blocks = L.lod === 0 ? [[-32, -32], [0, -64], [112, -192], [176, -224]] : L.lod === 1 ? [[-32, -32], [0, -32], [32, -64], [64, -32]] : [[-16, -16], [0, 0], [16, -32]];
  for (const [gi, gj] of blocks) {
    const out = new Float32Array(L.chunk * L.chunk * 4);
    W.fillColumns(L.cell, L.lod, gi, gj, L.chunk, L.chunk, out);
    cols.push(...out);
    const bub = new Float32Array(1024 * 4 * 3 * 4), ox = gi * L.cell, oz = gj * L.cell;
    const n = W.gatherBubbles(ox, oz, ox + L.chunk * L.cell, oz + L.chunk * L.cell, L.maxD + 300, L.minBR, ox, oz, bub, 4096, L.lod >= 2);
    bubs.push(n);
    for (let k = 0; k < n; k++) {
      const q = (((k >> 10) * 3) * 1024 + (k & 1023)) * 4;
      for (const r of [0, 4096, 8192]) for (let c = 0; c < 4; c++) bubs.push(bub[q + r + c]);
    }
  }
  put('columns L' + L.lod, cols);
  put('bubbles L' + L.lod, bubs);
}
// the towers the test presets look for, and the surface heights the flight model and presets use
{
  const ts = W.towersNear(0, 0, 120000).sort((a, b) => a.x - b.x || a.z - b.z);
  put('towers', ts.flatMap(t => [t.x, t.z, t.P, t.y0, t.top, t.wide, t.ceil, t.gen]));
  const s = [];
  for (let k = 0; k < 400; k++) {
    const a = k * 2.399963, d = 300 + k * 90, x = Math.sin(a) * d, z = Math.cos(a) * d, r = W.seaSurfaceAt(x, z);
    s.push(r.hb, r.hs, r.floor, W.towerDistAt(x, r.hs + 800, z));
  }
  put('surface', s);
}
const hash = crypto.createHash('sha256').update(JSON.stringify(Object.entries(parts).map(([k, v]) => [k, v.hash]))).digest('hex').slice(0, 24);
const result = { hash, seed: W.WORLD_SEED, query: process.env.QS || '', parts };

const file = path.join(__dirname, 'fingerprint.json');
const exp = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
console.log(`world fingerprint ${hash}  (seed ${W.WORLD_SEED}, ${W.source}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (process.argv.includes('--write')) {
  fs.writeFileSync(file, JSON.stringify(result, null, 1) + '\n');
  console.log('written to', file);
} else if (exp && exp.query === result.query) {
  if (exp.hash === hash) { console.log('same as fingerprint.json'); process.exit(0); }
  console.log('DIFFERENT from fingerprint.json (' + exp.hash + '):');
  for (const [k, v] of Object.entries(parts)) {
    const e = exp.parts[k];
    if (!e || e.hash !== v.hash) console.log(`  ${k}: n ${e ? e.n : '-'} -> ${v.n}, sum ${e ? e.sum : '-'} -> ${v.sum}, abs ${e ? e.abs : '-'} -> ${v.abs}`);
  }
  process.exit(1);
} else {
  for (const [k, v] of Object.entries(parts)) console.log(`  ${k.padEnd(14)} n ${String(v.n).padStart(7)}  sum ${v.sum}  ${v.hash}`);
}
