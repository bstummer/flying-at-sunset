// Constants several modules share: the sun (low, toward −Z), the wind, the noise volumes' sizes and
// tiles and the detail volume's turn, the render origin's step, the clouds' ceiling and medium, the
// sun colour table's heights, the high cloud's heights and tiles, the clipmap levels' grids, the
// sun map's grids, the atmosphere.
// The shaders get CLOUD_TOP, the medium, the tiles, the turn, the atmosphere, the sun colour
// table's and the high cloud's heights and the sun map's sizes from here too (FOR_SHADERS,
// render/gpu.js).

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
// The sun's colour by height (render/sun.js, the shaders' sunCol): SUN_COL_N heights SUN_COL_DH m apart
export const SUN_COL_N = 16, SUN_COL_DH = 750;
// The sky's high cloud (render/frame.js, shaders/taau.wgsl), sheets at fixed heights (m): the cirrus
// veil, tiling every CIRRUS_TILE, and the two thin layers, every LAYER_TILE
export const CIRRUS_H = 9800, CIRRUS_TILE = 32000, LAYER_H0 = 6300, LAYER_H1 = 7700, LAYER_TILE = 64000;
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
// The sun map's grids (render/sunmap.js), a fine level and a coarse one around it: texels `da` m
// across the sun's way, `dv` m apart in height along its rays and `dw` m along them; SM_NA, `nv`,
// SM_NW of each (the height band from SM_H0 up, above the ceiling); the first clipmap level its
// bake reads, `lv0` (the coarse level's texels need no L0, whose window, moving with the camera,
// made what it baked depend on where the camera was); how far (texels along, across) the camera
// may wander before its window moves, `steps` (~2 km; the coarse one's ~5 and 4 km); the columns
// across baked a frame while it moves, `slab` (the whole window in SM_NA / slab frames); the march
// past each in SM_PIECES pieces. A texel holds the light that gets through and its SM_ROOTth root,
// which the shadow of the clouds near by is read from (chunks/cloud.wgsl, sunMapAt)
export const SM_NA = 256, SM_NW = 64, SM_H0 = 300, SM_PIECES = 7, SM_ROOT = 3;
export const SM_GRIDS = [
  { da: 64, dv: 32, dw: 320, nv: 440, lv0: 0, steps: [6, 32], slab: 2 },
  { da: 256, dv: 128, dw: 1280, nv: 112, lv0: 1, steps: [4, 16], slab: 1 },
];
// what the shaders get from here: render/gpu.js declares these in front of each
export const FOR_SHADERS = {
  CLOUD_TOP, SIGMA, CLOUD_EDGE0, CLOUD_EDGE_W, SHAPE_TILE, DETAIL_TILE, DETAIL_ROT, RG, RT, RAY_S, RAY_H, MIE_S, MIE_A, MIE_H, OZO_A,
  SM_NA, SM_NW, SM_PIECES, SM_ROOT, SUN_COL_N, SUN_COL_DH, CIRRUS_H, CIRRUS_TILE, LAYER_H0, LAYER_H1, LAYER_TILE,
};
