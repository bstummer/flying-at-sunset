#include "chunks/common.wgsl"
#include "chunks/sunmap.wgsl"

// The sun map's stretches (shaders/volumes.js): an invocation per texel of a slab's rays, for the
// stretch toward the sun from it to the next: its optical depth (x), in pieces of 320 m of the way
// (one in the fine level, four in the coarse one), each uniform where both its ends are far from
// the surface, else in four steps, each inside by its distance and slope, as the trace's light
// march (in the coarse level's 1280 m, four steps counted a fifth of one inside where it passed
// 30 m over a billow, shadowing the sea beyond); and from the stretch's sunward end, the optical
// depth to the last point in it clear of cloud, the texel included (y; -1: none). Into bSmSeg,
// SM_NW a ray; sunmap-scan.wgsl adds them up.
@compute @workgroup_size(64, 1, 1) fn cs(@builtin(global_invocation_id) g: vec3u) {
  let j = i32(g.x);
  let i = i32(g.y);
  let k = i32(g.z);
  if (i >= u.slab || j >= u.nRays) { return; }
  let dK = sdfAt(rayAt(i, j, f32(k)));
  var inc = 0.0;
  var cl = -1.0;
  if (k < i32(SM_NW) - 1) {
    let np = u.grid.z / 320.0;
    let pl = u.grid.z / np / length(u.sunDir.xz);    // a piece's length along the ray
    var dHi = sdfAt(rayAt(i, j, f32(k + 1)));
    for (var p = 0; p < i32(np); p++) {
      let x1 = f32(k + 1) - f32(p) / np;           // the piece's sunward end, in texels
      var dLo = dK;
      if (p < i32(np) - 1) { dLo = sdfAt(rayAt(i, j, x1 - 1.0 / np)); }
      if (min(abs(dHi), abs(dLo)) > 0.5 * pl + 40.0 && dHi * dLo > 0.0) {
        if (dLo < 0.0) { inc += SIGMA * pl; } else { cl = inc; }
      } else {
        var dPrev = dHi;
        let ds = 0.25 * pl;
        for (var q = 0; q < 4; q++) {
          let d = sdfAt(rayAt(i, j, x1 - (f32(q) + 0.5) * 0.25 / np));
          // (no steeper than a distance can be: a bound beside a distance looked like a steep slope)
          let gr = min(abs(d - dPrev) / select(ds, 0.5 * ds, q == 0), 1.0);
          let bl = max(gr * ds, SM_EDGE);
          let dt = saturate(0.5 - d / bl) * ds * SIGMA * profileMean(-d, 0.5 * bl);
          if (d > 0.0) { cl = inc + 0.5 * dt; }
          inc += dt;
          dPrev = d;
        }
      }
      dHi = dLo;
    }
  }
  if (dK > 0.0) { cl = inc; }
  bSmSeg[(i * u.nRays + j) * i32(SM_NW) + k] = vec2f(inc, cl);
}
