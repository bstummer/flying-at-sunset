// The world, generated on the CPU: endless and grown. (This folder never touches the page or
// WebGL: tools/world runs it in Node.)
// Nothing is placed by hand and nothing repeats: everything is drawn from a hash of where it is.
// The clouds grow from a few causes, as in nature. Slow fields of the air decide how restless it
// is, how much stronger the wind blows higher up, where the ceiling is and how moist the air is.
// Bubbles of warm air rise out of the sea of clouds, a few far stronger than the rest: they swell,
// shed smaller bubbles that crowd outward, lose strength as they mix with the air around them and
// settle into domes when it runs out; the ceiling stops even the strongest, which then spread out
// sideways. A convective cell keeps sending bubbles up for a while, each rising through what the
// earlier ones left. Whatever stopped rising drifts with the wind of its height, spreads, sags and
// evaporates. Most cells only heap up the sea; the strong ones grow towers out of it.
// air.js the air and the sea of clouds · thermals.js rising bubbles and what becomes of them ·
// cells.js convective cells · shapes.js domes and bubbles · queries.js what the flight and the
// test views ask · columns.js what the GPU gets

import { clamp, lerp, smoothstep } from '../math.js';
import { WIND_ANG } from '../constants.js';
import {
  F_AMP, F_BAND, F_CAP, F_CEIL, F_DEEP, F_FINE, F_HILL, F_MOIST, F_MOUND, F_REST, F_ROUGH, F_SHEAR,
  F_SWELL, F_TURN, F_VAL, F_WARP, fbm,
} from './noise.js';

