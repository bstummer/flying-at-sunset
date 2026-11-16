#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let px = i32(pos.x);
  var acc = vec3f(0.0);
  var w = 0.0;
  let face = normalize(vec3f(u.sunDir.x, 0.0, u.sunDir.z)) * select(-1.0, 1.0, px == 2);
  for (var i = 0; i < 24; i++) {
    for (var j = 0; j < 10; j++) {
      let ph = 2.0 * PI * (f32(i) + 0.5) / 24.0;
      var ct = (f32(j) + 0.5) / 10.0;
      if (px == 1) { ct = ct * 0.25; }
      let st = sqrt(1.0 - ct * ct);
      let d = vec3f(st * cos(ph), ct, st * sin(ph));
      let L = skyLookup(tSky, d, u.sunDir, u.camH);
      var wt = max(dot(d, face), 0.0);
      if (px == 0) { wt = ct; } else if (px == 1) { wt = 1.0; }
      acc += L * wt;
      w += wt;
    }
  }
  // px0: irradiance/PI = mean(L cos)/mean(cos) * ... ; uniform-in-cos sampling -> E = 2PI * mean(L cos)
  let r = select(acc / f32(240) * 2.0, acc / w, px == 1);
  return vec4f(r, 1.0);
}