// Clouds: what the trace, the shadow volume, the probe and the mist share
// The world lives in camera-centred clipmaps (render space: world minus a snapped origin):
// three 3D distance volumes of the large shapes (sea relief, heaps, towers), 128 m / 512 m / 2 km,
// each with a 2D map of per-column data, addressed toroidally so they stream as the bird flies.
// - levelAt: L0 below ~7–10 km (a dithered handover), L1 below ~40–55 km, else L2; a level only
//   inside its valid window. lvMargin: the interpolation error of each level (80, 260, 750 m).
// - Billows (cloudSDF): the large shapes dm from the volume, then octaves of an fbm of spheres: a
//   128³ rgba16float texture tiled over 5120 m holds signed distances to random spheres on lattices
//   of 4, 8, 16, 32 cells per tile (1280, 640, 320, 160 m; the two large channels packed close,
//   radius 0.4–0.78 cell, the small ones a little looser), looked up through a slow,
//   never-repeating warp and squashed 1.35× vertically. octave(d, n, shell, k) clips the spheres to
//   `shell` above the current surface (soft max) and unites them with it (a tight smooth min: crisp
//   creases). Shells 300·A, 160·A, 56·w3·fine, 26·w4·fine (A: the billow strength of the column
//   map); the two fine octaves only above the sea's troughs, fading with distance (w4 over
//   5–15 km, w3 over 12–30 km); within ~2.2 km two more (80 and 40 m cells, shells 20 and 10 m).
//   shellOf(a) = 400a + 120 bounds how far billows rise above dm (empty-space skipping).
// - Density (densityEx): from the signed distance with a soft rim, 14 m wide near the camera, 80 m
//   at 4 km; crisp (≤ max(30 m, 0.3% of the distance)) on the billowy tops of the sea and on
//   everything heaped on it, soft in the sea's deep troughs; wispy erosion by the detail texture
//   (64³ Worley/Perlin over 512 m); far silhouettes of heaps fray; extra fine wisps near the camera.
// - lightTauN: the light march toward the sun (chunks/cloud.wgsl; the trace's header describes the lighting).

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