// ---- the air
function warpOf(x, z, o) {
  o.wx = x + 9000 * (fbm(x * 2.4e-5, z * 2.4e-5, 2, F_WARP) - 0.5);
  o.wz = z + 9000 * (fbm(x * 2.4e-5 + 5.2, z * 2.4e-5 + 1.3, 2, F_WARP + 4) - 0.5);
  return o;
}
// how restless the air is: calm (0) .. ready to boil up into storms (1). Broad patches of unstable
// air, and long winding bands where air streams converge
export let REST_O = [0, 0];
// (drawn once, as the page loads: the spawn draw in cells.js)
export function setRestOffset(o) { REST_O = o; }
function restOf(wx, wz) {
  wx += REST_O[0]; wz += REST_O[1];
  const patch = fbm(wx * 2.4e-5, wz * 2.4e-5, 4, F_REST, 0.55);
  const band = 1 - Math.abs(2 * fbm(wx * 9e-6 + 3.1, wz * 9e-6 - 1.7, 3, F_BAND, 0.45) - 1);
  return smoothstep(0.4, 0.85, patch + 0.25 * Math.pow(band, 6));
}
const _aw = {};
export const restAt = (x, z) => { warpOf(x, z, _aw); return restOf(_aw.wx, _aw.wz); };
// The sea of clouds: the top of the moist layer under the inversion. It rolls in broad swells,
// hills and narrow deep valleys, and lies higher and rougher where the air is restless. lod 0..2
// drops the finest rolling mounds (coarse clipmap levels). hb: the sea level without heaps; amp:
// billow strength; fine: strength of the small cauliflower billows
export function columnFields(x, z, lod, o) {
  warpOf(x, z, o);
  const wx = o.wx, wz = o.wz;
  const rest = restOf(wx, wz);
  const swell = (fbm(x * 1.9e-5, z * 1.9e-5, 3, F_SWELL) - 0.5) * 3400;
  const hills = (fbm(wx * 8e-5, wz * 8e-5, 3, F_HILL) - 0.5) * 2200;
  const vr = 1 - Math.abs(2 * fbm(wx * 1.2e-4, wz * 1.2e-4, 2, F_VAL) - 1);
  const valley = -700 * vr * vr * vr * vr * vr * vr;
  const mo = lod >= 2 ? 1 : lod === 1 ? 2 : 3;
  const billow = Math.abs(2 * fbm(x * 1.25e-4, z * 1.25e-4, mo, F_MOUND, 0.55) - 1);
  const rough = fbm(wx * 5.5e-5, wz * 5.5e-5, 2, F_ROUGH);
  o.rest = rest;
  const hb = 1650 + swell + hills + valley + 250 * rest + (billow - 0.38) * (220 + 700 * rest * (0.4 + rough));
  o.hb = hb > 1000 ? hb : 700 + 300 * Math.exp((hb - 1000) / 300);   // deep valleys level out softly
  o.amp = clamp(0.92 + 0.3 * rest + 0.6 * (fbm(x * 4.7e-5, z * 4.7e-5, 2, F_AMP) - 0.5), 0.65, 1.4);
  o.fine = lerp(0.4, 1.3, smoothstep(0.34, 0.66, 0.7 * fbm(x * 1.56e-4, z * 1.56e-4, 3, F_FINE, 0.55) + 0.3 * fbm(x * 5.5e-5, z * 5.5e-5, 2, F_FINE + 4)));
  return o;
}
const _cf = {};
export const seaLevelAt = (x, z) => columnFields(x, z, 0, _cf).hb;
// The air above a place, as a bubble of cloud rising from the sea meets it: first the inversion
// that caps the sea (cap: m/s^2 against it, over dInv), then air it is warmer than (buoyancy up to
// bmax) up to the level el where that ends, and above all the ceiling, which nothing rises past.
// Dry air mixed into a bubble chills it (dry: m/s^2 lost when it is all mixed); moist air also
// lets cloud linger once it stops rising. The wind blows stronger the higher up (ux, uz: m/s
// gained per metre, relative to the sea).
export function airAt(x, z) {
  warpOf(x, z, _aw);
  const I = restOf(_aw.wx, _aw.wz), zs = seaLevelAt(x, z);
  const ceil = 11600 + 1800 * fbm(x * 5e-6, z * 5e-6, 2, F_CEIL);
  const shear = lerp(0.3, 2.4, fbm(x * 7e-6 - 2.3, z * 7e-6 + 0.7, 2, F_SHEAR)) * 1e-3;
  const turn = WIND_ANG + 2.0 * (fbm(x * 6e-6 + 4.4, z * 6e-6 - 2.1, 2, F_TURN) - 0.5);
  const capN = fbm(x * 3e-5 + 0.4, z * 3e-5 + 2.2, 2, F_CAP), moist = fbm(x * 1.4e-5 + 1.9, z * 1.4e-5 - 3.3, 2, F_MOIST);
  // (how high up the unstable air reaches varies on its own: in some restless air only halfway)
  const deep = lerp(0.65, 1, smoothstep(0.35, 0.65, fbm(x * 9e-6 - 1.1, z * 9e-6 + 3.7, 2, F_DEEP)));
  return {
    I, zs, ceil, moist,
    ux: Math.cos(turn) * shear, uz: Math.sin(turn) * shear, turn,
    dInv: 380, cap: 0.2 * Math.exp(-2.6 * I) * lerp(0.7, 1.3, capN), dry: lerp(0.09, 0.05, moist) * (1 - 0.4 * I),
    bmax: 0.015 + 0.12 * Math.pow(I, 1.3), el: zs + 600 + (ceil - 1500 - zs - 600) * Math.pow(I, 0.5) * deep,
  };
}
// buoyancy (m/s^2) of undiluted cloudy air risen from the sea to height y
export function buoyAt(A, y) {
  if (y > A.ceil) return -1.2;
  if (y < A.zs) return 0;                         // (inside the sea it just coasts)
  if (y < A.zs + A.dInv) return -A.cap;
  if (y > A.el) return -0.03 - 0.12 * (y - A.el) * 1e-3;
  const u = (y - A.zs - A.dInv) / (A.el - A.zs - A.dInv);
  return A.bmax * (0.3 + 2.8 * u * (1 - u));
}
