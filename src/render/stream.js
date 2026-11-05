// Streamed world volumes: clipmaps around the camera

import { PI } from '../math.js';
import { ORIGIN_Q, SUN_DIR } from '../constants.js';
import { device, flush, pass, slices, texture, toHalf } from './gpu.js';
import { NOUT } from '../shaders/volumes.js';
import { worldGC } from '../world/cells.js';
import { fillColumns, gatherBubbles } from '../world/columns.js';
import { P, T } from './setup.js';

// Each level: a 3D distance volume of the large shapes and a 2D map of column data, 256 cells
// across, addressed toroidally: when the camera has moved a few cells, the window shifts and only
// the cells that entered it are generated and baked. Until a shift is baked the level is valid
// only where the old and new windows overlap (the shaders fall back to a coarser level).
// Render space = world minus an origin snapped to ORIGIN_Q (keeps float precision on endless flights).
const CLIP_N = 256, CLIP_M = CLIP_N - 1;
export const LEVELS = [
  { cell: 128, cellV: 128, nz: 112, maxD: 1200, minBR: 0, lod: 0, step: 16, chunk: 32 },
  { cell: 512, cellV: 256, nz: 56, maxD: 4000, minBR: 200, lod: 1, step: 8, chunk: 32 },
  { cell: 2048, cellV: 512, nz: 32, maxD: 12000, minBR: 900, lod: 2, step: 4, chunk: 16 },
];
export const TSVL = { cell: 768, cellV: 360, nz: 40, step: 8, chunk: 32, tsv: true };
const VOL_USE = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC;
const DATA_USE = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;
for (const L of [...LEVELS, TSVL]) {
  L.vol = texture(CLIP_N, CLIP_N, 'r16float', { depth: L.nz, dim: '3d', usage: VOL_USE });
  if (!L.tsv) L.col = texture(CLIP_N, CLIP_N, 'rgba16float', { usage: DATA_USE | GPUTextureUsage.COPY_SRC });
  L.gi = null; L.gj = 0; L.valid = null; L.pending = 0;
}
T.tsv = TSVL.vol;
const BUB_MAX = 4096;
T.bub = texture(1024, (BUB_MAX >> 10) * 3, 'rgba32float', { usage: DATA_USE });
const bubData = new Float32Array(1024 * (BUB_MAX >> 10) * 3 * 4);
let bubUsed = false;     // a bake that reads the bubbles is encoded but not yet submitted
export const bakeQueue = [];
export const worldStats = { jobs: 0, bubbles: 0, maxBub: 0, ms: 0 };

