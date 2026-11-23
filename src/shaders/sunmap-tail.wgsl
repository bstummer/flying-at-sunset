#include "chunks/common.wgsl"
#include "chunks/sunmap.wgsl"

// The sun map's march past its window's sunward end (shaders/volumes.js), through L1 and L2 and the
// billows on them (at a low sun, the lobes and turrets on the sea 10–40 km off shade the tops of
// heaps: the large shapes alone left them lit), in pieces, an invocation each (one long march a
// ray kept the GPU waiting on its texture reads): the optical depth of all the clouds in it (x),
// and of those past where the ray leaves the one its end is in (y). Into bSmTail, SM_PIECES a ray.
@compute @workgroup_size(64, 1, 1) fn cs(@builtin(global_invocation_id) g: vec3u) {
  let j = i32(g.x);
  let i = i32(g.y);
  let c = i32(g.z);
  if (i >= u.slab || j >= u.nRays) { return; }
  let at = (i * u.nRays + j) * i32(SM_PIECES) + c;
  var piece = array<f32, 8>(0.0, 1500.0, 4000.0, 8000.0, 15000.0, 30000.0, 60000.0, 150000.0);
  let p0 = rayAt(i, j, SM_NW - 1.0);
  // where the ray leaves the cloud its end is in, by its distance (steps that never cross the
  // surface). (Taken as deep in the sea where the end was over 600 m in, or as left past the first
  // piece: a window ending inside a tower shadowed the texels in it toward the camera with the rest
  // of that tower, which a window ending a few texels farther counted as their own.)
  var sx = 0.0;
  var dx = sdfAt(p0);
  for (var n = 0; n < 48; n++) {
    if (dx >= 0.0) { break; }
    sx += max(-dx, 80.0);
    var q = p0 + u.sunDir * sx;
    q.y += sx * sx * (1.0 - u.sunDir.y * u.sunDir.y) * INV2R;
    dx = sdfAt(q);
  }
  var tau = vec2f(0.0);
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
    if (m > 0.0) { s += max(m, 320.0); continue; }
    var d = dm;
    if (dm > -200.0) { d = cloudSDF(p, p.y, vec3f(dm, billowAt(p, l)), C, smLod()); }
    let occ = saturate(0.5 - d / SM_EDGE);
    tau.x += SIGMA * 200.0 * occ;
    if (s > sx) { tau.y += SIGMA * 200.0 * occ; }
    if (tau.y > 14.0) { break; }
    s += 200.0;
  }
  bSmTail[at] = min(tau, vec2f(30.0, 14.0));
}
