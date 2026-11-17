#include "chunks/common.wgsl"
#include "chunks/noise3d.wgsl"

// the detail: Worley and Perlin noise for the wispy erosion
@compute @workgroup_size(4, 4, 4) fn cs(@builtin(global_invocation_id) g: vec3u) {
  if (any(g >= vec3u(u32(u.size)))) { return; }
  let p = (vec3f(g) + 0.5) / u.size;
  let w1 = 1.0 - worley(p, u.cells.x, 5u);
  let w2 = 1.0 - worley(p, u.cells.y, 6u);
  let w3 = 1.0 - worley(p, u.cells.z, 7u);
  let wf = saturate(w1 * 0.6 + w2 * 0.28 + w3 * 0.12);
  var pf = 0.0;
  var amp = 0.5;
  var per = u.cells.x;
  for (var k = 0; k < 4; k++) { pf += amp * perlin(p * per, per, u32(9 + k)); amp *= 0.5; per *= 2.0; }
  pf = saturate(pf * 0.9 + 0.5);
  let w4 = 1.0 - worley(p, u.cells.w, 8u);
  textureStore(oDetail, g, vec4f(wf, pf, saturate(w3 * 0.6 + w4 * 0.4), saturate(perlin(p * u.cells.y, u.cells.y, 21u) * 0.9 + 0.5)));
}
