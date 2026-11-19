#include "chunks/common.wgsl"
#include "chunks/clip.wgsl"

// The shadow volume's bake: from each texel, the optical depth toward the sun through the large
// shapes of L1 or L2, as half floats into bTsv (shaders/volumes.js). It counts from where the trace's
// own light march ends (LIGHT_REACH) on, in two parts: through the cloud the texel sits in, until the
// march first comes out of it (light diffuses on through one body of cloud), and through the clouds
// beyond (their shadow is a shadow: a tower 100 km toward the sun darkens the sea here).
fn march(xz: vec2f, y0: f32, jit: f32) -> vec2f {
  var tau = vec2f(0.0);
  var self_ = true;
  var s = LIGHT_REACH + 320.0 * (jit - 0.5);
  for (var i = 0; i < 320; i++) {
    let p = vec3f(xz.x, y0, xz.y) + u.sunDir * s;
    if (p.y > CLOUD_TOP || s > 150000.0) { break; }
    let l = select(2, 1, inLv(p.xz, 1));
    let d = macroAt(p, l);
    // far from every cloud: skip ahead
    let m = d - lvMargin(l) - 300.0;
    if (m > 0.0) { self_ = false; s += max(m, 320.0); continue; }
    let stp = select(320.0, 200.0, d < 400.0);
    // inside the large shapes, and the larger billows on them
    let occ = saturate((120.0 - d) / 380.0);
    if (occ < 0.05) { self_ = false; }
    if (self_) { tau.x += SIGMA * stp * occ; } else { tau.y += SIGMA * stp * occ; }
    if (tau.y > 14.0) { break; }
    s += stp;
  }
  return min(tau, vec2f(30.0, 14.0));   // (past 30 hardly any light diffuses through)
}
// a texel per invocation, one u32 of bTsv each (rows of u.row)
@compute @workgroup_size(8, 8, 1) fn cs(@builtin(global_invocation_id) g: vec3u) {
  if (i32(g.x) >= u.n.x || i32(g.y) >= u.n.y) { return; }
  let t = u.tex0 + vec2i(g.xy);
  let z = i32(g.z);
  // (the march's jitter turns over every 8 slices, as when they were baked 8 at a time)
  let tau = march(u.p0 + vec2f(g.xy) * u.cellT, (f32(z) + 0.5) * u.cellTV, fract(ign(vec2f(t) + 0.5) + f32(z % 8) * 0.618));
  bTsv[(g.z * u32(u.n.y) + g.y) * u32(u.row) + g.x] = pack2x16float(tau);
}
