#include "chunks/common.wgsl"

fn vnoise(p: vec2f, per: vec2f, seed: u32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * (3.0 - 2.0 * f);
  let a = hash33(vec3u(vec2u(mod2(i, per)), seed)).x;
  let b = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 0.0), per)), seed)).x;
  let c = hash33(vec3u(vec2u(mod2(i + vec2f(0.0, 1.0), per)), seed)).x;
  let d = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 1.0), per)), seed)).x;
  return mix(mix(a, b, fu.x), mix(c, d, fu.x), fu.y);
}
fn fbm(p: vec2f, per0: vec2f, seed: u32) -> f32 {
  var s = 0.0;
  var a = 0.5;
  var per = per0;
  for (var i = 0; i < 6; i++) { s += a * vnoise(p * per, per, seed + u32(i)); a *= 0.5; per *= 2.0; }
  return s;
}
fn layer(p: vec2f, seed: u32) -> f32 {
  let w = vec2f(fbm(p, vec2f(3.0, 6.0), seed + 60u), fbm(p + 0.31, vec2f(3.0, 6.0), seed + 70u)) - 0.5;
  let q = p + w * vec2f(0.05, 0.03);
  let patchy = smoothstep(0.62, 0.76, fbm(q, vec2f(2.0, 5.0), seed));         // a few long patches
  let body = smoothstep(0.32, 0.72, fbm(q, vec2f(3.0, 20.0), seed + 20u));     // stretched along x
  let streak = fbm(q, vec2f(6.0, 64.0), seed + 40u);
  return patchy * body * (0.45 + 0.75 * streak);
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / u.size;
  return vec4f(saturate(layer(p, 101u)), saturate(layer(p + vec2f(0.43, 0.27), 151u)), fbm(p, vec2f(8.0, 96.0), 211u), 1.0);
}