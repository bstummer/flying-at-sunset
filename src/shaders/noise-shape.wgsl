#include "chunks/common.wgsl"
#include "chunks/noise3d.wgsl"

// the billows: x, y signed distances to random spheres on lattices of u.cells.xy cells per tile,
// the lattices bent by smooth noise so no sphere stays round (lumps, lobes); z, w fields of domes
// (0 between them, 1 on the highest) on lattices of u.cells.zw cells
@compute @workgroup_size(4, 4, 4) fn cs(@builtin(global_invocation_id) g: vec3u) {
  if (any(g >= vec3u(u32(u.size)))) { return; }
  let p = (vec3f(g) + 0.5) / u.size;
  let c = u.cells;
  let p1 = p + (0.34 * warp3(p, c.x, 31u) + 0.17 * warp3(p, 2.0 * c.x, 34u)) / c.x;
  let p2 = p + (0.34 * warp3(p, c.y, 37u) + 0.17 * warp3(p, 2.0 * c.y, 40u)) / c.y;
  let d = vec2f(sphereField(p1, c.x, 1u), sphereField(p2, c.y, 2u));
  textureStore(oShape, g, vec4f(clamp(d * 0.5 + 0.5, vec2f(0.0), vec2f(1.0)), domeField(p, c.z, 3u), domeField(p, c.w, 4u)));
}
