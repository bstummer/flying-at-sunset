// Temporal upsampling and the sky composite
//
// FS_TAAU reprojects the history with the clouds' depth, samples it Catmull-Rom and clamps it
// smoothly to the 3×3 neighbourhood (bilinear taps per output pixel: no low-resolution grid shows);
// Halton(2,3) jitter over 16 frames.


export const U_TAAU = {
  prevVP: 'mat4x4f',
  lowRes: 'vec2f', lowTex: 'vec2f', res: 'vec2f', jitter: 'vec2f', tanHalf: 'vec2f', cirrusOff: 'vec2f', layerOff: 'vec2f',
  camRight: 'vec3f', histValid: 'f32', camUp: 'vec3f', camFwd: 'vec3f', camDelta: 'vec3f', sunDir: 'vec3f', camPos: 'vec3f',
  sunDisk: 'vec3f', cirrusCol: 'vec3f',
  layerCol: 'vec3f[2]',      // sunlight at the height of each high layer
};
export { default as FS_TAAU } from './taau.wgsl';
