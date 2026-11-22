#include "cloud.wgsl"

// The sun map's bakes (shaders/volumes.js): what they share. A slab's rays toward the sun: ray j of
// its column i, from the window's first texel along the sun's way; the cloud as the map holds it.
const SM_LOD = 1.2;     // the billows the map holds: its texels' footprint over 52 m, as the trace's lod
// (the clouds' edge, blurred over this much: wider, a ray passing over a heap's top, as at a low sun
// it does for hundreds of metres, took a shadow from the air above it)
const SM_EDGE = 10.0;

// the distance to the cloud at p (render space, p.y the height): far from the large shapes a bound
// (over 80 m: past half a step, sunmap.wgsl, so it never counts as cloud), deep inside them their
// distance, else with the billows the map's texels can hold
fn sdfAt(p: vec3f) -> f32 {
  var l = 0;
  if (!inLv(p.xz, 0)) { l = select(2, 1, inLv(p.xz, 1)); }
  let dm = macroAt(p, l);
  if (dm < -200.0) { return dm; }
  // (the billows rise at most shellOf(1.4) above the large shapes)
  if (dm > 800.0 + lvMargin(l)) { return dm - 720.0 - lvMargin(l); }
  let C = colAt(p.xz, l);
  let b = dm - shellOf(C.y) - lvMargin(l);
  if (b > 80.0) { return b; }
  return cloudSDF(p, p.y, vec3f(dm, billowAt(p, l)), C, SM_LOD);
}
// ray j of column i at k texels along it (render space)
fn rayAt(i: i32, j: i32, k: f32) -> vec3f {
  let hs = normalize(u.sunDir.xz);
  let tanE = u.sunDir.y / length(u.sunDir.xz);
  let a = u.aR + f32(u.a0 + i) * SM_DA;
  let w = u.wR + k * SM_DW;
  let xz = vec2f(-hs.y, hs.x) * a + hs * w;
  return vec3f(xz.x, u.hB + f32(j) * SM_DV + k * SM_DW * tanE, xz.y);
}
