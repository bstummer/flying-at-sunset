
// What the billows of the trace and the large shapes of the bake share (shaders/cloud.js): the slow
// warp of the billow pattern, an octave of spheres heaped on a surface, and the largest lobes,
// which the bake grows on the towers (shaders/volumes.js)

// a slow, seamless warp of the billow pattern: waves of unrelated lengths, it never repeats
fn warpLand(p: vec3f) -> vec3f {
  let q = p.xz;
  return p + vec3f(240.0 * sin(q.y * 8.37e-4 + u.warpPh.x + 1.3 * sin(q.x * 3.41e-4 + u.warpPh.y)) + 150.0 * sin(q.y * 2.53e-4 + q.x * 1.49e-4 + u.warpPh.z), 0.0,
                   240.0 * sin(q.x * 9.29e-4 + u.warpPh.w + 1.3 * sin(q.y * 3.97e-4 + u.warpPh2.x)) + 150.0 * sin(q.x * 1.93e-4 - q.y * 2.91e-4 + u.warpPh2.y));
}

// An octave of spheres (n0: the distance to them) heaped on a surface at distance d
fn octave(d: f32, n0: f32, shell: f32, k: f32, cf: f32) -> f32 {
  // spheres may only bulge out to a ceiling "shell" × cf beyond the current surface; the clip is
  // wide and soft so over-sized spheres become rounded swells. A sphere it cuts takes the ceiling's
  // shape on top: under a flat one (cf 1) a smooth plateau with a hard rim, a flagstone up close;
  // under a billowed one (cloudSDF's, cf by a field of domes) domes of its own
  let n = smax(n0, d - shell * cf, max(k, shell * 1.6));
  // a tight union: crisp, defined creases between the billows (the clip above keeps every sphere
  // within the shell, so none floats detached)
  return smin(n, d, mix(max(k * 0.8, shell * 1.05), shell * 0.5 + 4.0, 0.7));
}

// how big the billows on the sea are (m): the bubbles of the towers carry their own (world/cells.js),
// the bake blends them (shaders/volumes.js) and cloudSDF grows the billows they allow
const SEA_BS = 2000.0;

// The largest lobes, on towers: a few, each a good share of a tower, so its walls bulge and lean
// and its top domes (bent spheres on 2560 m cells, fixed to the world: they don't drift). w (0..1):
// how much they grow at p, where d is the distance to the large shapes so far.
const BIG_SHELL = 500.0;
fn bigLobes(d: f32, p: vec3f, w: f32) -> f32 {
  let sb = textureSampleLevel(tShape, sRep, warpLand(p) * (vec3f(0.5, 0.6, 0.5) / SHAPE_TILE) + vec3f(0.31, 0.17, 0.57), 0.0).x;
  return octave(d, (sb * 2.0 - 1.0) * (2560.0 / 1.2), BIG_SHELL * w, 500.0, 1.0);
}
