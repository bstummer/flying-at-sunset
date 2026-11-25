// Static textures, generated once (render/setup.js): the noise volumes (the billows: signed distances
// to random spheres on two bent lattices and fields of domes on two more; the detail: Worley and
// Perlin noise, and domes on domes), the cirrus and the two high layers (tileable value-noise fbm,
// chunks/vnoise.wgsl), the layers with mip levels

// the noise volumes, each written whole by one compute dispatch (cells: lattice cells per tile of
// each channel)
export const U_NOISE3D = { size: 'f32', cells: 'vec4f' };
export { default as CS_SHAPE } from './noise-shape.wgsl';
export { default as CS_DETAIL } from './noise-detail.wgsl';

export const U_SIZE = { size: 'f32' };
export { default as FS_CIRRUS } from './cirrus.wgsl';

// thin high layers: r, g = density of the two layers (a few long patches drawn out along the
// wind, streaky inside), b = fine streaks. Tiles over 64 km.
export { default as FS_LAYERS } from './layers.wgsl';

// the next mip level of the high layers (seen at grazing angles far away): each texel the mean of
// the four below it
export { default as FS_MIP } from './mip.wgsl';
