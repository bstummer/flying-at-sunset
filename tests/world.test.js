// The world generator (src/world/), run as the page runs it: the recorded fingerprint, independence
// from the order places are asked for, sound data for the GPU over seeds 1 to 20 (the coarsest
// level's heaps those of the level before it), and each seed's first tower ahead of the start (the
// spawn draw). A module graph holds one world (it reads ?seed as it loads), so each seed runs in a
// worker thread of its own: this file is also the worker (the end of the file).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { differences, fingerprint, RECORDED } from '../tools/world/fingerprint.js';
import { loadWorld, WORLD_DIR } from '../tools/world/load.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const CHUNK = [32, 32, 16];   // (render/stream.js's blocks)

// What a worker measures of its seed's world.
const JOBS = {
  // the column data the GPU gets, of a few blocks of every clipmap level: R the sea surface with
  // its heaps, G the billow strength, B the fine billows, A the sea level without heaps
  columns(W) {
    const lo = [Infinity, Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity, -Infinity];
    let notFinite = 0, sunk = 0;
    for (const [l, L] of W.CLIP_LEVELS.entries()) for (const [gi, gj] of [[-32, -32], [0, -64], [64, 32], [-128, 96]]) {
      const n = CHUNK[l], out = new Float32Array(n * n * 4);
      W.fillColumns(L.cell, L.lod, gi, gj, n, n, out);
      for (let p = 0; p < n * n; p++) {
        for (let c = 0; c < 4; c++) {
          const v = out[p * 4 + c];
          if (!Number.isFinite(v)) notFinite++;
          lo[c] = Math.min(lo[c], v);
          hi[c] = Math.max(hi[c], v);
        }
        if (out[p * 4] < out[p * 4 + 3] - 0.01) sunk++;
      }
    }
    return { lo, hi, notFinite, sunk };
  },
  // how high the heaps stand over the sea level, on average, in the coarsest level and the one before
  // it over the same four blocks of 32 km (the coarsest grows its own cells: tools/world/levels.js)
  heaps(W) {
    const mean = (l, gi, gj, n) => {
      const L = W.CLIP_LEVELS[l], out = new Float32Array(n * n * 4);
      W.fillColumns(L.cell, L.lod, gi, gj, n, n, out);
      let s = 0;
      for (let p = 0; p < n * n; p++) s += out[p * 4] - out[p * 4 + 3];
      return s / (n * n);
    };
    let coarse = 0, finer = 0;
    for (const [bi, bj] of [[-16, -16], [0, -16], [-16, 0], [16, -32]]) { coarse += mean(2, bi, bj, 16); finer += mean(1, 4 * bi, 4 * bj, 64); }
    return { coarse, finer };
  },
  // the towers within 120 km; the spawn draw's verdict, and the living towers over 8.5 km within
  // 18 km of the start, to the right of the sun (bearing 0 is toward it) and in front of the bird
  towers(W) {
    const all = W.towersNear(0, 0, 120000);
    const first = W.towersNear(0, 0, 18000).filter((t) => {
      const bearing = Math.atan2(t.x, -t.z);
      return t.top > 8500 && t.cell.lift > 0 && bearing > 0.3 && bearing < 1.6;
    });
    return {
      count: all.length,
      highest: Math.max(...all.map((t) => t.top)),
      cloudTop: W.CLOUD_TOP,
      drawn: W.SPAWN.ok === true,
      first: first.length,
    };
  },
  fingerprint: (W) => fingerprint(W),
  weather: (W) => W.weatherOf(),
  // the same, after asking for other places first: far before near, coarse before fine
  fingerprintAfterOthers(W) {
    W.towersNear(150000, -90000, 60000);
    const out = new Float32Array(16 * 16 * 4), bub = new Float32Array(4096 * 12);
    for (const [gi, gj] of [[40, -60], [-16, -16], [0, 0]]) {
      W.fillColumns(2048, 2, gi, gj, 16, 16, out);
      W.gatherBubbles(gi * 2048, gj * 2048, (gi + 16) * 2048, (gj + 16) * 2048, 12300, 900, gi * 2048, gj * 2048, bub, 4096, true);
    }
    W.seaSurfaceAt(-40000, 25000);
    W.towerDistAt(30000, 5000, -20000);
    return fingerprint(W);
  },
};

