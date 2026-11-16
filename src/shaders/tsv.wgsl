#include "chunks/common.wgsl"
#include "chunks/clip.wgsl"

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
@fragment fn fs(@builtin(position) pos: vec4f) -> Slices {
  let xz = u.p0 + vec2f(vec2i(pos.xy) - u.tex0) * u.cellT;
  let jit = ign(pos.xy);
  var o: Slices;
  o.o0 = march(xz, (f32(u.z0 + 0) + 0.5) * u.cellTV, fract(jit + f32(0) * 0.618));
  o.o1 = march(xz, (f32(u.z0 + 1) + 0.5) * u.cellTV, fract(jit + f32(1) * 0.618));
  o.o2 = march(xz, (f32(u.z0 + 2) + 0.5) * u.cellTV, fract(jit + f32(2) * 0.618));
  o.o3 = march(xz, (f32(u.z0 + 3) + 0.5) * u.cellTV, fract(jit + f32(3) * 0.618));
  o.o4 = march(xz, (f32(u.z0 + 4) + 0.5) * u.cellTV, fract(jit + f32(4) * 0.618));
  o.o5 = march(xz, (f32(u.z0 + 5) + 0.5) * u.cellTV, fract(jit + f32(5) * 0.618));
  o.o6 = march(xz, (f32(u.z0 + 6) + 0.5) * u.cellTV, fract(jit + f32(6) * 0.618));
  o.o7 = march(xz, (f32(u.z0 + 7) + 0.5) * u.cellTV, fract(jit + f32(7) * 0.618));
  return o;
}