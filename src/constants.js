// Constants several modules share: the sun (low, toward −Z), the wind, the noise volumes' sizes and
// tiles and the detail volume's turn, the render origin's step, the clouds' ceiling. The shaders get
// CLOUD_TOP, the tiles and the turn from here too (render/gpu.js).

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
export const CLOUD_TOP = 14000;       // m: nothing rises above this
