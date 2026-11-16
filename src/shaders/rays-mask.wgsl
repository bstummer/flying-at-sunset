#include "chunks/common.wgsl"

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy * u.dstTexel;
  let ndc = uv * 2.0 - 1.0;
  let dir = normalize(u.camFwd + ndc.x * u.tanHalf.x * u.camRight + ndc.y * u.tanHalf.y * u.camUp);
  let c = max(dot(dir, u.sunDir), 0.0);
  let glow = pow(c, 600.0) * 3.0 + pow(c, 60.0) * 0.4 + pow(c, 8.0) * 0.04;
  var T = textureSampleLevel(tHist, sLin, uv, 0.0).a;
  if (uv.x > u.birdBox.x && uv.y > u.birdBox.y && uv.x < u.birdBox.z && uv.y < u.birdBox.w) { T *= 1.0 - textureSampleLevel(tBird, sLin, uv, 0.0).a; }
  return vec4f(vec3f(glow * T), 1.0);
}