// Post: bloom, sun rays, tone mapping
//
// - Bloom: 7 levels, a Karis-free normalised chain, clamped at 3000 (?bloom, ?bloomw, ?bclamp).
// - Sun rays: an occlusion mask from the history and the bird, two radial blurs at quarter
//   resolution, only while the sun is near the view (?rays).
// - Final: exposure 14 (×1.45 inside cloud), a hue-preserving filmic tone curve with contrast
//   (?con, ?tm), a golden-hour split tone, vignette and grain; ?view=1..5 shows what goes into it.


// NaN / infinity tests on the bits (a compiler may assume floats are never NaN)

export const U_DOWN = { birdBox: 'vec4f', srcTexel: 'vec2f', first: 'i32', clampHi: 'f32' };
export { default as FS_DOWN } from './bloom-down.wgsl';

export const U_UP = { srcTexel: 'vec2f', dstTexel: 'vec2f', weight: 'f32' };
export { default as FS_UP } from './bloom-up.wgsl';

export const U_RAYMASK = { birdBox: 'vec4f', camRight: 'vec3f', camUp: 'vec3f', camFwd: 'vec3f', sunDir: 'vec3f', tanHalf: 'vec2f', dstTexel: 'vec2f' };
export { default as FS_RAYMASK } from './rays-mask.wgsl';

export const U_RAYBLUR = { sunUv: 'vec2f', dstTexel: 'vec2f', stepScale: 'f32', decay: 'f32' };
export { default as FS_RAYBLUR } from './rays-blur.wgsl';

export const U_FINAL = {
  birdBox: 'vec4f', rayCol: 'vec3f', exposure: 'f32', res: 'vec2f', dbgScale: 'vec2f',
  bloomMix: 'f32', bloomScale: 'f32', time: 'f32', contrast: 'f32', view: 'i32', tm: 'i32',
};
export { default as FS_FINAL } from './final.wgsl';
