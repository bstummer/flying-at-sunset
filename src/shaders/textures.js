// Static textures, generated once: noise volumes (cloud shapes, detail), cirrus, the two high layers


export const U_NOISE3D = { z: 'f32', size: 'f32', mode: 'i32', cells: 'vec4f' };
export { default as FS_NOISE3D } from './noise3d.wgsl';

export const U_SIZE = { size: 'f32' };
export { default as FS_CIRRUS } from './cirrus.wgsl';

// thin high layers: r, g = density of the two layers (a few long patches drawn out along the
// wind, streaky inside), b = fine streaks. Tiles over 64 km.
export { default as FS_LAYERS } from './layers.wgsl';

// the next mip level of the high layers (seen at grazing angles far away): each texel the mean of
// the four below it
export { default as FS_MIP } from './mip.wgsl';
