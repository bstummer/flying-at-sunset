
// What the billows of the trace and the large shapes of the bake share (shaders/cloud.js): the slow
// warp of the billow pattern, an octave of spheres heaped on a surface, and the largest lobes,
// which the bake grows on the towers (shaders/volumes.js)

// a slow, seamless warp of the billow pattern: waves of unrelated lengths, it never repeats
fn warpLand(p: vec3f) -> vec3f {
  let q = p.xz;
  return p + vec3f(240.0 * sin(q.y * 8.37e-4 + u.warpPh.x + 1.3 * sin(q.x * 3.41e-4 + u.warpPh.y)) + 150.0 * sin(q.y * 2.53e-4 + q.x * 1.49e-4 + u.warpPh.z), 0.0,
                   240.0 * sin(q.x * 9.29e-4 + u.warpPh.w + 1.3 * sin(q.y * 3.97e-4 + u.warpPh2.x)) + 150.0 * sin(q.x * 1.93e-4 - q.y * 2.91e-4 + u.warpPh2.y));
}

fn octave(d: f32, n0: f32, shell: f32, k: f32) -> f32 {
  // spheres may only bulge out to "shell" beyond the current surface; the clip is wide and soft
  // so over-sized spheres become rounded swells instead of flat-topped plateaus
  let n = smax(n0, d - shell, max(k, shell * 1.6));
  // a tight union: crisp, defined creases between the billows (the clip above keeps every sphere
  // within the shell, so none floats detached)
  return smin(n, d, mix(max(k * 0.8, shell * 1.05), shell * 0.5 + 4.0, 0.7));
}

// The largest lobes, on towers: a few, each a good share of a tower, so its walls bulge and lean
// and its top domes (bent spheres on 2560 m cells, fixed to the world: they don't drift). w (0..1):
// how much they grow at p, where d is the distance to the large shapes so far.
const BIG_SHELL = 500.0;
fn bigLobes(d: f32, p: vec3f, w: f32) -> f32 {
  let sb = textureSampleLevel(tShape, sRep, warpLand(p) * (vec3f(0.5, 0.6, 0.5) / SHAPE_TILE) + vec3f(0.31, 0.17, 0.57), 0.0).x;
  return octave(d, (sb * 2.0 - 1.0) * (2560.0 / 1.2), BIG_SHELL * w, 500.0);
}
