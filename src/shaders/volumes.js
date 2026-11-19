// Baking the streamed world volumes (render/stream.js runs them): the shadow volume and the distance
// volumes of the clipmaps

import { U_CLIP } from './cloud.js';

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

// The distance volumes of the clipmaps are baked NOUT slices at a time, as the colour attachments
// of one pass (WebGPU guarantees 8): each bubble is looked at once for all of them (as compute,
// one slice an invocation, it was no faster: render/stream.js).
export const NOUT = 8;
// Bakes NOUT slices of a block of one clipmap level: the sea (from the column map: its surface
// and slope) united with the tower bubbles near the block (ellipsoids; crisp creases between
// them, a broad fillet where they swell out of the sea). Positions are relative to the block. Its
// bubbles: nb of bBub (3 vec4f each, world/columns.js), from the b0th on.
export const U_BAKE = { nb: 'i32', b0: 'i32', z0: 'i32', mask: 'i32', tex0: 'vec2i', cellH: 'f32', cellV: 'f32', maxD: 'f32' };
export { default as FS_BAKE } from './bake.wgsl';
