#include "cloud.wgsl"

// The sun map's bakes (shaders/volumes.js): what they share. A slab's rays toward the sun: ray j of
// its column i, from the window's first texel along the sun's way; the cloud as the level holds it.
// the billows a level holds: its texels' footprint over 52 m, as the trace's lod (1.2 for the fine
// level's 64 m)
fn smLod() -> f32 { return 1.2 * u.grid.x / 64.0; }
// (the clouds' edge, blurred over this much: wider, a ray passing over a heap's top, as at a low sun
// it does for hundreds of metres, took a shadow from the air above it)
const SM_EDGE = 10.0;

// the distance to the cloud at p (render space, p.y the height): far from the large shapes a bound
// (over 80 m: past half a step, sunmap.wgsl, so it never counts as cloud), deep inside them their
// distance, else with the billows the map's texels can hold; from the clipmap level u.lv0 on
fn sdfAt(p: vec3f) -> f32 {
  var l = u.lv0;
  if (l == 0 && !inLv(p.xz, 0)) { l = 1; }
  if (l == 1 && !inLv(p.xz, 1)) { l = 2; }
  let dm = macroAt(p, l);
  if (dm < -200.0) { return dm; }
  // (the billows rise at most shellOf(1.4) above the large shapes)
  if (dm > 800.0 + lvMargin(l)) { return dm - 720.0 - lvMargin(l); }
  let C = colAt(p.xz, l);
  let b = dm - shellOf(C.y) - lvMargin(l);
  if (b > 80.0) { return b; }
  return cloudSDF(p, p.y, vec3f(dm, billowAt(p, l)), C, smLod());
}
// ray j of column i at k texels along it (render space)
fn rayAt(i: i32, j: i32, k: f32) -> vec3f {
  let hs = normalize(u.sunDir.xz);
  let tanE = u.sunDir.y / length(u.sunDir.xz);
  let a = u.aR + f32(u.a0 + i) * u.grid.x;
  let w = u.wR + k * u.grid.z;
  let xz = vec2f(-hs.y, hs.x) * a + hs * w;
  return vec3f(xz.x, u.hB + f32(j) * u.grid.y + k * u.grid.z * tanE, xz.y);
}
