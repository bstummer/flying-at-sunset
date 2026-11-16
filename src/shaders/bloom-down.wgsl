#include "chunks/common.wgsl"
#include "chunks/nan.wgsl"

fn src(uv: vec2f) -> vec3f {
  var c = textureSampleLevel(tSrc, sLin, uv, 0.0).rgb;
  if (u.first == 1 && uv.x > u.birdBox.x && uv.y > u.birdBox.y && uv.x < u.birdBox.z && uv.y < u.birdBox.w) {
    let b = textureSampleLevel(tBird, sLin, uv, 0.0);
    c = c * (1.0 - b.a) + b.rgb;
  }
  if (isnan3(c) || isinf3(c)) { c = vec3f(0.0); }
  return min(c, vec3f(u.clampHi));
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = (floor(pos.xy) * 2.0 + 1.0) * u.srcTexel;
  let t = u.srcTexel;
  let a = src(uv + t * vec2f(-2.0, 2.0));
  let b = src(uv + t * vec2f(0.0, 2.0));
  let c = src(uv + t * vec2f(2.0, 2.0));
  let d = src(uv + t * vec2f(-2.0, 0.0));
  let e = src(uv);
  let f = src(uv + t * vec2f(2.0, 0.0));
  let g = src(uv + t * vec2f(-2.0, -2.0));
  let h = src(uv + t * vec2f(0.0, -2.0));
  let i = src(uv + t * vec2f(2.0, -2.0));
  let j = src(uv + t * vec2f(-1.0, 1.0));
  let k = src(uv + t * vec2f(1.0, 1.0));
  let l = src(uv + t * vec2f(-1.0, -1.0));
  let m = src(uv + t * vec2f(1.0, -1.0));
  // 13-tap downsample (no Karis average: the sun is a big stable disk and must bloom fully)
  let r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  return vec4f(r, 1.0);
}