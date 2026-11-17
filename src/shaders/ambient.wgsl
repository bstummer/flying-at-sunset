#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"
#include "chunks/ambient.wgsl"

// The ambient light (struct Ambient): the sky view's light on a face, one workgroup per face (0 up,
// 1 toward the sun, 2 away from it); its threads share the 24 × 10 sky samples (uniform in cos θ
// over the upper hemisphere), then add them up.
const N = 64u;
var<workgroup> acc: array<vec3f, 64>;
@compute @workgroup_size(64) fn cs(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_index) li: u32) {
  let face = normalize(vec3f(u.sunDir.x, 0.0, u.sunDir.z)) * select(-1.0, 1.0, wg.x == 1u);
  var s = vec3f(0.0);
  for (var k = li; k < 240u; k += N) {
    let ph = 2.0 * PI * (f32(k / 10u) + 0.5) / 24.0;
    let ct = (f32(k % 10u) + 0.5) / 10.0;
    let st = sqrt(1.0 - ct * ct);
    let d = vec3f(st * cos(ph), ct, st * sin(ph));
    s += skyLookup(tSky, d, u.sunDir, u.camH) * select(max(dot(d, face), 0.0), ct, wg.x == 0u);
  }
  acc[li] = s;
  workgroupBarrier();
  for (var h = N / 2u; h > 0u; h >>= 1u) {
    if (li < h) { acc[li] += acc[li + h]; }
    workgroupBarrier();
  }
  if (li != 0u) { return; }
  // uniform in cos θ: E / PI = 2 · mean(L · weight)
  let e = vec4f(acc[0] / 240.0 * 2.0, 1.0);
  switch wg.x {
    case 0u: { bAmb.up = e; }
    case 1u: { bAmb.sunSide = e; }
    default: { bAmb.antiSun = e; }
  }
}
