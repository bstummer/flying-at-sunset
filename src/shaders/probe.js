// The probe: lighting at the bird and mist at the camera

import { U_CLIP, U_CLOUD } from './cloud.js';

export const U_PROBE = {
  ...U_CLIP, ...U_CLOUD,
  camPos: 'vec3f',      // render space
  birdRel: 'vec3f',     // bird - camera
  ambSea: 'vec3f',
};
export { default as FS_PROBE } from './probe.wgsl';
