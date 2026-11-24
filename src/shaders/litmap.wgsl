#include "chunks/common.wgsl"
#include "chunks/cloud.wgsl"

// The lit map (shaders/volumes.js, render/sunmap.js): a texel per column of the sun map's window, how
// much sunlight reaches the sea of clouds there: the sun map halfway up the sea's billows, where
// the heaps and towers standing over them cast their shadows (the billows' own shading is the
// deck's, its albedo: chunks/sealit.wgsl)
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let hs = normalize(u.sunDir.xz);
  let w = u.litR.x + pos.x * u.litR.z;
  let a = u.litR.y + pos.y * u.litR.w;
  let xz = hs * w + vec2f(-hs.y, hs.x) * a;
  let C = colAt(xz, select(1, 0, inLv(xz, 0)));
  return vec4f(exp(-sunMapAt(xz, C.x + 0.5 * shellOf(C.y), 0.0).x), 0.0, 0.0, 1.0);
}
