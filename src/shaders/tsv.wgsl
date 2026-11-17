#include "chunks/common.wgsl"
#include "chunks/clip.wgsl"

// The shadow volume's bake: from each texel, the optical depth toward the sun through the large
// shapes of L1 or L2, as half floats packed in pairs into bTsv (shaders/volumes.js)
fn march(xz: vec2f, y0: f32, jit: f32) -> f32 {
  var trans = 1.0;
  var s = 200.0 + 320.0 * jit;
  var out_ = false;     // shading only starts once the ray has left the cloud it started in
  for (var i = 0; i < 320; i++) {
    let p = vec3f(xz.x, y0, xz.y) + u.sunDir * s;
    if (p.y > CLOUD_TOP || s > 150000.0) { break; }
    let l = select(2, 1, inLv(p.xz, 1));
    let d = macroAt(p, l);
    // far from every cloud: skip ahead
    let m = d - lvMargin(l) - 300.0;
    if (m > 0.0) { out_ = true; s += max(m, 320.0); continue; }
    let stp = select(320.0, 200.0, d < 400.0);
    // inside the large shapes, and the larger billows on them
    var occ = saturate((120.0 - d) / 380.0);
    if (!out_) { if (occ < 0.05) { out_ = true; } occ = 0.0; }
    // distant occluders cast fainter shadows (sky light and haze fill them in)
    trans *= mix(1.0, exp(-SIGMA * stp * occ), exp(-s / 28000.0));
    s += stp;
  }
  return min(-log(max(trans, 1e-6)), 14.0);
}
// a texel per invocation; each pair of them in a row is packed into one u32 of bTsv (rows of u.row)
var<workgroup> v: array<f32, 64>;
@compute @workgroup_size(8, 8, 1) fn cs(@builtin(global_invocation_id) g: vec3u, @builtin(local_invocation_index) li: u32) {
  let inside = i32(g.x) < u.n.x && i32(g.y) < u.n.y;
  let t = u.tex0 + vec2i(g.xy);
  let z = i32(g.z);
  // (the march's jitter turns over every 8 slices, as when they were baked 8 at a time)
  if (inside) { v[li] = march(u.p0 + vec2f(g.xy) * u.cellT, (f32(z) + 0.5) * u.cellTV, fract(ign(vec2f(t) + 0.5) + f32(z % 8) * 0.618)); }
  workgroupBarrier();
  if (inside && (g.x & 1u) == 0u) {
    bTsv[(g.z * u32(u.n.y) + g.y) * u32(u.row) + g.x / 2u] = pack2x16float(vec2f(v[li], v[li + 1u]));
  }
}
