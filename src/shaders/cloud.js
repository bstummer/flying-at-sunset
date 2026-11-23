// Clouds: what the trace, the shadow volume, the sun map, the probe and the mist share
// (chunks/clip.wgsl, chunks/lobes.wgsl, chunks/cloud.wgsl)
//
// - The large shapes (sea relief, heaps, towers) come from the clipmaps (render/stream.js): levelAt
//   picks a level by distance (dithered handovers at ~7–10 and ~40–55 km; a coarser one outside a
//   level's valid window), macroAt reads its distance volume, billowAt its billow scale (how big
//   the billows of the nearest tower bubble are, the sea's elsewhere: read only where billows are
//   built, never by the empty-space skipping), colAt its column data. The bake
//   (shaders/volumes.js) grows the largest lobes on the towers into them (bigLobes: bent spheres on
//   2560 m cells, only well above the sea and near massive bubbles), so they cost the trace nothing
//   and the light march and the shadow volume see them.
// - cloudSDF heaps billows on them, from the shape volume (tiled over 5120 m, looked up through a
//   slow warp that never repeats and squashed vertically): lobes and turrets, signed distances to
//   random spheres on two lattices (1280 and 640 m, bent out of round in the bake, the turrets
//   sparse, of many sizes and mostly on the lobes' caps; both only on bubbles big enough to carry
//   them, and a smaller bubble boils in turrets of half the size), each clipped to a shell above the surface
//   so far and united with it (octave: crisp creases); then domes pushing the surface out
//   (domeField: sphere caps of random sizes, the highest wins; dome: less the farther out the
//   surface already is, so none floats) at 320 and 160 m, and from the detail volume (looked up
//   turned in 3D, detailAt: it doesn't repeat along a surface) at 128 to 32 m and, near the camera,
//   32 to 8 m, these rising a third to half as high as they are wide
//   (flatter, the near sea read as smooth dough), the finest only near the surface. Each finer octave grows more
//   on the tops of the one before (onCap, onDome: cauliflower, not popcorn; from a few km on the
//   finest cluster on the turrets' caps, built or not, so no surface is one carpet), less in the sea's
//   troughs. Every octave, the lobes and turrets too, fades as its cells shrink to a few pixels
//   (lod: the trace's pixel footprint, never finer than a 270-row trace's: a coarser trace keeps
//   less). shellOf bounds how high
//   billows rise (empty-space skipping).
// - densityFromSDF: density from the signed distance, ramping up over a few metres or about a pixel
//   (real cumulus ends within metres), its surface frayed a few metres deep by the detail volume;
//   variations of density inside cloud near the camera (mist streaming past as the bird flies), while
//   the camera is in cloud.
// - lightPath: the light's path toward the sun (6 growing steps from 10 m, each sampled at its
//   middle, the first three with the view sample's detail: domes of metres shade themselves; then
//   three long steps through the large shapes): the optical depth through the point's own cloud and
//   through clouds beyond it (past the first three steps, from the sun map: sunMapAt), whether the
//   light came in close by and how squarely, all smooth weights. sunScatter: the octaves and the
//   diffusion, fitted to a Monte Carlo of the medium (tools/light/). The trace's header describes
//   the lighting.

// uniforms of the clipmap lookups (part of the uniforms of every shader that includes them)
export const U_CLIP = {
  lvA: 'vec4f[3]',      // per level: 1 / extent, toroidal offset x, z, 1 / height
  lvV: 'vec4f[3]',      // per level: valid window (min x, min z, max x, max z)
};

export const U_CLOUD = {
  tsvA: 'vec4f',        // shadow volume: the same as lvA
  tsvV: 'vec4f',
  smA: 'vec4f',         // the sun map's fine level (render/sunmap.js): along the sun's way, the scale and offset of the
  smB: 'vec4f',         //   texture's x, across it of its y; its height's (z, wrapped) scale, offset, the sun's slope, half a texel's z
  smV: 'vec4f',         //   its valid window (along: min, max; across: min, max)
  smCA: 'vec4f',        // the same of its coarse level
  smCB: 'vec4f',
  smCV: 'vec4f',
  litA: 'vec4f',        // the lit map (render/sunmap.js): render space along the sun's way and across it of its first edge, 1 / its extent each way
  warpPh: 'vec4f',      // phases of the billow warp at the render origin
  warpPh2: 'vec2f',
  detailOff: 'vec3f',   // the detail volume's lookup: the render origin, turned and wrapped
  sunDir: 'vec3f',
  sunCol: 'vec3f[16]',
};
