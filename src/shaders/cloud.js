// Clouds: what the trace, the shadow volume, the probe and the mist share (chunks/clip.wgsl,
// chunks/cloud.wgsl)
//
// - The large shapes (sea relief, heaps, towers) come from the clipmaps (render/stream.js): levelAt
//   picks a level by distance (dithered handovers at ~7–10 and ~40–55 km; a coarser one outside a
//   level's valid window), macroAt reads its distance volume, colAt its column data.
// - cloudSDF heaps billows on them: octaves of signed distances to random spheres (the shape volume:
//   four lattices, 1280 to 160 m, tiled over 5120 m, looked up through a slow warp that never repeats
//   and squashed vertically), each clipped to a shell above the surface so far and united with it
//   (octave: crisp creases). The two fine octaves only above the sea's troughs, fading with
//   distance; two finer ones within ~2 km. shellOf bounds how high billows rise (empty-space skipping).
// - densityEx: density from the signed distance with a soft rim, wispy erosion by the detail volume,
//   frayed far silhouettes, finer wisps near the camera.
// - lightTauN: the optical depth toward the sun (5 growing steps) and which way the surface faces
//   it. The trace's header describes the lighting.

// uniforms of the clipmap lookups (part of the uniforms of every shader that includes them)
export const U_CLIP = {
  lvA: 'vec4f[3]',      // per level: 1 / extent, toroidal offset x, z, 1 / height
  lvV: 'vec4f[3]',      // per level: valid window (min x, min z, max x, max z)
};

export const U_CLOUD = {
  tsvA: 'vec4f',        // shadow volume: the same as lvA
  tsvV: 'vec4f',
  warpPh: 'vec4f',      // phases of the billow warp at the render origin
  warpPh2: 'vec2f',
  shapeOff: 'vec3f',    // slow evolution of the sea billows (wrapped)
  detailOff: 'vec3f',
  sunDir: 'vec3f',
  sunCol: 'vec3f[16]',
};
