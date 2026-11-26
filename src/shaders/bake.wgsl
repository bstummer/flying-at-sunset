#include "chunks/common.wgsl"

// NOUT slices of a block of a clipmap's distance volume: the sea (from the column map, its distance
// slope-corrected) united with the block's bubbles, with a broad fillet where they swell out of it;
// and the same slices of its billows: how big and how lively those of the nearest are
// (shaders/volumes.js)
const NOUT = 4;
struct Slices {
  @location(0) o0: f32,
  @location(1) o1: f32,
  @location(2) o2: f32,
  @location(3) o3: f32,
  @location(4) b0: vec2f,
  @location(5) b1: vec2f,
  @location(6) b2: vec2f,
  @location(7) b3: vec2f,
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
  // (the billow scales of the bubbles, weighted by how near their surfaces are: within about KS
  // the nearest decides, between two they blend; the same in every level, or the billows would
  // change where the trace hands over from one level to the next)
  var sw: array<f32, NOUT>;
  var sws: array<vec2f, NOUT>;
  let KS = 250.0;
  for (var k = 0; k < NOUT; k++) { acc[k] = u.maxD; sw[k] = 0.0; sws[k] = vec2f(0.0); }
  for (var b = 0; b < u.nb; b++) {
    let i = 3 * (u.b0 + b);
    let A = bBub[i];
    let E = bBub[i + 2];
    let dxz = pl - A.xz;
    if (length(dxz) - E.y > u.maxD || y0 - (A.y + E.y) > u.maxD || (A.y - E.y) - y1 > u.maxD) { continue; }
    let B = bBub[i + 1];
    let ca = cos(B.w);
    let sa = sin(B.w);
    let q = vec2f(dxz.x * ca + dxz.y * sa, -dxz.x * sa + dxz.y * ca);
    let rxz = vec2f(A.w * B.z, A.w / B.z);
    for (var k = 0; k < NOUT; k++) {
      let dy = y0 + f32(k) * u.cellV - A.y;
      let e = ellD(vec3f(q.x, dy, q.y), vec3f(rxz.x, select(B.y, B.x, dy > 0.0), rxz.y));
      acc[k] = smin(acc[k], e, E.x);
      let we = exp2(-max(e, 0.0) / KS);
      sw[k] += we;
      sws[k] += we * E.zw;
    }
  }
  var res: array<vec2f, NOUT>;
  var bil: array<vec2f, NOUT>;
  for (var k = 0; k < NOUT; k++) {
    let above = y0 + f32(k) * u.cellV - hs;
    let r = smin(above * cs, acc[k], mix(700.0, 60.0, smoothstep(0.0, 1800.0, above)));
    let ws = exp2(-max(above * cs, 0.0) / KS);
    let wt = sw[k] + ws;
    // (the sea's billows: SEA_BS, lively)
    let bb = select(vec2f(SEA_BS, 1.0), (sws[k] + ws * vec2f(SEA_BS, 1.0)) / wt, wt > 1e-30);
    res[k] = vec2f(clamp(r, -u.maxD, u.maxD), 0.0);
    bil[k] = bb;
  }
  var o: Slices;
  o.o0 = res[0].x;
  o.o1 = res[1].x;
  o.o2 = res[2].x;
  o.o3 = res[3].x;
  o.b0 = bil[0];
  o.b1 = bil[1];
  o.b2 = bil[2];
  o.b3 = bil[3];
  return o;
}