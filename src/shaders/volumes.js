// Baking the streamed world volumes: the shadow volume and the distance volumes of the clipmaps

import { U_CLIP } from './cloud.js';

// world volumes are baked several slices at a time: NOUT slices of a 3D texture as the colour
// attachments of one pass (WebGPU guarantees 8)
export const NOUT = 8;

// shadow volume (camera-centred, streamed like the clipmaps): optical depth toward the sun from
// each texel, marched through the large shapes of the coarser levels. Bakes NOUT slices at once.
export const U_TSV = {
  ...U_CLIP, sunDir: 'vec3f',
  tex0: 'vec2i',        // first texel of this block
  p0: 'vec2f',          // render-space xz of that texel's centre
  cellT: 'f32', cellTV: 'f32', z0: 'i32',
};
export { default as FS_TSV } from './tsv.wgsl';

// Bakes NOUT slices of a block of one clipmap level: the sea (from the column map: its surface
// and slope) united with the tower bubbles near the block (ellipsoids; crisp creases between
// them, a broad fillet where they swell out of the sea). Positions are relative to the block.
export const U_BAKE = { nb: 'i32', z0: 'i32', mask: 'i32', tex0: 'vec2i', cellH: 'f32', cellV: 'f32', maxD: 'f32' };
export { default as FS_BAKE } from './bake.wgsl';
