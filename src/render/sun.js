// Sun colours by altitude: a CPU copy of the atmosphere's transmittance

import { clamp, mix3, scl } from '../math.js';
import { SUN_DIR } from '../constants.js';

const ATM = {
  RG: 6360, RT: 6460, rayS: [5.802e-3, 13.558e-3, 33.1e-3], rayH: 8.0,
  mieS: 3.996e-3 * 2.2, mieA: 4.4e-3 * 2.2, mieH: 1.2, ozo: [0.650e-3, 1.881e-3, 0.085e-3],
};
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
export const sunColTable = new Float32Array(16 * 3);
for (let i = 0; i < 16; i++) {
  const t = atmTransmittance(i * 0.75, SUN_DIR[1]);
  sunColTable.set(scl(t, SUN_E), i * 3);
}
export function sunColorAt(hm) {
  const f = clamp(hm / 750, 0, 14.999), i = Math.floor(f), t = f - i;
  return mix3(Array.from(sunColTable.subarray(i * 3, i * 3 + 3)), Array.from(sunColTable.subarray(i * 3 + 3, i * 3 + 6)), t);
}
