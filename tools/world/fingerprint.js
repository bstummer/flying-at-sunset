// Fingerprint of the generated world: everything the page asks of the CPU world generator for a
// fixed set of places (air, sea columns, column blocks of every clipmap level, bubble blocks as the
// bakes gather them, towers, surface heights), summed per part. A refactor that keeps the world
// the same keeps every part; any change to the generator changes some (the parts show where).
// tests/world.test.js compares the world with tests/fixtures/world-fingerprint.json.
//
//   node tools/world/fingerprint.js            compare with the recorded fingerprint
//   node tools/world/fingerprint.js --write    record the current world as the expected one
//   WSRC=... / QS="seed=3" node tools/world/fingerprint.js   another world (see load.js)
//
// Each part keeps its count and sums, not a hash: Math.sin, exp and pow may round their last bit
// differently in another Node version, which a hash would report as a different world. One sum
// weighs each value by where it comes (`at`): the same values in another order (a block
// transposed, columns shifted) are another world.
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RECORDED = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tests', 'fixtures', 'world-fingerprint.json');

// The clipmap levels as the page's bake jobs ask for them (LEVELS in src/render/stream.js).
const LEVELS = [
  { cell: 128, lod: 0, chunk: 32, maxD: 1200, minBR: 0 },
  { cell: 512, lod: 1, chunk: 32, maxD: 4000, minBR: 200 },
  { cell: 2048, lod: 2, chunk: 16, maxD: 12000, minBR: 900 },
];

export function summary(values) {
  let sum = 0, abs = 0, sq = 0, at = 0, k = 0;
  for (const v of values) {
    sum += v;
    abs += Math.abs(v);
    sq += v * v;
    at += v * (1 + (k++ % 101) / 101);
  }
  return { n: values.length, sum, abs, sq, at };
}

export function fingerprint(W) {
  const parts = {};
  // the air and the sea columns on a coarse grid around the start
  {
    const air = [], col = [], o = {};
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const x = i * 7300 + 130, z = j * 7300 - 410;
      const A = W.airAt(x, z);
      air.push(A.I, A.zs, A.ceil, A.moist, A.ux, A.uz, A.cap, A.dry, A.bmax, A.el);
      for (const lod of [0, 1, 2]) {
        W.columnFields(x, z, lod, o);
        col.push(o.hb, o.amp, o.fine, o.rest);
      }
    }
    parts.air = summary(air);
    parts.columnFields = summary(col);
  }
  // column blocks and bubble blocks, near the start and in the restless air off to the right of
  // the sun where the towers stand
  for (const L of LEVELS) {
    const cols = [], bubs = [];
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
    parts[`columns L${L.lod}`] = summary(cols);
    parts[`bubbles L${L.lod}`] = summary(bubs);
  }
  // the towers the test views look for, and the surface heights the flight and the views use
  {
    const ts = W.towersNear(0, 0, 120000).sort((a, b) => a.x - b.x || a.z - b.z);
    parts.towers = summary(ts.flatMap((t) => [t.x, t.z, t.P, t.y0, t.top, t.wide, t.ceil, t.gen]));
    const s = [];
    for (let k = 0; k < 400; k++) {
      const a = k * 2.399963, d = 300 + k * 90, x = Math.sin(a) * d, z = Math.cos(a) * d, r = W.seaSurfaceAt(x, z);
      s.push(r.hb, r.hs, r.floor, W.towerDistAt(x, r.hs + 800, z));
    }
    parts.surface = summary(s);
  }
  return { seed: W.WORLD_SEED, parts };
}

// The parts that differ between two fingerprints: a count that differs, or a sum off by more
// than `tolerance` of the sum of magnitudes (rounding differences are far smaller).
export function differences(expected, actual, tolerance = 1e-9) {
  const names = new Set([...Object.keys(expected.parts), ...Object.keys(actual.parts)]);
  const out = [];
  for (const name of names) {
    const e = expected.parts[name], a = actual.parts[name];
    const off = (k, scale = 1) => Math.abs(e[k] - a[k]) > tolerance * scale * Math.max(e.abs, a.abs, 1);
    if (!e || !a || e.n !== a.n || off('sum') || off('abs') || off('at', 2) || Math.abs(e.sq - a.sq) > tolerance * Math.max(e.sq, a.sq, 1)) {
      out.push({ name, expected: e ?? null, actual: a ?? null });
    }
  }
  return out;
}

async function main(args) {
  const { loadWorld } = await import('./load.js');
  const t0 = Date.now();
  const W = await loadWorld();
  const result = fingerprint(W);
  console.log(`world fingerprint of ${W.source}, seed ${result.seed} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (args.includes('--write')) {
    if (process.env.QS || process.env.WSRC) throw new Error('record only the world of src/ with its default seed (no QS or WSRC)');
    writeFileSync(RECORDED, `${JSON.stringify(result, null, 1)}\n`);
    console.log(`recorded in ${RECORDED}`);
    return 0;
  }
  const recorded = existsSync(RECORDED) ? JSON.parse(readFileSync(RECORDED, 'utf8')) : null;
  if (!recorded || recorded.seed !== result.seed) {
    for (const [k, v] of Object.entries(result.parts)) console.log(`  ${k.padEnd(14)} n ${String(v.n).padStart(7)}  sum ${v.sum}`);
    return 0;
  }
  const diff = differences(recorded, result);
  if (!diff.length) {
    console.log('the same world as recorded');
    return 0;
  }
  console.log('DIFFERENT from the recorded world:');
  for (const { name, expected: e, actual: a } of diff) console.log(`  ${name}: n ${e?.n ?? '-'} -> ${a?.n ?? '-'}, sum ${e?.sum ?? '-'} -> ${a?.sum ?? '-'}, by place ${e?.at ?? '-'} -> ${a?.at ?? '-'}`);
  return 1;
}

const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync.native(process.argv[1]) : null;
if (invokedPath === realpathSync.native(fileURLToPath(import.meta.url))) process.exitCode = await main(process.argv.slice(2));
