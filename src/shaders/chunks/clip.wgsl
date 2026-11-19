
// The clipmaps (render/stream.js): the clouds' constants, the level a sample uses, the distance to
// the large shapes, the column data (shaders/cloud.js)
const INV2R = 0.5 / 6360000.0;
const SEA_BASE = 520.0;
const SIGMA = 0.07;         // extinction inside clouds (1/m): cumulus measure 0.05–0.12
const EDGE_W = 80.0;        // soft boundary thickness (m)
const LIGHT_REACH = 1404.0; // how far the trace's light march looks toward the sun (lightTauN's steps); the shadow volume takes over from there
fn lvMargin(l: i32) -> f32 { return select(select(750.0, 260.0, l == 1), 80.0, l == 0); }   // interpolation error of each level

fn inLv(xz: vec2f, l: i32) -> bool { let v = u.lvV[l]; return xz.x > v.x && xz.y > v.y && xz.x < v.z && xz.y < v.w; }
// the clipmap level for a sample at distance t (dithered handover); coarser outside a window
fn levelAt(xz: vec2f, t: f32, dith: f32) -> i32 {
  var l = 2;
  if (t < 7000.0 + 3000.0 * dith) { l = 0; } else if (t < 40000.0 + 15000.0 * dith) { l = 1; }
  if (l == 0 && !inLv(xz, 0)) { l = 1; }
  if (l == 1 && !inLv(xz, 1)) { l = 2; }
  return l;
}
// distance to the large shapes (no billows yet) in level l
fn macroAt(p: vec3f, l: i32) -> f32 {
  let a = u.lvA[l];
  let uvw = vec3f(p.x * a.x + a.y, p.z * a.x + a.z, p.y * a.w);
  if (l == 0) { return textureSampleLevel(tVol0, sVol, uvw, 0.0).r; }
  if (l == 1) { return textureSampleLevel(tVol1, sVol, uvw, 0.0).r; }
  if (!inLv(p.xz, 2)) { return 20000.0; }
  return textureSampleLevel(tVol2, sVol, uvw, 0.0).r;
}
// column data: sea surface with heaps, billow strength, fine billows, sea level without heaps
fn colAt(xz: vec2f, l: i32) -> vec4f {
  let a = u.lvA[l];
  let uv = vec2f(xz.x * a.x + a.y, xz.y * a.x + a.z);
  if (l == 0) { return textureSampleLevel(tCol0, sRep, uv, 0.0); }
  if (l == 1) { return textureSampleLevel(tCol1, sRep, uv, 0.0); }
  return textureSampleLevel(tCol2, sRep, uv, 0.0);
}