// the blocks of global cell rectangle [i0, i1) x [j0, j1) of level L (blocks never wrap around
// the texture: they are aligned to the block size, which divides the texture size)
function rectBlocks(L, i0, j0, i1, j1, out) {
  const c = L.chunk;
  for (let bj = Math.floor(j0 / c) * c; bj < j1; bj += c) for (let bi = Math.floor(i0 / c) * c; bi < i1; bi += c) {
    const a0 = Math.max(bi, i0), a1 = Math.min(bi + c, i1), b0 = Math.max(bj, j0), b1 = Math.min(bj + c, j1);
    if (a1 > a0 && b1 > b0) out.push({ L, gi: a0, gj: b0, ni: a1 - a0, nj: b1 - b0 });
  }
}
// queue a batch: first the column data of all its blocks (the bake reads the sea's slope from
// neighbouring columns), then the volume bakes
function queueBatch(L, blocks) {
  if (!L.tsv) for (const b of blocks) bakeQueue.push(Object.assign({ fill: true }, b));
  for (const b of blocks) bakeQueue.push(b);
  return blocks.length * (L.tsv ? 1 : 2);
}
// keep a level's window centred on the camera (within +-step cells), queueing what enters it
function shiftLevel(L, cx, cz) {
  if (L.pending) return;
  const h = CLIP_N / 2, ci = Math.floor(cx / L.cell), cj = Math.floor(cz / L.cell);
  if (L.gi !== null && Math.abs(ci - (L.gi + h)) <= L.step && Math.abs(cj - (L.gj + h)) <= L.step) return;
  const ti = Math.round((ci - h) / L.step) * L.step, tj = Math.round((cj - h) / L.step) * L.step;
  const blocks = [];
  if (L.gi === null || Math.abs(ti - L.gi) >= CLIP_N || Math.abs(tj - L.gj) >= CLIP_N) {
    L.valid = null;
    rectBlocks(L, ti, tj, ti + CLIP_N, tj + CLIP_N, blocks);
  } else {
    const oi = L.gi, oj = L.gj;
    // the columns that entered, then the rows that entered (within the columns kept)
    if (ti > oi) rectBlocks(L, oi + CLIP_N, tj, ti + CLIP_N, tj + CLIP_N, blocks);
    else if (ti < oi) rectBlocks(L, ti, tj, oi, tj + CLIP_N, blocks);
    const ki0 = Math.max(oi, ti), ki1 = Math.min(oi, ti) + CLIP_N;
    if (tj > oj) rectBlocks(L, ki0, oj + CLIP_N, ki1, tj + CLIP_N, blocks);
    else if (tj < oj) rectBlocks(L, ki0, tj, ki1, oj, blocks);
    if (L.valid) L.valid = [Math.max(L.valid[0], ti), Math.max(L.valid[1], tj), Math.min(L.valid[2], ti + CLIP_N), Math.min(L.valid[3], tj + CLIP_N)];
  }
  L.gi = ti; L.gj = tj;
  L.pending = queueBatch(L, blocks);
  if (!L.pending) L.valid = [ti, tj, ti + CLIP_N, tj + CLIP_N];
}
function runJob(job, O) {
  const L = job.L, tx = job.gi & CLIP_M, ty = job.gj & CLIP_M;
  if (job.fill) {
    // column data of the block
    const col = new Float32Array(job.ni * job.nj * 4);
    fillColumns(L.cell, L.lod, job.gi, job.gj, job.ni, job.nj, col);
    device.queue.writeTexture({ texture: L.col.tex, origin: [tx, ty] }, toHalf(col), { bytesPerRow: job.ni * 8 }, [job.ni, job.nj]);
    worldStats.jobs++;
    L.pending--;
    return;
  }
  const viewport = [tx, ty, job.ni, job.nj];
  if (L.tsv) {
    const vals = Object.assign(worldUniforms(O), {
      tex0: [tx, ty], p0: [(job.gi + 0.5) * L.cell - O[0], (job.gj + 0.5) * L.cell - O[2]], cellT: L.cell, cellTV: L.cellV, sunDir: SUN_DIR, z0: 0,
    });
    for (let z = 0; z < L.nz; z += NOUT) { vals.z0 = z; pass(P.tsv, slices(L.vol, z, NOUT), vals, { viewport }); }
  } else {
    // the tower bubbles near it, relative to its corner (the coarsest level takes them from the
    // cells grown for it: far cheaper, and all it can show)
    const ox = job.gi * L.cell, oz = job.gj * L.cell;
    const nb = gatherBubbles(ox, oz, ox + job.ni * L.cell, oz + job.nj * L.cell, L.maxD + 300, L.minBR, ox, oz, bubData, BUB_MAX, L.lod >= 2);
    worldStats.bubbles += nb; worldStats.maxBub = Math.max(worldStats.maxBub, nb);
    if (nb) {
      // (the queue writes at once: submit the bakes that read the previous bubbles first)
      if (bubUsed) { flush(); bubUsed = false; }
      const rows = ((nb + 1023) >> 10) * 3;
      device.queue.writeTexture({ texture: T.bub.tex }, bubData.subarray(0, rows * 1024 * 4), { bytesPerRow: 1024 * 16 }, [1024, rows]);
      bubUsed = true;
    }
    const vals = { tCol: L.col, tBub: T.bub, nb, tex0: [tx, ty], cellH: L.cell, cellV: L.cellV, maxD: L.maxD, mask: CLIP_M, z0: 0 };
    for (let z = 0; z < L.nz; z += NOUT) { vals.z0 = z; pass(P.bake, slices(L.vol, z, NOUT), vals, { viewport }); }
  }
  worldStats.jobs++;
  if (--L.pending === 0) L.valid = [L.gi, L.gj, L.gi + CLIP_N, L.gj + CLIP_N];
}
// per frame: shift the windows (coarse levels first; the shadow volume once they are settled) and
// work through the queue within a time budget (all of it on the first frame and in tests)
export function streamWorld(camPos, O, budgetMs, frame) {
  if (frame % 900 === 899) worldGC(camPos[0], camPos[2]);
  for (let l = LEVELS.length - 1; l >= 0; l--) shiftLevel(LEVELS[l], camPos[0], camPos[2]);
  const t0 = performance.now();
  for (let round = 0; round < 2; round++) {
    // the shadow volume reads the coarser levels: it shifts once they are settled
    if (!LEVELS[1].pending && !LEVELS[2].pending) shiftLevel(TSVL, camPos[0], camPos[2]);
    while (bakeQueue.length) {
      const job = bakeQueue[0];
      if (job.L.tsv && (LEVELS[1].pending || LEVELS[2].pending)) break;
      bakeQueue.shift();
      runJob(job, O);
      if (budgetMs >= 0 && performance.now() - t0 > budgetMs) break;
    }
    if (budgetMs >= 0) break;
  }
  worldStats.ms = performance.now() - t0;
}
// render-space uniforms of the world volumes
const _lvA = new Float32Array(12), _lvV = new Float32Array(12);
export function worldUniforms(O) {
  const map = (L, k, A, V) => {
    const ext = CLIP_N * L.cell, fx = O[0] / ext, fz = O[2] / ext;
    A[k * 4] = 1 / ext; A[k * 4 + 1] = fx - Math.floor(fx); A[k * 4 + 2] = fz - Math.floor(fz); A[k * 4 + 3] = 1 / (L.nz * L.cellV);
    const v = L.valid, m = 2;   // keep two cells clear of the window edge (interpolation)
    if (v) { V[k * 4] = (v[0] + m) * L.cell - O[0]; V[k * 4 + 1] = (v[1] + m) * L.cell - O[2]; V[k * 4 + 2] = (v[2] - m) * L.cell - O[0]; V[k * 4 + 3] = (v[3] - m) * L.cell - O[2]; }
    else { V[k * 4] = V[k * 4 + 1] = 1e9; V[k * 4 + 2] = V[k * 4 + 3] = -1e9; }
  };
  LEVELS.forEach((L, k) => map(L, k, _lvA, _lvV));
  const ta = new Float32Array(4), tv = new Float32Array(4);
  map(TSVL, 0, ta, tv);
  // phases of the billow warp's waves at the origin (computed in double precision)
  const ph = (kx, kz) => { const a = kx * O[0] + kz * O[2]; return a - 2 * PI * Math.floor(a / (2 * PI)); };
  return {
    tVol0: LEVELS[0].vol, tVol1: LEVELS[1].vol, tVol2: LEVELS[2].vol, tCol0: LEVELS[0].col, tCol1: LEVELS[1].col, tCol2: LEVELS[2].col,
    lvA: _lvA, lvV: _lvV, tsvA: ta, tsvV: tv,
    warpPh: [ph(0, 8.37e-4), ph(3.41e-4, 0), ph(1.49e-4, 2.53e-4), ph(9.29e-4, 0)], warpPh2: [ph(0, 3.97e-4), ph(1.93e-4, -2.91e-4)],
  };
}
export const originOf = p => [Math.round(p[0] / ORIGIN_Q) * ORIGIN_Q, 0, Math.round(p[2] / ORIGIN_Q) * ORIGIN_Q];
