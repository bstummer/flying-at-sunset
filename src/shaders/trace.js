// The cloud raymarch (low resolution)
//
// Up to 360 steps to 250 km or CLOUD_TOP (14 km), on a curved planet, with no jitter but the dither
// between the clipmap levels: the same ray gives the same light, and the ray beside it nearly the
// same (a jittered march is grain the history averages at rest and can't where near clouds move
// past, at their edges most of all). Empty space is skipped by dm − shellOf − margin; near surfaces
// it sphere-traces (the strides' floor, close to a surface, two outline widths past twice the
// distance: a crest a stride hops over is grazed at most about an outline deep; no finer than a
// 270-row trace's, as the detail, which fades with the pixel's footprint); on entry the boundary
// is found by a few Illinois regula-falsi steps (else far clouds look dark and speckled); inside,
// the ray is taken in stretches between samples a fixed optical depth apart (σ = 0.07/m; finer in
// the rim, about a pixel wide on the billowy tops), a stretch's density exact between its ends
// (the frayed edge's ramp, chunks/cloud.wgsl's rampMean) and its light the lit samples' at its
// ends: each sample has a light march of its own until little gets through (about three a
// cloud's face), none takes another's; it ends at T < 0.02. The camera's own cloud (a ray that starts in cloud, until
// it is clear of cloud) is marched first, in a loop of its own: from the camera in fine steps the
// same for every pixel, each cut at a surface it crosses, frayed in its first 40 m (shreds and
// holes), on through the air near it (a ray skimming a top dips in and out: one cloud, lit toward
// the main loop's skin by how far clear the gap took it), greyed deep in and lit as the main loop
// lights a surface near it, with variations deep in; how much light gets through it goes out with
// the depth (the exposure adapts by it, shaders/exposure.wgsl; the high layers lie behind it), and
// the depth the history is reprojected by is that of what shows through it.
// Light (sunScatter, shaders/cloud.js, fitted to a Monte Carlo of the medium, tools/light/): all of
// it, the sky's too, taken as at a cloud's edge LIGHT_SKIN thick, whatever the outline's ramp (the
// same at any resolution of the trace); lightPath marches 6 growing
// steps toward the sun, the first with the view sample's detail (domes of metres shade
// themselves), then on through its cloud's large shapes; other clouds' shadows
// past its first ~90 m come from the sun map (render/sunmap.js: near ones as the march's own,
// those past ~1.4 km a plain multiplier); past the map's window and past the march's reach, the
// shadow volume's; multiple scattering by octaves
// (Wrenninge) with a two-lobe HG phase (silver linings, the glare off the tops toward the sun);
// diffusion (light soaking into the cloud where the path toward the sun leaves it, as squarely as
// it came in there: a lit side's creases fill, a tower's shade gets a few % of its lit side); the
// smallest billows' own faces toward the sun,
// over 5 m, near the camera; sky light by which way the surface faces (one SDF tap 22 m above and
// more far away, and the light march: blue zenith on tops, the sea below under bellies, warm where
// the lit map has it in the sun, golden or violet sky on the sides; shade takes the sky's blue,
// grey inside cloud), as strong as the sky view gives it, as open as the sky is over it (between
// the domes, and over the large shapes at 250 and 750 m: creases and valleys), more of it seen at a
// grazing angle, and where the heaps around close the sky, the light of their sunlit flanks (all
// fitted to the shade's reference, tools/light/); the cloud's own light with a colour film's
// saturation (CLOUD_SAT); haze by optical depth (scale height 6 km: the farthest clouds the
// haziest). ?dbg=1..7 sets DBG: normals, sun visibility, the shadow volume and the sun map (the
// light that gets through other clouds from a point), march cost, lighting (5
// octaves, 6 diffusion, 7 sky light alone).

import { U_CLIP, U_CLOUD } from './cloud.js';

export const U_TRACE = {
  ...U_CLIP, ...U_CLOUD,
  res: 'vec2f', jitter: 'vec2f', tanHalf: 'vec2f',
  camPos: 'vec3f', frame: 'f32', camRight: 'vec3f', hazeK: 'f32', camUp: 'vec3f', camFwd: 'vec3f', dbgMode: 'i32',
  ambSea: 'vec3f',
};
// (the debug views of ?dbg=N are compiled in only when asked for: setup.js sets DBG)
export { default as FS_TRACE } from './trace.wgsl';
