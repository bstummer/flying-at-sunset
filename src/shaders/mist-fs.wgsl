#include "chunks/common.wgsl"

struct Varyings { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) seed: f32 }
fn vn(p: vec2f, seed: f32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * (3.0 - 2.0 * f);
  let c = vec3u(vec3i(vec2i(i) + 512, i32(seed)));
  let a = hash33(c).x;
  let b = hash33(c + vec3u(1u, 0u, 0u)).x;
  let cc = hash33(c + vec3u(0u, 1u, 0u)).x;
  let d = hash33(c + vec3u(1u, 1u, 0u)).x;
  return mix(mix(a, b, fu.x), mix(cc, d, fu.x), fu.y);
}
@fragment fn fs(v: Varyings) -> @location(0) vec4f {
  let r = length(v.uv);
  var a = 1.0 - smoothstep(0.15, 1.0, r);
  let n = vn(v.uv * 2.5, v.seed) * 0.6 + vn(v.uv * 5.5 + 3.1, v.seed) * 0.4;
  a *= a * saturate(n * 1.6 - 0.15);
  return v.col * a;
}