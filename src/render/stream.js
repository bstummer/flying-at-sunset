// Streamed world volumes: clipmaps around the camera

import { PI } from '../math.js';
import { ORIGIN_Q, SUN_DIR } from '../constants.js';
import { emptyVAO, gl, HALF, NOUT, RGBA16F, setUniforms, texture2D, texture3D, uloc } from './gl.js';
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
for (const L of [...LEVELS, TSVL]) {
  L.vol = texture3D(CLIP_N, CLIP_N, L.nz, gl.R16F, gl.RED, HALF, { wrapR: gl.CLAMP_TO_EDGE });
  if (!L.tsv) L.col = texture2D(CLIP_N, CLIP_N, RGBA16F, gl.RGBA, HALF, { filter: gl.LINEAR, wrap: gl.REPEAT });
  L.gi = null; L.gj = 0; L.valid = null; L.pending = 0;
}
T.tsv = TSVL.vol;
const BUB_MAX = 4096;
T.bub = texture2D(1024, (BUB_MAX >> 10) * 3, gl.RGBA32F, gl.RGBA, gl.FLOAT, { filter: gl.NEAREST });
const bubData = new Float32Array(1024 * (BUB_MAX >> 10) * 3 * 4);
const fbBake = gl.createFramebuffer();
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
function bindBakeLayers(L, z) {
  for (let k = 0; k < NOUT; k++) gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, L.vol.tex, 0, z + k);
}
function runJob(job, O) {
  const L = job.L, tx = job.gi & CLIP_M, ty = job.gj & CLIP_M;
  if (job.fill) {
    // column data of the block
    const col = new Float32Array(job.ni * job.nj * 4);
    fillColumns(L.cell, L.lod, job.gi, job.gj, job.ni, job.nj, col);
    gl.bindTexture(gl.TEXTURE_2D, L.col.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, tx, ty, job.ni, job.nj, gl.RGBA, gl.FLOAT, col);
    worldStats.jobs++;
    L.pending--;
    return;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbBake);
  gl.drawBuffers(Array.from({ length: NOUT }, (_, k) => gl.COLOR_ATTACHMENT0 + k));
  gl.viewport(tx, ty, job.ni, job.nj);
  gl.bindVertexArray(emptyVAO);
  if (L.tsv) {
    for (let u = 0; u < 16; u++) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_3D, null); }
    gl.useProgram(P.tsv.p);
    setUniforms(P.tsv, Object.assign(worldUniforms(O), {
      uTex0: { iv2: [tx, ty] }, uP0: [(job.gi + 0.5) * L.cell - O[0], (job.gj + 0.5) * L.cell - O[2]], uCellT: L.cell, uCellTV: L.cellV, uSunDir: SUN_DIR,
    }));
    for (let z = 0; z < L.nz; z += NOUT) { bindBakeLayers(L, z); gl.uniform1i(uloc(P.tsv, 'uZ0'), z); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  } else {
    // the tower bubbles near it, relative to its corner (the coarsest level takes them from the
    // cells grown for it: far cheaper, and all it can show)
    const ox = job.gi * L.cell, oz = job.gj * L.cell;
    const nb = gatherBubbles(ox, oz, ox + job.ni * L.cell, oz + job.nj * L.cell, L.maxD + 300, L.minBR, ox, oz, bubData, BUB_MAX, L.lod >= 2);
    worldStats.bubbles += nb; worldStats.maxBub = Math.max(worldStats.maxBub, nb);
    if (nb) {
      gl.bindTexture(gl.TEXTURE_2D, T.bub.tex);
      const rows = ((nb + 1023) >> 10) * 3;
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, rows, gl.RGBA, gl.FLOAT, bubData.subarray(0, rows * 1024 * 4));
    }
    gl.useProgram(P.bake.p);
    setUniforms(P.bake, { uCol: L.col, uBub: T.bub, uNB: { i: nb }, uTex0: { iv2: [tx, ty] }, uCellH: L.cell, uCellV: L.cellV, uMaxD: L.maxD, uMask: { i: CLIP_M } });
    for (let z = 0; z < L.nz; z += NOUT) { bindBakeLayers(L, z); gl.uniform1i(uloc(P.bake, 'uZ0'), z); gl.drawArrays(gl.TRIANGLES, 0, 3); }
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
  for (let pass = 0; pass < 2; pass++) {
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
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
    uVol0: LEVELS[0].vol, uVol1: LEVELS[1].vol, uVol2: LEVELS[2].vol, uCol0: LEVELS[0].col, uCol1: LEVELS[1].col, uCol2: LEVELS[2].col,
    uLvA: { v4: _lvA }, uLvV: { v4: _lvV }, uTsvA: Array.from(ta), uTsvV: Array.from(tv),
    uWarpPh: [ph(0, 8.37e-4), ph(3.41e-4, 0), ph(1.49e-4, 2.53e-4), ph(9.29e-4, 0)], uWarpPh2: [ph(0, 3.97e-4), ph(1.93e-4, -2.91e-4)],
  };
}
export const originOf = p => [Math.round(p[0] / ORIGIN_Q) * ORIGIN_Q, 0, Math.round(p[2] / ORIGIN_Q) * ORIGIN_Q];
