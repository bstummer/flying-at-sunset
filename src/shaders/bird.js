// The paper bird: its shading and its shadow map


export const U_BIRD = {
  model: 'mat4x4f', viewProj: 'mat4x4f', shadowVP: 'mat4x4f',
  flex: 'vec4f',        // x: bend angle, y: tip twist, z: flutter
  sunDir: 'vec3f', shadowTexel: 'f32',
};
// (also the shadow map's vertex shader, with viewProj = shadowVP)
export { default as VS_BIRD } from './bird-vs.wgsl';

export { default as FS_BIRD } from './bird-fs.wgsl';
