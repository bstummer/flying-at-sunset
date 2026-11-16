#include "chunks/common.wgsl"

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy * u.dstTexel;
  let t = u.srcTexel;
  var s = textureSampleLevel(tSrc, sLin, uv, 0.0).rgb * 4.0;
  s += (textureSampleLevel(tSrc, sLin, uv + t * vec2f(1.0, 0.0), 0.0).rgb + textureSampleLevel(tSrc, sLin, uv + t * vec2f(-1.0, 0.0), 0.0).rgb
      + textureSampleLevel(tSrc, sLin, uv + t * vec2f(0.0, 1.0), 0.0).rgb + textureSampleLevel(tSrc, sLin, uv + t * vec2f(0.0, -1.0), 0.0).rgb) * 2.0;
  s += textureSampleLevel(tSrc, sLin, uv + t * vec2f(1.0, 1.0), 0.0).rgb + textureSampleLevel(tSrc, sLin, uv + t * vec2f(-1.0, 1.0), 0.0).rgb
     + textureSampleLevel(tSrc, sLin, uv + t * vec2f(1.0, -1.0), 0.0).rgb + textureSampleLevel(tSrc, sLin, uv + t * vec2f(-1.0, -1.0), 0.0).rgb;
  return vec4f(s / 16.0 * u.weight, 1.0);
}