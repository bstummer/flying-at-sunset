#include "chunks/common.wgsl"

const NOUT = 8;
struct Slices {
  @location(0) o0: f32,
  @location(1) o1: f32,
  @location(2) o2: f32,
  @location(3) o3: f32,
  @location(4) o4: f32,
  @location(5) o5: f32,
  @location(6) o6: f32,
  @location(7) o7: f32,
}
fn ellD(q: vec3f, r: vec3f) -> f32 {   // distance to an ellipsoid (good near its surface)
  let k0 = length(q / r);
  let k1 = length(q / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-9);
}
@fragment fn fs(@builtin(position) pos: vec4f) -> Slices {
  let tx = vec2i(pos.xy);
  let pl = (vec2f(tx - u.tex0) + 0.5) * u.cellH;
  let hs = textureLoad(tCol, tx, 0).r;
  let gx = textureLoad(tCol, vec2i((tx.x + 1) & u.mask, tx.y), 0).r - textureLoad(tCol, vec2i((tx.x - 1) & u.mask, tx.y), 0).r;
  let gz = textureLoad(tCol, vec2i(tx.x, (tx.y + 1) & u.mask), 0).r - textureLoad(tCol, vec2i(tx.x, (tx.y - 1) & u.mask), 0).r;
  let cs = max(inverseSqrt(1.0 + (gx * gx + gz * gz) / (4.0 * u.cellH * u.cellH)), 0.3);
  let y0 = (f32(u.z0) + 0.5) * u.cellV;
  let y1 = y0 + u.cellV * f32(NOUT - 1);
  var acc: array<f32, NOUT>;
  for (var k = 0; k < NOUT; k++) { acc[k] = u.maxD; }
  for (var b = 0; b < u.nb; b++) {
    let bt = vec2i(b & 1023, (b >> 10u) * 3);
    let A = textureLoad(tBub, bt, 0);
    let E = textureLoad(tBub, bt + vec2i(0, 2), 0);
    let dxz = pl - A.xz;
    if (length(dxz) - E.y > u.maxD || y0 - (A.y + E.y) > u.maxD || (A.y - E.y) - y1 > u.maxD) { continue; }
    let B = textureLoad(tBub, bt + vec2i(0, 1), 0);
    let ca = cos(B.w);
    let sa = sin(B.w);
    let q = vec2f(dxz.x * ca + dxz.y * sa, -dxz.x * sa + dxz.y * ca);
    let rxz = vec2f(A.w * B.z, A.w / B.z);
    for (var k = 0; k < NOUT; k++) {
      let dy = y0 + f32(k) * u.cellV - A.y;
      acc[k] = smin(acc[k], ellD(vec3f(q.x, dy, q.y), vec3f(rxz.x, select(B.y, B.x, dy > 0.0), rxz.y)), E.x);
    }
  }
  var res: array<f32, NOUT>;
  for (var k = 0; k < NOUT; k++) {
    let above = y0 + f32(k) * u.cellV - hs;
    res[k] = clamp(smin(above * cs, acc[k], mix(700.0, 60.0, smoothstep(0.0, 1800.0, above))), -u.maxD, u.maxD);
  }
  var o: Slices;
  o.o0 = res[0];
  o.o1 = res[1];
  o.o2 = res[2];
  o.o3 = res[3];
  o.o4 = res[4];
  o.o5 = res[5];
  o.o6 = res[6];
  o.o7 = res[7];
  return o;
}