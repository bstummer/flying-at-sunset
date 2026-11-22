// The sun map's grid (render/sunmap.js bakes the map): where its window lies, and the uniforms that
// place it for the bake (shaders/sunmap*.wgsl) and for the lookups (chunks/cloud.wgsl, sunMapAt).
// GPU-free: tests/sunmap.test.js holds the bake and the lookups to the same texels.
//
// A world-anchored lattice: texel (K, A, V) lies K SM_DW m along the sun's way (HS, horizontal),
// A SM_DA m across it (PERP), on the ray V SM_DV m up (heights along the sun's rays, which rise
// TAN_E a metre: the ray V passes height V SM_DV + K SM_DW TAN_E at texel K). The window holds
// [K0, K0 + SM_NW) × [A0, A0 + SM_NA) and at each K the rays of the height band from SM_H0 up;
// stored toroidally (the texture's x is K, y is A, z is V, each wrapped), so a window that moves
// keeps what it shares with the old one, and each slot of z at K is the one ray of the band there.
// It moves only after the camera wandered STEP_A or STEP_K texels off its place, and is baked anew
// then; until that bake ends it is valid only where both windows overlap.

import { SM_DA, SM_DV, SM_DW, SM_H0, SM_NA, SM_NV, SM_NW, SUN_DIR } from '../constants.js';

export const SLAB = 2;              // columns baked a frame (the whole window: SM_NA / SLAB frames)
const BEHIND = 26;                  // texels of the window on the camera's side away from the sun
const STEP_A = 32, STEP_K = 6;      // how far the camera may wander before the window moves
// the sun's way (horizontal), across it, and its slope
const HL = Math.hypot(SUN_DIR[0], SUN_DIR[2]);
export const HS = [SUN_DIR[0] / HL, SUN_DIR[2] / HL], PERP = [-HS[1], HS[0]], TAN_E = SUN_DIR[1] / HL;

const mod = (x, n) => ((x % n) + n) % n;
const frac = x => x - Math.floor(x);
// the lowest ray in the height band at texel K
const vLo = K => Math.floor((SM_H0 - K * SM_DW * TAN_E) / SM_DV);
// the most rays a slab's column has: the band's, as many more as it sinks along the window, and two
export const rays = () => SM_NV + Math.ceil((SM_NW - 1) * SM_DW * TAN_E / SM_DV) + 2;

// the window: texels [K0, K0 + SM_NW) along, [A0, A0 + SM_NA) across; valid: [k0, k1, a0, a1], or
// null; cursor: the next column to bake; steps: how far (texels along, across) the camera may wander
export const newWindow = () => ({ A0: null, K0: 0, cursor: 0, valid: null, cycles: 0, slab: SLAB, steps: [STEP_K, STEP_A] });
// keep the window, or move it to the camera (world position): whether it moved
export function place(W, camPos) {
  const a = (camPos[0] * PERP[0] + camPos[2] * PERP[1]) / SM_DA, w = (camPos[0] * HS[0] + camPos[2] * HS[1]) / SM_DW;
  if (W.A0 !== null && Math.abs(a - (W.A0 + SM_NA / 2)) <= STEP_A && Math.abs(w - (W.K0 + BEHIND)) <= STEP_K) return false;
  // (it starts at a whole slab across, so no slab wraps around the texture; at an even texel along
  // it, as the bake writes texels in pairs)
  const A0 = Math.round((a - SM_NA / 2) / SLAB) * SLAB, K0 = Math.round((w - BEHIND) / 2) * 2;
  const v = W.valid;
  W.valid = v && [Math.max(v[0], K0), Math.min(v[1], K0 + SM_NW), Math.max(v[2], A0), Math.min(v[3], A0 + SM_NA)];
  if (W.valid && (W.valid[1] - W.valid[0] < 8 || W.valid[3] - W.valid[2] < 8)) W.valid = null;
  W.A0 = A0; W.K0 = K0;
  return true;
}
// the uniforms of the slab at the cursor, render space around the origin O: U the bake's (its
// columns' render-space place, the first ray's height), S the scan's (where it writes)
export function slabUniforms(W, O) {
  const wO = O[0] * HS[0] + O[2] * HS[1], aO = O[0] * PERP[0] + O[2] * PERP[1];
  const vBase = vLo(W.K0 + SM_NW - 1), nRays = vLo(W.K0) + SM_NV - vBase;
  return {
    U: {
      a0: W.cursor, slab: SLAB, nRays, ys: mod(W.A0 + W.cursor, SM_NA),
      aR: W.A0 * SM_DA - aO, wR: W.K0 * SM_DW - wO, hB: vBase * SM_DV + W.K0 * SM_DW * TAN_E,
    },
    S: { slab: SLAB, nRays, vb: mod(vBase, SM_NV), k0m: mod(W.K0, SM_NW), c0: (SM_H0 - W.K0 * SM_DW * TAN_E) / SM_DV - vBase, r: SM_DW * TAN_E / SM_DV },
  };
}
// the lookups' uniforms: texel K along the sun's way at x (K + 0.5) / SM_NW of the texture, A across
// at y, ray V at z, all wrapped; and the valid window in render space, as far in from its edges as
// the lookups reach (a texel toward the sun, and a texel and a half across: chunks/cloud.wgsl)
export function lookupUniforms(W, O) {
  const wO = O[0] * HS[0] + O[2] * HS[1], aO = O[0] * PERP[0] + O[2] * PERP[1], v = W.valid;
  return {
    smA: [1 / (SM_DW * SM_NW), frac((wO / SM_DW + 0.5) / SM_NW), 1 / (SM_DA * SM_NA), frac((aO / SM_DA + 0.5) / SM_NA)],
    smB: [1 / (SM_DV * SM_NV), frac((-wO * TAN_E / SM_DV + 0.5) / SM_NV), TAN_E, 0],
    smV: v ? [(v[0] + 1) * SM_DW - wO, (v[1] - 3) * SM_DW - wO, (v[2] + 2) * SM_DA - aO, (v[3] - 2) * SM_DA - aO] : [1e9, -1e9, 1e9, -1e9],
  };
}
