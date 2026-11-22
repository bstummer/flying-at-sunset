// Baking the streamed world volumes (render/stream.js and render/sunmap.js run them): the shadow
// volume, the sun map and the distance volumes of the clipmaps

import { U_CLIP, U_CLOUD } from './cloud.js';

// Shadow volume (camera-centred, streamed like the clipmaps): optical depth toward the sun from
// each texel, marched through the large shapes of the coarser levels, through the cloud the texel
// sits in (r) and through the clouds beyond it (g). A compute shader, a texel per invocation (each
// march is long: the work spreads over the whole GPU); rg16float is no storage format in core
// WebGPU, so it writes each texel's pair of half floats as a u32 into bTsv, rows of TSV_ROW u32
// (256 bytes, as a copy into a texture wants them), which render/stream.js copies into the volume.
export const TSV_ROW = 64;
export const U_TSV = {
  ...U_CLIP, sunDir: 'vec3f',
  tex0: 'vec2i',        // first texel of this block
  n: 'vec2i',           // its texels across
  row: 'i32',          // TSV_ROW
  p0: 'vec2f',          // render-space xz of that texel's centre
  cellT: 'f32', cellTV: 'f32',
};
export { default as CS_TSV } from './tsv.wgsl';

// The sun map (render/sunmap.js), a slab of its columns across the sun's way at a time, in three
// passes, each spread over many invocations (one walk a ray, its texture reads one after another,
// kept the GPU waiting: two columns took as long as eight): the march past the window in pieces
// (sunmap-tail.wgsl), the stretch from each texel to the next (sunmap.wgsl), then a scan along each
// ray adding them up (sunmap-scan.wgsl), writing pairs of half floats into bSunMap (rows of SM_ROW
// u32: 256 bytes, as a copy into a texture wants them), which render/sunmap.js copies into the map.
export const SM_ROW = 64;
export const U_SUNMAP = {
  ...U_CLIP, ...U_CLOUD,
  a0: 'i32',            // the slab's first column, from the window's first
  slab: 'i32',          // its columns
  nRays: 'i32',         // the rays through it that cross the map's height band
  ys: 'i32',            // the texture row of its first column
  aR: 'f32',            // render space: across the sun's way, of the window's first column
  wR: 'f32',            //   along it, of its first texel
  hB: 'f32',            // the height of the first ray at the window's first texel
};
export const U_SUNSCAN = {
  slab: 'i32', nRays: 'i32',
  row: 'i32',           // SM_ROW
  vb: 'i32',            // the height slot of the slab's first ray
  k0m: 'i32',           // the texture column of the window's first texel along the sun's way
  c0: 'f32',            // where the height band starts at that texel (in rays from the first)
  r: 'f32',             // how far it sinks a texel along (rays)
};
// The lit map (render/sunmap.js): drawn over the sun map's window once its bake is done, a texel
// per column, how much sunlight reaches the sea of clouds there (litmap.wgsl); its mip levels the
// share over wider stretches (chunks/sealit.wgsl reads them)
export const U_LITMAP = {
  ...U_CLIP, ...U_CLOUD,
  litR: 'vec4f',        // render space: along the sun's way and across it, the map's first edge; a texel's size each way
};
export { default as FS_LITMAP } from './litmap.wgsl';
export { default as CS_SUNTAIL } from './sunmap-tail.wgsl';
export { default as CS_SUNMAP } from './sunmap.wgsl';
export { default as CS_SUNSCAN } from './sunmap-scan.wgsl';

// The distance volumes of the clipmaps and their billow scales are baked NOUT slices of each at a
// time, as the colour attachments of one pass (WebGPU guarantees 8): each bubble is looked at once
// for all of them (as compute, one slice an invocation, it was no faster: render/stream.js).
export const NOUT = 4;
// Bakes NOUT slices of a block of one clipmap level: the sea (from the column map: its surface
// and slope) united with the tower bubbles near the block (ellipsoids; crisp creases between
// them, a broad fillet where they swell out of the sea), and the largest lobes on the towers
// (chunks/lobes.wgsl, from the shape volume); and the billows' scale and liveliness, each bubble's
// own (world/cells.js) blended by how near its surface is, the sea's where the sea is nearer. Positions are relative to the block, whose corner
// is at p0 in render space (the lobes and their warp are the trace's, in render space). Its
// bubbles: nb of bBub (3 vec4f each, world/columns.js), from the b0th on.
export const U_BAKE = {
  nb: 'i32', b0: 'i32', z0: 'i32', mask: 'i32', tex0: 'vec2i', cellH: 'f32', cellV: 'f32', maxD: 'f32',
  p0: 'vec2f', warpPh: 'vec4f', warpPh2: 'vec2f',
};
export { default as FS_BAKE } from './bake.wgsl';
