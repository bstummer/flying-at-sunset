#include "chunks/common.wgsl"

// Sun rays' source, at quarter resolution: the glow around the sun where sky shows past the clouds
// and the bird (the scene's alpha)
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy * u.dstTexel;
  let ndc = uv * 2.0 - 1.0;
  let dir = normalize(u.camFwd + ndc.x * u.tanHalf.x * u.camRight + ndc.y * u.tanHalf.y * u.camUp);
  let c = max(dot(dir, u.sunDir), 0.0);
  let glow = pow(c, 600.0) * 3.0 + pow(c, 60.0) * 0.4 + pow(c, 8.0) * 0.04;
  // (the scene's alpha: how much sky shows past the clouds and the bird)
  let T = textureSampleLevel(tScene, sLin, uv, 0.0).a;
  return vec4f(vec3f(glow * T), 1.0);
}