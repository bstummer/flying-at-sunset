// The sun's colour by altitude: the atmosphere's transmittance toward the sun (the model of
// chunks/atmo.wgsl, marched on the CPU, along the path of an evening's light: SUN_LIGHT_MU,
// constants.js) at SUN_COL_N heights SUN_COL_DH m apart (sunColTable: the shaders' sunCol), and
// sunColorAt(h) between them

import { clamp, mix3, scl } from '../math.js';
import { MIE_A, MIE_H, MIE_S, OZO_A, RAY_H, RAY_S, RG, RT, SUN_COL_DH, SUN_COL_N, SUN_LIGHT_MU } from '../constants.js';

const ATM = { RG, RT, rayS: RAY_S, rayH: RAY_H, mieS: MIE_S, mieA: MIE_A, mieH: MIE_H, ozo: OZO_A };
function atmTransmittance(hKm, mu) {
  const r = ATM.RG + hKm;
  const disc = r * r * (mu * mu - 1) + ATM.RT * ATM.RT;
  const d = -r * mu + Math.sqrt(Math.max(disc, 0));
  const N = 300, ds = d / N;
  let oR = 0, oM = 0, oO = 0;
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) * ds, rr = Math.sqrt(r * r + s * s + 2 * r * mu * s), hh = rr - ATM.RG;
    if (hh < 0) return [0, 0, 0];
    oR += Math.exp(-hh / ATM.rayH) * ds; oM += Math.exp(-hh / ATM.mieH) * ds; oO += Math.max(0, 1 - Math.abs(hh - 25) / 15) * ds;
  }
  return [0, 1, 2].map(c => Math.exp(-(ATM.rayS[c] * oR + (ATM.mieS + ATM.mieA) * oM + ATM.ozo[c] * oO)));
}
const SUN_E = 1.0; // relative sun illuminance at the top of the atmosphere (exposure takes care of absolute scale)
export const sunColTable = new Float32Array(SUN_COL_N * 3);
for (let i = 0; i < SUN_COL_N; i++) {
  const t = atmTransmittance(i * SUN_COL_DH / 1000, SUN_LIGHT_MU);
  sunColTable.set(scl(t, SUN_E), i * 3);
}
export function sunColorAt(hm) {
  const f = clamp(hm / SUN_COL_DH, 0, SUN_COL_N - 1.001), i = Math.floor(f), t = f - i;
  return mix3(Array.from(sunColTable.subarray(i * 3, i * 3 + 3)), Array.from(sunColTable.subarray(i * 3 + 3, i * 3 + 6)), t);
}
