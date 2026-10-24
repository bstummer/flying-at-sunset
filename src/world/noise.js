// The world's randomness: a seed, a hash of position, value noise (nothing repeats)

import { Q } from '../params.js';
import { mulberry32, PI } from '../math.js';

const WORLD_SEED = Q.has('seed') ? parseInt(Q.get('seed'), 10) | 0 : 7;
const SEEDH = Math.imul(WORLD_SEED ^ 0x5bd1e995, 0x9E3779B1) | 0;
export function hashU(i, j, s) {
  let h = (Math.imul(i, 0x9E3779B1) + Math.imul(j, 0x85EBCA77) + Math.imul(s, 0xC2B2AE3D) + SEEDH) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D);
  h = Math.imul(h ^ (h >>> 12), 0x297A2D39);
  return (h ^ (h >>> 15)) >>> 0;
}
export const cellRng = (i, j, s) => mulberry32(hashU(i, j, s));
const INV32 = 1 / 4294967296;
function vnoise(x, z, s) {     // value noise on an endless hashed lattice, 0..1
  const xi = Math.floor(x), zi = Math.floor(z);
  let fx = x - xi, fz = z - zi;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hashU(xi, zi, s), b = hashU(xi + 1, zi, s), c = hashU(xi, zi + 1, s), d = hashU(xi + 1, zi + 1, s);
  return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * INV32;
}
export function fbm(x, z, oct, s, gain = 0.5) {
  let sum = 0, amp = 1, w = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * vnoise(x, z, s + o); w += amp; amp *= gain;
    const nx = 1.62 * x - 1.18 * z + 31.7;   // ~2x finer, turned 36 degrees: no lattice shows
    z = 1.18 * x + 1.62 * z - 17.3; x = nx;
  }
  return sum / w;
}
export const gauss = rng => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * PI * rng());
export function poisson(rng, lam) {
  if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(rng)));
  let n = 0;
  for (let p = Math.exp(-lam), s = p, u = rng(); u > s && n < 200;) { n++; p *= lam / n; s += p; }
  return n;
}
export const F_WARP = 16, F_REST = 32, F_BAND = 40, F_SHEAR = 48, F_TURN = 52, F_SWELL = 64, F_HILL = 80, F_VAL = 96,
  F_MOUND = 112, F_ROUGH = 128, F_AMP = 144, F_FINE = 160, F_CEIL = 176, F_MOIST = 184, F_CAP = 192, F_DEEP = 200;
