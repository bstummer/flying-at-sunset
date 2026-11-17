#include "chunks/common.wgsl"
#include "chunks/noise3d.wgsl"

// the cloud shapes: signed distances to random spheres on lattices of u.cells cells per tile
@compute @workgroup_size(4, 4, 4) fn cs(@builtin(global_invocation_id) g: vec3u) {
  if (any(g >= vec3u(u32(u.size)))) { return; }
  let p = (vec3f(g) + 0.5) / u.size;
  let d = vec4f(sphereField(p, u.cells.x, 1u), sphereField(p, u.cells.y, 2u), sphereField(p, u.cells.z, 3u), sphereField(p, u.cells.w, 4u));
  textureStore(oShape, g, clamp(d * 0.5 + 0.5, vec4f(0.0), vec4f(1.0)));
}
