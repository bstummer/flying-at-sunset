#include "chunks/common.wgsl"

// Sun rays: a radial blur toward the sun, run twice (short strides, then long) for smooth,
// noise-free rays
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
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