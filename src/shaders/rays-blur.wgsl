#include "chunks/common.wgsl"

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  // radial blur toward the sun; run twice (short then long strides) for smooth, noise-free rays
  let uv = pos.xy * u.dstTexel;
  let d = (u.sunUv - uv) * u.stepScale;
  var p = uv;
  var acc = vec3f(0.0);
  var w = 1.0;
  var ws = 0.0;
  for (var i = 0; i < 24; i++) {
    acc += textureSampleLevel(tSrc, sLin, p, 0.0).rgb * w;
    ws += w;
    w *= u.decay;
    p += d;
  }
  return vec4f(acc / ws, 1.0);
}