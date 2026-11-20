// Constants several modules share: the sun (low, toward −Z), the wind, the noise volumes' sizes and
// tiles and the detail volume's turn, the render origin's step, the clouds' ceiling, the atmosphere.
// The shaders get CLOUD_TOP, the tiles, the turn and the atmosphere from here too (render/gpu.js).

import { DEG, norm, rotation } from './math.js';

const SUN_ELEV = 5.0 * DEG;
const SUN_AZIM = 0.0;          // the sun sits toward -Z
export const SUN_DIR = norm([Math.sin(SUN_AZIM) * Math.cos(SUN_ELEV), Math.sin(SUN_ELEV), -Math.cos(SUN_AZIM) * Math.cos(SUN_ELEV)]);
export const WIND = [3.2, 0, 1.4];    // m/s, slow drift of the billows (the clouds gently evolve)
export const WIND_ANG = Math.atan2(WIND[2], WIND[0]);
export const SHAPE_N = 128, DETAIL_N = 64;
export const SHAPE_TILE = 5120, DETAIL_TILE = 512;   // m: the noise volumes tile over these
// The detail volume is looked up turned in 3D (row-major: the tile's coordinates of a point), tilted
// 14°: a surface, level or upright, cuts its tile obliquely, so its domes don't repeat every 512 m.
// A copy of a level stretch's pattern lies ≥ 26 m above or below it within 1.5 km, ≥ 12 m within
// 3 km (tests/constants.test.js).
export const DETAIL_ROT = rotation(norm([0.5248, 0.8512, -0.0102]), 0.4684);
export const ORIGIN_Q = 81920;        // m: the render origin snaps to multiples of this (every noise tile divides it)
// The atmosphere (km, 1/km; Hillaire 2020's, the aerosols ×2.2: a hazier evening than his clear day):
// the planet's and the atmosphere's radii, Rayleigh scattering and its scale height, aerosol
// scattering and absorption (Bruneton's single-scattering albedo 0.9) and their scale height,
// ozone's absorption. The sky (chunks/atmo.wgsl) and the sun's colour (render/sun.js) share them.
export const RG = 6360, RT = 6460;
export const RAY_S = [5.802e-3, 13.558e-3, 33.1e-3], RAY_H = 8.0;
export const MIE_S = 3.996e-3 * 2.2, MIE_A = 0.444e-3 * 2.2, MIE_H = 1.2;
export const OZO_A = [0.650e-3, 1.881e-3, 0.085e-3];
export const CLOUD_TOP = 14000;       // m: nothing rises above this
// what the shaders get from here: render/gpu.js declares these in front of each
export const FOR_SHADERS = { CLOUD_TOP, SHAPE_TILE, DETAIL_TILE, DETAIL_ROT, RG, RT, RAY_S, RAY_H, MIE_S, MIE_A, MIE_H, OZO_A };
