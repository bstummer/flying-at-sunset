// The sun map's grids (src/render/sungrid.js): each level's bake (shaders/sunmap*.wgsl) writes each
// texel where its lookup (chunks/cloud.wgsl, smUVW) reads it, every texel of the window once; the
// window follows the camera and keeps only what it shares with the old one valid. The shaders'
// formulas are mirrored here, a line each.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SM_GRIDS, SM_H0, SM_NA, SM_NW } from '../src/constants.js';
import { HS, newWindow, PERP, place, rays, slabUniforms, lookupUniforms, TAN_E } from '../src/render/sungrid.js';

const mod = (x, n) => ((x % n) + n) % n;
const frac = x => x - Math.floor(x);
// the bake: ray j of the slab's column i at texel k along it (chunks/sunmap.wgsl, rayAt), and where
// it writes that texel (sunmap-scan.wgsl)
function bakeAt(U, S, i, j, k) {
  const [da, dv, dw] = U.grid;
  const a = U.aR + (U.a0 + i) * da, w = U.wR + k * dw;
  const p = [PERP[0] * a + HS[0] * w, U.hB + j * dv + k * dw * TAN_E, PERP[1] * a + HS[1] * w];
  return { p, x: mod(S.k0m + k, SM_NW), y: U.ys + i, z: mod(S.vb + j, S.nv) };
}
// the lookup's texel coordinates at render-space p (texel n at n + 0.5 / its count, wrapped)
function lookAt(L, nv, p) {
  const w = p[0] * HS[0] + p[2] * HS[1], a = p[0] * PERP[0] + p[2] * PERP[1];
  return [frac(w * L.A[0] + L.A[1]) * SM_NW - 0.5, frac(a * L.A[2] + L.A[3]) * SM_NA - 0.5, frac((p[1] - w * L.B[2]) * L.B[0] + L.B[1]) * nv - 0.5];
}
const near = (x, n, m) => Math.min(mod(x - n, m), mod(n - x, m)) < 1e-3;

for (const [level, G] of SM_GRIDS.entries()) {
  test(`level ${level}: the bake writes each texel where the lookup reads it`, () => {
    for (const cam of [[0, 2000, 0], [-123456.7, 3000, 987654.3], [5.5e6, 9000, -3.3e6]]) {
      const W = newWindow(G);
      place(W, cam);
      // (a render origin near the camera, snapped as frame.js does)
      const O = [Math.round(cam[0] / 81920) * 81920, 0, Math.round(cam[2] / 81920) * 81920];
      W.valid = [W.K0, W.K0 + SM_NW, W.A0, W.A0 + SM_NA];
      const L = lookupUniforms(W, O);
      assert.equal(L.B[3], 0.5 / G.nv);
      for (const cursor of [0, 2, SM_NA - 2]) {
        W.cursor = cursor;
        const { U, S } = slabUniforms(W, O);
        for (const [i, j, k] of [[0, 0, 0], [1, 17, 33], [0, U.nRays - 1, SM_NW - 1], [1, Math.min(250, U.nRays - 1), 5]]) {
          const b = bakeAt(U, S, i, j, k), t = lookAt(L, G.nv, b.p);
          assert.ok(near(t[0], b.x, SM_NW) && near(t[1], b.y, SM_NA) && near(t[2], b.z, G.nv),
            `camera ${cam}, column ${cursor + i}, ray ${j}, texel ${k}: written at ${[b.x, b.y, b.z]}, read at ${t.map(v => v.toFixed(3))}`);
          // (and the height of the band is where the world's heights are)
          if (k === 0 && j === 0) assert.ok(b.p[1] <= SM_H0 + G.dv);
        }
      }
    }
  });

  test(`level ${level}: every texel of the window is written by one ray: the height band's, wrapped`, () => {
    const W = newWindow(G);
    place(W, [31000, 2000, -77000]);
    const { U, S } = slabUniforms(W, [0, 0, 0]);
    for (let k = 0; k < SM_NW; k++) {
      const seen = new Uint8Array(G.nv);
      for (let j = 0; j < U.nRays; j++) {
        const lo = Math.floor(S.c0 - k * S.r);
        if (j >= lo && j < lo + G.nv) seen[mod(S.vb + j, G.nv)]++;
      }
      assert.ok(seen.every(n => n === 1), `texel ${k}: slots written ${[...new Set(seen)]} times`);
      // (the band spans the clouds' heights, from below the sea to above the ceiling)
      const lo = Math.floor(S.c0 - k * S.r), h = j => U.hB + j * G.dv + k * G.dw * TAN_E;
      assert.ok(h(lo) <= 520 && h(lo + G.nv - 1) >= 14000 + 2 * G.dv);
    }
    assert.ok(U.nRays <= rays(G) && rays(G) <= rays(SM_GRIDS[0]));
  });

  test(`level ${level}: the window follows the camera, and keeps valid only what it shares with the old one`, () => {
    const W = newWindow(G), far = G.da / SM_GRIDS[0].da;
    assert.equal(place(W, [0, 2000, 0]), true);
    W.valid = [W.K0, W.K0 + SM_NW, W.A0, W.A0 + SM_NA];
    const before = [W.A0, W.K0];
    assert.equal(place(W, [500 * far, 2000, -500 * far]), false);    // (a little way: it stays)
    assert.deepEqual([W.A0, W.K0], before);
    assert.equal(place(W, [5000 * far, 2000, -9000 * far]), true);   // (farther: it moves, its first column a whole slab)
    assert.notDeepEqual([W.A0, W.K0], before);
    assert.equal(mod(W.A0, W.slab), 0);
    assert.equal(mod(W.K0, 2), 0);
    const [k0, k1, a0, a1] = W.valid;
    assert.ok(k0 >= W.K0 && k1 <= W.K0 + SM_NW && a0 >= W.A0 && a1 <= W.A0 + SM_NA);
    assert.ok(k0 >= before[1] && a1 <= before[0] + SM_NA);
    place(W, [1e7, 2000, 1e7]);            // (a jump: nothing shared)
    assert.equal(W.valid, null);
  });
}

test('the coarse level lies around the fine one, as large as it each way times the ratio of its texels', () => {
  const [F, C] = SM_GRIDS, r = C.da / F.da;
  assert.ok(r > 1 && C.dw / F.dw === r && C.dv / F.dv === r);
  const cam = [12345, 2000, -6789], WF = newWindow(F), WC = newWindow(C);
  place(WF, cam); place(WC, cam);
  // (the fine window inside the coarse one, along the sun's way and across it)
  assert.ok(WC.K0 * C.dw <= WF.K0 * F.dw && (WF.K0 + SM_NW) * F.dw <= (WC.K0 + SM_NW) * C.dw);
  assert.ok(WC.A0 * C.da <= WF.A0 * F.da && (WF.A0 + SM_NA) * F.da <= (WC.A0 + SM_NA) * C.da);
});
