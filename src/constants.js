// Constants of the scene: the sun, the wind, noise texture sizes, the render origin, the ceiling

import { DEG, norm } from './math.js';

const SUN_ELEV = 5.0 * DEG;
const SUN_AZIM = 0.0;          // the sun sits toward -Z
export const SUN_DIR = norm([Math.sin(SUN_AZIM) * Math.cos(SUN_ELEV), Math.sin(SUN_ELEV), -Math.cos(SUN_AZIM) * Math.cos(SUN_ELEV)]);
export const WIND = [3.2, 0, 1.4];    // m/s, slow drift of the billows (the clouds gently evolve)
export const WIND_ANG = Math.atan2(WIND[2], WIND[0]);
export const SHAPE_N = 128, DETAIL_N = 64;
export const ORIGIN_Q = 81920;        // m: the render origin snaps to multiples of this (every noise tile divides it)
export const CLOUD_TOP = 14000;       // m: nothing rises above this
