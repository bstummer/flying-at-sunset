// Post: bloom, sun rays, tone mapping
//
// - Bloom: 7 levels, a Karis-free normalised chain, clamped at 3000 (?bloom, ?bloomw, ?bclamp).
// - Sun rays: an occlusion mask from the scene's alpha (how much sky shows past the clouds and the
//   bird), two radial blurs at quarter resolution, only while the sun is near the view (?rays).
// - Exposure: 14 (?exp), lifted where the frame is dull and holds no bright light, in cloud and
//   out (shaders/exposure.wgsl: metered from a level of the bloom chain into bExpo, which the final
//   pass reads, with the frame's mean colour for the veil).
// - Veil: the lens's veiling glare, 0.05 of the frame's mean light over all of it (?veil): the shade
//   lifted and warmed toward lavender by the frame's own light, as in a photograph.
// - Final: the exposure, a filmic tone curve (hue kept in the mid-tones, highlights to cream) with
//   contrast (?con, ?tm), a golden-hour split tone, vignette and grain; ?view=1..5 shows what goes
//   into it.

export const U_DOWN = { srcTexel: 'vec2f', clampHi: 'f32' };
export { default as FS_DOWN } from './bloom-down.wgsl';

export const U_UP = { srcTexel: 'vec2f', dstTexel: 'vec2f', weight: 'f32' };
export { default as FS_UP } from './bloom-up.wgsl';

export const U_RAYMASK = { camRight: 'vec3f', camUp: 'vec3f', camFwd: 'vec3f', sunDir: 'vec3f', tanHalf: 'vec2f', dstTexel: 'vec2f' };
export { default as FS_RAYMASK } from './rays-mask.wgsl';

export const U_RAYBLUR = { sunUv: 'vec2f', dstTexel: 'vec2f', stepScale: 'f32', decay: 'f32' };
export { default as FS_RAYBLUR } from './rays-blur.wgsl';

export const U_EXPOSURE = { base: 'f32', dt: 'f32', snap: 'f32' };
export { default as CS_EXPOSURE } from './exposure.wgsl';

export const U_FINAL = {
  rayCol: 'vec3f', res: 'vec2f', dbgScale: 'vec2f',
  bloomMix: 'f32', bloomScale: 'f32', time: 'f32', contrast: 'f32', view: 'i32', tm: 'i32', veil: 'f32',
};
export { default as FS_FINAL } from './final.wgsl';
