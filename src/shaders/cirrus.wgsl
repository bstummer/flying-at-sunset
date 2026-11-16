#include "chunks/common.wgsl"

fn vnoise(p: vec2f, per: f32, seed: u32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * (3.0 - 2.0 * f);
  let a = hash33(vec3u(vec2u(mod2(i, vec2f(per))), seed)).x;
  let b = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 0.0), vec2f(per))), seed)).x;
  let c = hash33(vec3u(vec2u(mod2(i + vec2f(0.0, 1.0), vec2f(per))), seed)).x;
  let d = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 1.0), vec2f(per))), seed)).x;
  return mix(mix(a, b, fu.x), mix(c, d, fu.x), fu.y);
}
fn fbm(p: vec2f, per0: f32, seed: u32) -> f32 {
  var s = 0.0;
  var a = 0.5;
  var per = per0;
  for (var i = 0; i < 6; i++) { s += a * vnoise(p * per, per, seed + u32(i)); a *= 0.5; per *= 2.0; }
  return s;
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / u.size;
  let w = vec2f(fbm(p, 4.0, 3u), fbm(p + 0.37, 4.0, 9u)) - 0.5;
  let q = p + w * vec2f(0.08, 0.25);
  // streaks: stretch the fine detail along x
  let base = fbm(q, 3.0, 17u);
  var streak = 0.0;
  var a = 0.5;
  var per = 4.0;
  for (var i = 0; i < 5; i++) {
    let sp = vec2f(q.x * per, q.y * per * 6.0);
    streak += a * vnoise(sp, per, 40u + u32(i));
    a *= 0.55; per *= 2.0;
  }
  let c = saturate((base - 0.47) * 3.2) * (0.35 + 0.9 * streak);
  let patchy = saturate((fbm(p, 2.0, 77u) - 0.42) * 3.0);
  return vec4f(saturate(c * patchy), streak, base, 1.0);
}