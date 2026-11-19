// The cloud raymarch (low resolution)
//
// Up to 360 steps to 250 km or CLOUD_TOP (14 km), on a curved planet. Empty space is skipped by
// dm − shellOf − margin; near surfaces it sphere-traces with jittered strides; on entry the boundary
// is found by a few Illinois regula-falsi steps (else far clouds look dark and speckled); inside,
// steps aim at a fixed optical depth (σ = 0.07/m) but stay fine in the rim (about a pixel wide on
// the billowy tops); it ends at T < 0.02.
// Light (sunScatter, shaders/cloud.js): lightTauN marches 5 growing steps toward the sun with the
// view sample's detail (bulges shade themselves), the shadow volume carries on from there (through
// the same cloud, and through the clouds beyond: their shadow a plain multiplier); multiple
// scattering by octaves (Wrenninge) with a two-lobe HG phase (silver linings); diffusion (light
// soaking deep into the cloud, strongest where the sun enters square to the surface); sky light by
// which way the surface faces (one SDF tap above and the light march: blue zenith on tops, the warm
// bounce of the sunlit sea under bellies, golden or violet sky on the sides), as strong as the sky
// view gives it; short-range occlusion; haze by optical depth. ?dbg=1..7 sets DBG: normals, sun
// visibility, shadow volume, march cost, lighting (5 octaves, 6 diffusion, 7 sky light alone).

import { U_CLIP, U_CLOUD } from './cloud.js';

export const U_TRACE = {
  ...U_CLIP, ...U_CLOUD,
  res: 'vec2f', jitter: 'vec2f', tanHalf: 'vec2f',
  camPos: 'vec3f', frame: 'f32', camRight: 'vec3f', hazeK: 'f32', camUp: 'vec3f', inCloud: 'f32', camFwd: 'vec3f', dbgMode: 'i32',
  ambSea: 'vec3f',
};
// (the debug views of ?dbg=N are compiled in only when asked for: setup.js sets DBG)
export { default as FS_TRACE } from './trace.wgsl';
