// The paper bird's shaders: VS_BIRD flexes the wings (and draws the shadow map too), FS_BIRD shades
// the paper, lit by the probe, FS_BIRDOVER lays the resolved bird over the scene (render/bird.js)

export const U_BIRD = {
  model: 'mat4x4f', viewProj: 'mat4x4f', shadowVP: 'mat4x4f',
  flex: 'vec4f',        // x: bend angle, y: tip twist, z: flutter
  sunDir: 'vec3f', shadowTexel: 'f32',
};
// (also the shadow map's vertex shader, with viewProj = shadowVP)
export { default as VS_BIRD } from './bird-vs.wgsl';

export { default as FS_BIRD } from './bird-fs.wgsl';

// laid over the scene in its box (origin: the box's corner in the scene, in pixels)
export const U_BIRDOVER = { origin: 'vec2i' };
export { default as FS_BIRDOVER } from './bird-over.wgsl';
