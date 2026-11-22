#include "chunks/common.wgsl"
#include "chunks/sunmap.wgsl"

// The sun map's stretches (shaders/volumes.js): an invocation per texel of a slab's rays, for the
// stretch toward the sun from it to the next: its optical depth (x; uniform where both ends are far
// from the surface, else in four steps, each inside by its distance and slope, as the trace's light
// march), and from the stretch's sunward end, the optical depth to the last point in it clear of
// cloud, the texel included (y; -1: none). Into bSmSeg, SM_NW a ray; sunmap-scan.wgsl adds them up.
@compute @workgroup_size(64, 1, 1) fn cs(@builtin(global_invocation_id) g: vec3u) {
  let j = i32(g.x);
  let i = i32(g.y);
  let k = i32(g.z);
  if (i >= u.slab || j >= u.nRays) { return; }
  let seg = SM_DW / length(u.sunDir.xz);       // a texel's length along the ray
  let dK = sdfAt(rayAt(i, j, f32(k)));
  var inc = 0.0;
  var cl = -1.0;
  if (k < i32(SM_NW) - 1) {
    let dHi = sdfAt(rayAt(i, j, f32(k + 1)));
    if (min(abs(dHi), abs(dK)) > 0.5 * seg + 40.0 && dHi * dK > 0.0) {
      if (dK < 0.0) { inc = SIGMA * seg; }
    } else {
      var dPrev = dHi;
      let ds = 0.25 * seg;
      for (var q = 0; q < 4; q++) {
        let d = sdfAt(rayAt(i, j, f32(k) + 1.0 - (f32(q) + 0.5) * 0.25));
        // (no steeper than a distance can be: a bound beside a distance looked like a steep slope)
        let gr = min(abs(d - dPrev) / select(ds, 0.5 * ds, q == 0), 1.0);
        let bl = max(gr * ds, SM_EDGE);
        let dt = saturate(0.5 - d / bl) * ds * SIGMA * profileMean(-d, 0.5 * bl);
        if (d > 0.0) { cl = inc + 0.5 * dt; }
        inc += dt;
        dPrev = d;
      }
    }
  }
  if (dK > 0.0) { cl = inc; }
  bSmSeg[(i * u.nRays + j) * i32(SM_NW) + k] = vec2f(inc, cl);
}
