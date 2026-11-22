// Constants several modules share: the sun (low, toward −Z), the wind, the noise volumes' sizes and
// tiles and the detail volume's turn, the render origin's step, the clouds' ceiling and medium, the
// clipmap levels' grids, the atmosphere.
// The shaders get CLOUD_TOP, the medium, the tiles, the turn and the atmosphere from here too
// (render/gpu.js).

import { DEG, norm, rotation } from './math.js';

const SUN_ELEV = 5.0 * DEG;
const SUN_AZIM = 0.0;          // the sun sits toward -Z
export const SUN_DIR = norm([Math.sin(SUN_AZIM) * Math.cos(SUN_ELEV), Math.sin(SUN_ELEV), -Math.cos(SUN_AZIM) * Math.cos(SUN_ELEV)]);
export const WIND = [3.2, 0, 1.4];    // m/s: the high layers drift with it (render/frame.js); the clouds hold still
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
// The clouds' medium: the extinction inside (1/m; cumulus measure 0.05–0.12), and how it thins
// toward the surface, where dry air mixes in (Nubis³'s profile): a step at the surface to
// CLOUD_EDGE0 of it, rising to all of it CLOUD_EDGE_W m in (chunks/cloud.wgsl; tools/light/ judges
// the light in it)
export const SIGMA = 0.07, CLOUD_EDGE0 = 0.5, CLOUD_EDGE_W = 40;
// The clipmap levels' grids (render/stream.js; tools/world/levels.js bakes them on the CPU): cells
// (m) across and up, layers, the distance the bake clamps to, the smallest bubble each takes, and
// the lod its column data is filled at (world/columns.js)
export const CLIP_LEVELS = [
  { cell: 128, cellV: 128, nz: 112, maxD: 1200, minBR: 0, lod: 0 },
  { cell: 512, cellV: 256, nz: 56, maxD: 4000, minBR: 200, lod: 1 },
  { cell: 2048, cellV: 512, nz: 32, maxD: 12000, minBR: 900, lod: 2 },
];
// The sun map's grid (render/sunmap.js): texels SM_DA m across the sun's way, SM_DV m apart in
// height along its rays and SM_DW m along them; SM_NA, SM_NV, SM_NW of each (its height band from
// SM_H0 up, above the ceiling); the march past it in SM_PIECES pieces
export const SM_DA = 64, SM_DV = 32, SM_DW = 320, SM_NA = 256, SM_NV = 440, SM_NW = 64, SM_H0 = 300, SM_PIECES = 7;
// what the shaders get from here: render/gpu.js declares these in front of each
export const FOR_SHADERS = {
  CLOUD_TOP, SIGMA, CLOUD_EDGE0, CLOUD_EDGE_W, SHAPE_TILE, DETAIL_TILE, DETAIL_ROT, RG, RT, RAY_S, RAY_H, MIE_S, MIE_A, MIE_H, OZO_A,
  SM_DA, SM_DV, SM_DW, SM_NA, SM_NV, SM_NW, SM_PIECES,
};
