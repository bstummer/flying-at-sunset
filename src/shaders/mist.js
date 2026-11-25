// Drifting mist: soft puffs near the camera
// Each puff lives in a wrapped 180 m cell around the camera, samples the real cloud density at its
// position and is lit with the same model as the volume, so it only shows where cloud really is.
// 64 instanced puffs, drawn only while the camera is inside cloud, where the trace also frays the
// camera's own cloud into shreds and holes in its outer 40 m (trace.wgsl, fray): drifting mist,
// not a white wall.

import { U_CLIP, U_CLOUD } from './cloud.js';

export const U_MIST = {
  ...U_CLIP, ...U_CLOUD,
  viewProj: 'mat4x4f',
  camPos: 'vec3f', strength: 'f32', camOffset: 'vec3f', camRight: 'vec3f', camUp: 'vec3f',
};
export { default as VS_MIST } from './mist-vs.wgsl';
export { default as FS_MIST } from './mist-fs.wgsl';
