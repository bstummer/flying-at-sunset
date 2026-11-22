// The sun map's grid (src/render/sungrid.js): its bake (shaders/sunmap*.wgsl) writes each texel where
// its lookup (chunks/cloud.wgsl, sunMapAt) reads it, every texel of the window once; the window
// follows the camera and keeps only what it shares with the old one valid. The shaders' formulas
// are mirrored here, a line each.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SM_DA, SM_DV, SM_DW, SM_H0, SM_NA, SM_NV, SM_NW } from '../src/constants.js';
import { HS, newWindow, PERP, place, rays, slabUniforms, lookupUniforms, TAN_E } from '../src/render/sungrid.js';

const mod = (x, n) => ((x % n) + n) % n;
const frac = x => x - Math.floor(x);
// the bake: ray j of the slab's column i at texel k along it (chunks/sunmap.wgsl, rayAt), and where
// it writes that texel (sunmap-scan.wgsl)
function bakeAt(U, S, i, j, k) {
  const a = U.aR + (U.a0 + i) * SM_DA, w = U.wR + k * SM_DW;
  const p = [PERP[0] * a + HS[0] * w, U.hB + j * SM_DV + k * SM_DW * TAN_E, PERP[1] * a + HS[1] * w];
  return { p, x: mod(S.k0m + k, SM_NW), y: U.ys + i, z: mod(S.vb + j, SM_NV) };
}
// the lookup's texel coordinates at render-space p (texel n at n + 0.5 / its count, wrapped)
function lookAt(L, p) {
  const w = p[0] * HS[0] + p[2] * HS[1], a = p[0] * PERP[0] + p[2] * PERP[1];
  return [frac(w * L.smA[0] + L.smA[1]) * SM_NW - 0.5, frac(a * L.smA[2] + L.smA[3]) * SM_NA - 0.5, frac((p[1] - w * L.smB[2]) * L.smB[0] + L.smB[1]) * SM_NV - 0.5];
}
const near = (x, n, m) => Math.min(mod(x - n, m), mod(n - x, m)) < 1e-3;

test('the bake writes each texel where the lookup reads it', () => {
  for (const cam of [[0, 2000, 0], [-123456.7, 3000, 987654.3], [5.5e6, 9000, -3.3e6]]) {
    const W = newWindow();
    place(W, cam);
    // (a render origin near the camera, snapped as frame.js does)
    const O = [Math.round(cam[0] / 81920) * 81920, 0, Math.round(cam[2] / 81920) * 81920];
    W.valid = [W.K0, W.K0 + SM_NW, W.A0, W.A0 + SM_NA];
    const L = lookupUniforms(W, O);
    for (const cursor of [0, 2, SM_NA - 2]) {
      W.cursor = cursor;
      const { U, S } = slabUniforms(W, O);
      for (const [i, j, k] of [[0, 0, 0], [1, 17, 33], [0, U.nRays - 1, SM_NW - 1], [1, 250, 5]]) {
        const b = bakeAt(U, S, i, j, k), t = lookAt(L, b.p);
        assert.ok(near(t[0], b.x, SM_NW) && near(t[1], b.y, SM_NA) && near(t[2], b.z, SM_NV),
          `camera ${cam}, column ${cursor + i}, ray ${j}, texel ${k}: written at ${[b.x, b.y, b.z]}, read at ${t.map(v => v.toFixed(3))}`);
        // (and the height of the band is where the world's heights are)
        if (k === 0 && j === 0) assert.ok(b.p[1] <= SM_H0 + SM_DV);
      }
    }
  }
});

test('every texel of the window is written by one ray: the height band\'s, wrapped', () => {
  const W = newWindow();
  place(W, [31000, 2000, -77000]);
  const { U, S } = slabUniforms(W, [0, 0, 0]);
  for (let k = 0; k < SM_NW; k++) {
    const seen = new Uint8Array(SM_NV);
    for (let j = 0; j < U.nRays; j++) {
      const lo = Math.floor(S.c0 - k * S.r);
      if (j >= lo && j < lo + SM_NV) seen[mod(S.vb + j, SM_NV)]++;
    }
    assert.ok(seen.every(n => n === 1), `texel ${k}: slots written ${[...new Set(seen)]} times`);
    // (the band spans the clouds' heights, from below the sea to above the ceiling)
    const lo = Math.floor(S.c0 - k * S.r), h = j => U.hB + j * SM_DV + k * SM_DW * TAN_E;
    assert.ok(h(lo) <= 520 && h(lo + SM_NV - 1) >= 14000 + 2 * SM_DV);
  }
  assert.ok(U.nRays <= rays());
});

test('the window follows the camera, and keeps valid only what it shares with the old one', () => {
  const W = newWindow();
  assert.equal(place(W, [0, 2000, 0]), true);
  W.valid = [W.K0, W.K0 + SM_NW, W.A0, W.A0 + SM_NA];
  const before = [W.A0, W.K0];
  assert.equal(place(W, [500, 2000, -500]), false);    // (a little way: it stays)
  assert.deepEqual([W.A0, W.K0], before);
  assert.equal(place(W, [5000, 2000, -9000]), true);   // (farther: it moves, its first column a whole slab)
  assert.notDeepEqual([W.A0, W.K0], before);
  assert.equal(mod(W.A0, W.slab), 0);
  assert.equal(mod(W.K0, 2), 0);
  const [k0, k1, a0, a1] = W.valid;
  assert.ok(k0 >= W.K0 && k1 <= W.K0 + SM_NW && a0 >= W.A0 && a1 <= W.A0 + SM_NA);
  assert.ok(k0 >= before[1] && a1 <= before[0] + SM_NA);
  place(W, [1e6, 2000, 1e6]);            // (a jump: nothing shared)
  assert.equal(W.valid, null);
});