// Runs groups of jobs on seeds, each group of a seed in a worker of its own (one world: the jobs
// of a group see what the ones before them asked), a few at a time: [{ seed, job, result }].
async function measure(seeds, groups) {
  const tasks = seeds.flatMap((seed) => groups.map((jobs) => ({ seed, jobs })));
  const results = [];
  const next = async () => {
    for (let task; (task = tasks.shift()); ) {
      const out = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url), { workerData: task });
        worker.once('message', resolve);
        worker.once('error', reject);
      });
      for (const job of task.jobs) results.push({ seed: task.seed, job, result: out[job] });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(8, availableParallelism() - 1)) }, next));
  return results;
}

if (isMainThread) {
  test('the world of src/ is the one recorded (node tools/world/fingerprint.js --write after a deliberate change)', async () => {
    const W = await loadWorld({ query: '', dir: WORLD_DIR });
    const recorded = JSON.parse(readFileSync(RECORDED, 'utf8'));
    assert.equal(W.WORLD_SEED, recorded.seed);
    assert.deepEqual(differences(recorded, fingerprint(W)), []);
  });

  test('the world is a function of position and seed, not of the order it is asked for', async () => {
    const results = await measure([1, 7, 13], [['fingerprint'], ['fingerprintAfterOthers']]);
    for (const seed of [1, 7, 13]) {
      const [fresh, after] = ['fingerprint', 'fingerprintAfterOthers'].map((job) => results.find((r) => r.seed === seed && r.job === job).result);
      assert.deepEqual(after, fresh, `seed ${seed}`);
    }
  });

  test('every seed, 1 to 20, gives the GPU sound column data and towers the trace can reach', async () => {
    const results = await measure(SEEDS, [['columns', 'towers', 'heaps']]);
    // (the columns are float32, as the GPU gets them)
    const within = (lo, hi, min, max) => lo >= Math.fround(min) && hi <= Math.fround(max);
    for (const seed of SEEDS) {
      const c = results.find((r) => r.seed === seed && r.job === 'columns').result;
      assert.equal(c.notFinite, 0, `seed ${seed}: column values that are not finite`);
      assert.equal(c.sunk, 0, `seed ${seed}: heaps lower the sea instead of raising it`);
      assert.ok(within(c.lo[1], c.hi[1], 0.65, 1.45), `seed ${seed}: billow strength ${c.lo[1]} .. ${c.hi[1]}, outside 0.65 .. 1.45`);
      assert.ok(within(c.lo[2], c.hi[2], 0.4, 1.3), `seed ${seed}: fine billows ${c.lo[2]} .. ${c.hi[2]}, outside 0.4 .. 1.3`);
      const t = results.find((r) => r.seed === seed && r.job === 'towers').result;
      assert.ok(t.count > 0, `seed ${seed}: no towers within 120 km`);
      assert.ok(t.drawn && t.first > 0, `seed ${seed}: no first tower ahead of the start (the spawn draw ${t.drawn ? 'held' : 'failed'}; living towers over 8.5 km near: ${t.first})`);
      assert.ok(t.highest < t.cloudTop, `seed ${seed}: a tower tops out at ${t.highest} m, above where the trace stops (${t.cloudTop} m)`);
      // (a third, while the coarsest level took only the domes that grew from the sea)
      const h = results.find((r) => r.seed === seed && r.job === 'heaps').result, k = h.coarse / h.finer;
      assert.ok(k > 0.7 && k < 1.3, `seed ${seed}: the coarsest level's heaps ${k.toFixed(2)} × the finer level's`);
    }
  });

  test('?weather moves the weather as asked, in place of the spawn draw', async () => {
    const W = await loadWorld({ query: '', dir: WORLD_DIR });
    const [{ result }] = await measure([`${W.WORLD_SEED}&weather=1000,-2000,3000.5,-4000`], [['weather']]);
    assert.deepEqual(result, [1000, -2000, 3000.5, -4000]);
  });
} else {
  const W = await loadWorld({ query: `seed=${workerData.seed}`, dir: WORLD_DIR });
  parentPort.postMessage(Object.fromEntries(workerData.jobs.map((job) => [job, JOBS[job](W)])));
}
