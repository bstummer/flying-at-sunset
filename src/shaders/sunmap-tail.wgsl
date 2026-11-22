#include "chunks/common.wgsl"
#include "chunks/sunmap.wgsl"

// The sun map's march past its window's sunward end (shaders/volumes.js), through L1 and L2 and the
// billows on them (at a low sun, the lobes and turrets on the sea 10–40 km off shade the tops of
// heaps: the large shapes alone left them lit), in pieces, an invocation each (one long march a
// ray kept the GPU waiting on its texture reads): the optical depth of all the clouds in it (x),
// and of those past the one the ray's end is in (y; past the first piece, all of them). Into
// bSmTail, SM_PIECES a ray.
@compute @workgroup_size(64, 1, 1) fn cs(@builtin(global_invocation_id) g: vec3u) {
  let j = i32(g.x);
  let i = i32(g.y);
  let c = i32(g.z);
  if (i >= u.slab || j >= u.nRays) { return; }
  let at = (i * u.nRays + j) * i32(SM_PIECES) + c;
  var piece = array<f32, 8>(0.0, 1500.0, 4000.0, 8000.0, 15000.0, 30000.0, 60000.0, 150000.0);
  let p0 = rayAt(i, j, SM_NW - 1.0);
  // (deep in the sea: nothing past it that matters, and a long way out)
  if (sdfAt(p0) < -600.0) { bSmTail[at] = select(vec2f(0.0), vec2f(30.0), c == 0); return; }
  var tau = vec2f(0.0);
  var self_ = c == 0;
  var s = piece[c] + 200.0 * ign(vec2f(f32(u.ys + i), f32(j)) + 0.5);
  for (var n = 0; n < 400; n++) {
    if (s >= piece[c + 1]) { break; }
    var p = p0 + u.sunDir * s;
    p.y += s * s * (1.0 - u.sunDir.y * u.sunDir.y) * INV2R;
    if (p.y > CLOUD_TOP) { break; }
    let l = select(2, 1, inLv(p.xz, 1));
    let dm = macroAt(p, l);
    let C = colAt(p.xz, l);
    let m = dm - shellOf(C.y) - lvMargin(l);
    if (m > 0.0) { self_ = false; s += max(m, 320.0); continue; }
    var d = dm;
    if (dm > -200.0) { d = cloudSDF(p, p.y, vec3f(dm, billowAt(p, l)), C, SM_LOD); }
    let occ = saturate(0.5 - d / SM_EDGE);
    if (occ < 0.05) { self_ = false; }
    tau.x += SIGMA * 200.0 * occ;
    if (!self_) { tau.y += SIGMA * 200.0 * occ; }
    if (tau.y > 14.0) { break; }
    s += 200.0;
  }
  bSmTail[at] = min(tau, vec2f(30.0, 14.0));
}
