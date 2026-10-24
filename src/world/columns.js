// The world for the GPU: column data and bubbles of the blocks of the clipmap levels

import { smoothstep } from '../math.js';
import { columnFields } from './air.js';
import { domeProfile, smaxJS } from './shapes.js';
import { forEachDome, forEachSys } from './cells.js';

// Column data of a block of one clipmap level (cells of size `cell`, global cell indices gi0.., gj0..):
// RGBA = sea surface with heaps, billow strength, fine billows, sea level without heaps.
const APRON = 4;
const _fc = {};
export function fillColumns(cell, lod, gi0, gj0, ni, nj, out) {
  // the sea surface is built with an apron around the block, so its slope limit agrees across
  // block borders
  const A = APRON, mi = ni + 2 * A, mj = nj + 2 * A, g0i = gi0 - A, g0j = gj0 - A;
  const hs = new Float32Array(mi * mj);
  for (let j = 0; j < mj; j++) for (let i = 0; i < mi; i++) {
    columnFields((g0i + i + 0.5) * cell, (g0j + j + 0.5) * cell, lod, _fc);
    hs[j * mi + i] = _fc.hb;
    const ci = i - A, cj = j - A;
    if (ci >= 0 && cj >= 0 && ci < ni && cj < nj) { const p = (cj * ni + ci) * 4; out[p + 1] = _fc.amp; out[p + 2] = _fc.fine; out[p + 3] = _fc.hb; }
  }
  const x0 = g0i * cell, z0 = g0j * cell, x1 = (g0i + mi) * cell, z1 = (g0j + mj) * cell;
  // heaps: on coarse cells small domes are widened and lowered (their volume stays)
  const minR = lod ? 0.25 * cell : 0, rootsOnly = lod >= 2;
  forEachDome(x0, z0, x1, z1, d => {
    if (d.r < minR) return;
    let r = d.r, h = d.h * (rootsOnly ? 1.25 : 1);   // (the roots stand in for whole heaps)
    const pf = (lod ? 0.9 : 0.6) * cell;
    if (r < 2.5 * pf) { const r2 = Math.sqrt(r * r + pf * pf); h *= (r * r) / (r2 * r2); r = r2; }
    const rr = r * d.ex, k = 0.12 * h + 25;
    const i0 = Math.max(0, Math.floor((d.x - rr - x0) / cell)), i1 = Math.min(mi - 1, Math.floor((d.x + rr - x0) / cell));
    const j0 = Math.max(0, Math.floor((d.z - rr - z0) / cell)), j1 = Math.min(mj - 1, Math.floor((d.z + rr - z0) / cell));
    const ir2 = 1 / (r * r), base = d.base + (d.h - h) * 0.5;
    for (let j = j0; j <= j1; j++) {
      const dz = (g0j + j + 0.5) * cell - d.z;
      for (let i = i0; i <= i1; i++) {
        const dx = (g0i + i + 0.5) * cell - d.x;
        const a = (dx * d.ca + dz * d.sa) / d.ex, b = -dx * d.sa + dz * d.ca;
        const u2 = (a * a + b * b) * ir2;
        if (u2 >= 1) continue;
        const p = j * mi + i;
        hs[p] = smaxJS(hs[p], base + h * domeProfile(d.prof, u2), k);
      }
    }
  }, rootsOnly);
  // no cliffs steeper than the volumes can hold: raise the low side (heaps get skirts, not walls)
  const st = 2.2 * cell, sd = st * 1.414;
  for (let it = 0; it < 2; it++) {
    for (let j = 1; j < mj - 1; j++) for (let i = 1; i < mi - 1; i++) {
      const p = j * mi + i;
      hs[p] = Math.max(hs[p], Math.max(hs[p - 1], hs[p - mi]) - st, Math.max(hs[p - mi - 1], hs[p - mi + 1]) - sd);
    }
    for (let j = mj - 2; j > 0; j--) for (let i = mi - 2; i > 0; i--) {
      const p = j * mi + i;
      hs[p] = Math.max(hs[p], Math.max(hs[p + 1], hs[p + mi]) - st, Math.max(hs[p + mi + 1], hs[p + mi - 1]) - sd);
    }
  }
  // where air rises vigorously (under and around the big bubbles) the billows boil up stronger
  const bx0 = gi0 * cell, bz0 = gj0 * cell, bx1 = (gi0 + ni) * cell, bz1 = (gj0 + nj) * cell;
  forEachSys(bx0, bz0, bx1, bz1, c => {
    for (const b of c.bub) {
      if (b.br < 500) continue;
      const R = 1.8 * b.rh;
      if (b.x + R < bx0 || b.x - R > bx1 || b.z + R < bz0 || b.z - R > bz1) continue;
      const i0 = Math.max(0, Math.floor((b.x - R - bx0) / cell)), i1 = Math.min(ni - 1, Math.floor((b.x + R - bx0) / cell));
      const j0 = Math.max(0, Math.floor((b.z - R - bz0) / cell)), j1 = Math.min(nj - 1, Math.floor((b.z + R - bz0) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const d = Math.hypot((gi0 + i + 0.5) * cell - b.x, (gj0 + j + 0.5) * cell - b.z);
        if (d < R) { const p = (j * ni + i) * 4 + 1; out[p] = Math.max(out[p], 1.45 * (1 - smoothstep(0.9 * b.rh, R, d))); }
      }
    }
  }, rootsOnly);
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) out[(j * ni + i) * 4] = Math.max(hs[(j + A) * mi + i + A], 650);
}
// all bubbles near a box, positions relative to (ox, oz), written in the layout of the bake
// shader's bubble texture (1024 wide; per 1024 bubbles three rows: centre & horizontal radius;
// radii up / down, stretch, angle; union smoothness, bounding radius). Bubbles smaller than minBR
// are left out (coarse levels; the coarsest sees small cells without what their bubbles shed).
export function gatherBubbles(x0, z0, x1, z1, pad, minBR, ox, oz, out, max, coarse = false) {
  let n = 0;
  forEachSys(x0 - pad, z0 - pad, x1 + pad, z1 + pad, c => {
    for (const b of c.bub) {
      if (n >= max || b.br < minBR) continue;
      const e = b.br + pad;
      if (b.x + e < x0 || b.x - e > x1 || b.z + e < z0 || b.z - e > z1) continue;
      const q = (((n >> 10) * 3) * 1024 + (n & 1023)) * 4, r = 4096;
      out[q] = b.x - ox; out[q + 1] = b.y; out[q + 2] = b.z - oz; out[q + 3] = b.rh;
      out[q + r] = b.ryU; out[q + r + 1] = b.ryD; out[q + r + 2] = b.an; out[q + r + 3] = b.ang;
      out[q + 2 * r] = b.k; out[q + 2 * r + 1] = b.br; out[q + 2 * r + 2] = 0; out[q + 2 * r + 3] = 0;
      n++;
    }
  }, coarse);
  return n;
}
