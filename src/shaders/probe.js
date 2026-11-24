// The probe: the light and cloud at the bird and around the camera
//
// A compute shader writes the fields of bProbe (struct Probe, chunks/probe.wgsl), one workgroup
// each: the sun and sky light at the bird and the light of the mist around the camera, which the
// bird's shaders read; the extinction at the camera and the bird and the distances to the cloud and
// to the sea's billows, which render/probe.js reads back for the flight and the camera.

import { U_CLIP, U_CLOUD } from './cloud.js';
import { own as PROBE_STRUCT } from './chunks/probe.wgsl';

export const U_PROBE = {
  ...U_CLIP, ...U_CLOUD,
  camPos: 'vec3f',      // render space
  birdRel: 'vec3f',     // bird - camera
  ambSea: 'vec3f',
};
// the fields of struct Probe, read off its declaration (every one a vec4f): their offsets in floats
// by name (render/probe.js reads two back, main.js's __debug.probe all), and how many (the buffer's
// size, a dispatch's workgroups)
const FIELDS = /struct Probe \{([^}]*)\}/.exec(PROBE_STRUCT.replace(/\/\/[^\n]*/g, ''))[1].split(',').map(f => f.trim()).filter(Boolean);
if (!FIELDS.every(f => /^\w+: vec4f$/.test(f))) throw new Error('struct Probe: a field that is not a vec4f');
export const PROBE_AT = Object.fromEntries(FIELDS.map((f, k) => [f.split(':')[0], 4 * k]));
export const PROBE_FIELDS = FIELDS.length;
export { default as CS_PROBE } from './probe.wgsl';
