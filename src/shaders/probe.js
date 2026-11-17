// The probe: the light and cloud at the bird and around the camera
//
// A compute shader writes the fields of bProbe (struct Probe, chunks/probe.wgsl), one workgroup
// each: the sun and sky light at the bird and the light of the mist around the camera, which the
// bird's shaders read; the extinction at the camera and the bird and the distances to the cloud and
// to the sea's billows, which render/probe.js reads back for the flight and the camera.

import { U_CLIP, U_CLOUD } from './cloud.js';

export const U_PROBE = {
  ...U_CLIP, ...U_CLOUD,
  camPos: 'vec3f',      // render space
  birdRel: 'vec3f',     // bird - camera
  ambSea: 'vec3f',
};
export const PROBE_FIELDS = 6;   // (the workgroups of a dispatch)
export { default as CS_PROBE } from './probe.wgsl';
