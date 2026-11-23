// The sun map's grids (render/sunmap.js bakes the map): where a level's window lies, and the uniforms
// that place it for the bake (shaders/sunmap*.wgsl) and for the lookups (chunks/cloud.wgsl,
// smUVW). GPU-free: tests/sunmap.test.js holds the bake and the lookups to the same texels.
//
// A level is a world-anchored lattice (its grid G, constants.js): texel (K, A, V) lies K G.dw m along
// the sun's way (HS, horizontal), A G.da m across it (PERP), on the ray V G.dv m up (heights along
// the sun's rays, which rise TAN_E a metre: the ray V passes height V G.dv + K G.dw TAN_E at texel K).
// The window holds [K0, K0 + SM_NW) × [A0, A0 + SM_NA) and at each K the rays of the height band from
// SM_H0 up; stored toroidally (the texture's x is K, y is A, z is V, each wrapped), so a window that
// moves keeps what it shares with the old one, and each slot of z at K is the one ray of the band
// there. It moves only after the camera wandered G.steps texels off its place, and is baked anew
// then; until that bake ends it is valid only where both windows overlap.

import { SM_GRIDS, SM_H0, SM_NA, SM_NW, SUN_DIR } from '../constants.js';

const BEHIND = 26;                  // texels of the window on the camera's side away from the sun
// the sun's way (horizontal), across it, and its slope
const HL = Math.hypot(SUN_DIR[0], SUN_DIR[2]);
export const HS = [SUN_DIR[0] / HL, SUN_DIR[2] / HL], PERP = [-HS[1], HS[0]], TAN_E = SUN_DIR[1] / HL;

const mod = (x, n) => ((x % n) + n) % n;
const frac = x => x - Math.floor(x);
// the lowest ray in the height band at texel K
const vLo = (G, K) => Math.floor((SM_H0 - K * G.dw * TAN_E) / G.dv);
// the most rays a slab's column of grid G has: the band's, as many more as it sinks along the
// window, and two
export const rays = G => G.nv + Math.ceil((SM_NW - 1) * G.dw * TAN_E / G.dv) + 2;

// the window of grid G: texels [K0, K0 + SM_NW) along, [A0, A0 + SM_NA) across; valid: [k0, k1, a0,
// a1], or null; cursor: the next column to bake; steps: how far (texels along, across) the camera
// may wander
export const newWindow = (G = SM_GRIDS[0]) => ({ G, A0: null, K0: 0, cursor: 0, valid: null, cycles: 0, slab: G.slab, steps: G.steps });
// keep the window, or move it to the camera (world position): whether it moved
export function place(W, camPos) {
  const a = (camPos[0] * PERP[0] + camPos[2] * PERP[1]) / W.G.da, w = (camPos[0] * HS[0] + camPos[2] * HS[1]) / W.G.dw;
  if (W.A0 !== null && Math.abs(a - (W.A0 + SM_NA / 2)) <= W.steps[1] && Math.abs(w - (W.K0 + BEHIND)) <= W.steps[0]) return false;
  // (it starts at a whole slab across, so no slab wraps around the texture; at an even texel along
  // it, as the bake writes texels in pairs)
  const A0 = Math.round((a - SM_NA / 2) / W.slab) * W.slab, K0 = Math.round((w - BEHIND) / 2) * 2;
  const v = W.valid;
  W.valid = v && [Math.max(v[0], K0), Math.min(v[1], K0 + SM_NW), Math.max(v[2], A0), Math.min(v[3], A0 + SM_NA)];
  if (W.valid && (W.valid[1] - W.valid[0] < 8 || W.valid[3] - W.valid[2] < 8)) W.valid = null;
  W.A0 = A0; W.K0 = K0;
  return true;
}
// the uniforms of the slab at the cursor, render space around the origin O: U the bake's (its
// grid, its columns' render-space place, the first ray's height), S the scan's (where it writes)
export function slabUniforms(W, O) {
  const G = W.G, wO = O[0] * HS[0] + O[2] * HS[1], aO = O[0] * PERP[0] + O[2] * PERP[1];
  const vBase = vLo(G, W.K0 + SM_NW - 1), nRays = vLo(G, W.K0) + G.nv - vBase;
  return {
    U: {
      grid: [G.da, G.dv, G.dw], lv0: G.lv0, a0: W.cursor, slab: W.slab, nRays, ys: mod(W.A0 + W.cursor, SM_NA),
      aR: W.A0 * G.da - aO, wR: W.K0 * G.dw - wO, hB: vBase * G.dv + W.K0 * G.dw * TAN_E,
    },
    S: { slab: W.slab, nRays, nv: G.nv, vb: mod(vBase, G.nv), k0m: mod(W.K0, SM_NW), c0: (SM_H0 - W.K0 * G.dw * TAN_E) / G.dv - vBase, r: G.dw * TAN_E / G.dv },
  };
}
// the lookups' uniforms: texel K along the sun's way at x (K + 0.5) / SM_NW of the texture, A across
// at y, ray V at z, all wrapped (and half a texel's z); and the valid window in render space, as far
// in from its edges as the lookups reach (a texel toward the sun, and a texel and a half across:
// chunks/cloud.wgsl)
export function lookupUniforms(W, O) {
  const G = W.G, wO = O[0] * HS[0] + O[2] * HS[1], aO = O[0] * PERP[0] + O[2] * PERP[1], v = W.valid;
  return {
    A: [1 / (G.dw * SM_NW), frac((wO / G.dw + 0.5) / SM_NW), 1 / (G.da * SM_NA), frac((aO / G.da + 0.5) / SM_NA)],
    B: [1 / (G.dv * G.nv), frac((-wO * TAN_E / G.dv + 0.5) / G.nv), TAN_E, 0.5 / G.nv],
    V: v ? [(v[0] + 1) * G.dw - wO, (v[1] - 3) * G.dw - wO, (v[2] + 2) * G.da - aO, (v[3] - 2) * G.da - aO] : [1e9, -1e9, 1e9, -1e9],
  };
}
