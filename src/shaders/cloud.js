// Clouds: what the trace, the shadow volume, the probe and the mist share
// The world lives in camera-centred clipmaps (render space: world minus a snapped origin):
// three 3D distance volumes of the large shapes (sea relief, heaps, towers), 128 m / 512 m / 2 km,
// each with a 2D map of per-column data, addressed toroidally so they stream as the bird flies.

// uniforms of the clipmap lookups (part of the uniforms of every shader that includes them)
export const U_CLIP = {
  lvA: 'vec4f[3]',      // per level: 1 / extent, toroidal offset x, z, 1 / height
  lvV: 'vec4f[3]',      // per level: valid window (min x, min z, max x, max z)
};
export const WGSL_CLIP = /* wgsl */ `
const INV2R = 0.5 / 6360000.0;
const SEA_BASE = 520.0;
const CLOUD_TOP = 14000.0;
const SHAPE_TILE = 5120.0;
const DETAIL_TILE = 512.0;
const SIGMA = 0.035;        // extinction inside clouds (1/m)
const EDGE_W = 80.0;        // soft boundary thickness (m)
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
`;

export const U_CLOUD = {
  tsvA: 'vec4f',        // shadow volume: the same as lvA
  tsvV: 'vec4f',
  warpPh: 'vec4f',      // phases of the billow warp at the render origin
  warpPh2: 'vec2f',
  shapeOff: 'vec3f',    // slow evolution of the sea billows (wrapped)
  detailOff: 'vec3f',
  sunDir: 'vec3f',
  sunCol: 'vec3f[16]',
};
export const WGSL_CLOUD = WGSL_CLIP + /* wgsl */ `
fn sunColorAt(h: f32) -> vec3f {
  let f = clamp(h / 750.0, 0.0, 14.99);
  let i = i32(f);
  return mix(u.sunCol[i], u.sunCol[i + 1], f - f32(i));
}

fn octave(d: f32, n0: f32, shell: f32, k: f32) -> f32 {
  // spheres may only bulge out to "shell" beyond the current surface; the clip is wide and soft
  // so over-sized spheres become rounded swells instead of flat-topped plateaus
  let n = smax(n0, d - shell, max(k, shell * 1.6));
  // a tight union: crisp, defined creases between the billows (the clip above keeps every sphere
  // within the shell, so none floats detached)
  return smin(n, d, mix(max(k * 0.8, shell * 1.05), shell * 0.5 + 4.0, 0.7));
}
fn shellOf(a: f32) -> f32 { return 400.0 * a + 120.0; }    // highest billows above the large shapes

// a slow, seamless warp of the billow pattern: waves of unrelated lengths, it never repeats
fn warpLand(p: vec3f) -> vec3f {
  let q = p.xz;
  return p + vec3f(240.0 * sin(q.y * 8.37e-4 + u.warpPh.x + 1.3 * sin(q.x * 3.41e-4 + u.warpPh.y)) + 150.0 * sin(q.y * 2.53e-4 + q.x * 1.49e-4 + u.warpPh.z), 0.0,
                   240.0 * sin(q.x * 9.29e-4 + u.warpPh.w + 1.3 * sin(q.y * 3.97e-4 + u.warpPh2.x)) + 150.0 * sin(q.x * 1.93e-4 - q.y * 2.91e-4 + u.warpPh2.y));
}

// Signed distance (m) to the cloud surface: the large shapes (dm, from a clipmap) with billows of
// spheres heaped on them. C: column data. lod: 0 = full detail.
fn cloudSDF(wp: vec3f, h: f32, dm: f32, C: vec4f, lod: f32) -> f32 {
  // squashed lookup: billows are wider than tall (heaps, not balls)
  var sf = textureSampleLevel(tShape, sRep, (warpLand(wp) + u.shapeOff) * (vec3f(1.0, 1.35, 1.0) / SHAPE_TILE), 0.0) * 2.0 - 1.0;
  sf *= 1.0 / 1.35;
  let A = C.y;
  var ds = octave(dm, sf.x * 1280.0, 300.0 * A, 300.0);
  ds = octave(ds, sf.y * 640.0, 160.0 * A, 160.0);
  // cauliflower detail on the upper parts of the sea and on everything heaped above it; the
  // troughs stay smooth
  let topW = saturate((h - min(C.x, C.w + 100.0) + 40.0) / 220.0);
  let w3 = (1.0 - smoothstep(0.8, 2.0, lod)) * topW;
  let w4 = (1.0 - smoothstep(0.35, 1.0, lod)) * topW;
  ds = octave(ds, sf.z * 320.0, 56.0 * w3 * C.z, 90.0);
  ds = octave(ds, sf.w * 160.0, 26.0 * w4 * C.z, 45.0);
  var d = ds;
  // near the camera: an extra pair of small billow octaves (crisp cauliflower texture up close)
  if (lod < 0.15 && abs(d) < 80.0) {   // only matters right at the surface
    let wn = 1.0 - smoothstep(0.05, 0.15, lod);
    let sn = textureSampleLevel(tShape, sRep, (wp + u.shapeOff * 2.0) * (8.0 / SHAPE_TILE), 0.0) * 2.0 - 1.0;
    d = octave(d, sn.y * 80.0, 20.0 * wn, 16.0);
    d = octave(d, sn.z * 40.0, 10.0 * wn, 8.0);
  }
  return d;
}
// the same, looking up the large shapes and column data of level l
fn sceneSDF(wp: vec3f, h: f32, l: i32, lod: f32) -> f32 {
  return cloudSDF(wp, h, macroAt(vec3f(wp.x, h, wp.z), l), colAt(wp.xz, l), lod);
}

// density (0..1) from the signed distance with wispy erosion at the soft boundary.
// edgeW: boundary softness; nearW: weight of extra-fine wisps close to the camera; farW: coarse
// fraying for distant silhouettes
fn densityEx(d: f32, wp: vec3f, detailW: f32, edgeW: f32, nearW: f32, farW: f32) -> f32 {
  let x = -d;
  if (x <= 0.0) { return 0.0; }
  var dens = saturate(x / edgeW);
  var er = 0.0;
  if (detailW > 0.01 && x < edgeW * 2.5) {
    let dn = textureSampleLevel(tDetail, sRep, (wp + u.detailOff) * (1.0 / DETAIL_TILE), 0.0);
    var e = mix(dn.g, dn.r, saturate(x / (edgeW * 1.5)));
    if (nearW > 0.01) {
      let dn2 = textureSampleLevel(tDetail, sRep, (wp + u.detailOff * 2.0) * (4.0 / DETAIL_TILE) + dn.a * 0.35, 0.0);
      e = mix(e, e * 0.6 + dn2.r * 0.55, nearW);
    }
    er = e * 0.36 * detailW;
  } else if (nearW > 0.01) {
    // inside a cloud near the camera: drifting density variations so mist visibly streams past
    let dn = textureSampleLevel(tDetail, sRep, (wp + u.detailOff * 2.0) * (2.0 / DETAIL_TILE), 0.0);
    dens *= mix(1.0, 0.25 + 1.1 * dn.r * dn.r + 0.3 * dn.g, nearW);
  }
  // far away: coarse erosion of the outermost rim only, so distant silhouettes fray instead of
  // ending in smooth outlines (the faces themselves stay crisp)
  if (farW > 0.01 && x < edgeW) {
    let fz = textureSampleLevel(tDetail, sRep, wp * (1.0 / 4096.0), 0.0);
    er = max(er, (0.65 * fz.g + 0.35 * fz.r) * 0.3 * farW * (1.0 - x / edgeW));
  }
  if (er > 0.0) { dens = saturate((dens - er) / max(1.0 - er, 0.15)); }
  return dens;
}
fn densityFromSDF(d: f32, wp: vec3f, detailW: f32, edgeW: f32, nearW: f32) -> f32 {
  return densityEx(d, wp, detailW, edgeW, nearW, 0.0);
}

// optical depth toward the sun from the shadow volume (no shadows outside its window)
fn tsvTau(wp: vec3f, h: f32) -> f32 {
  let v = u.tsvV;
  let w = min(min(wp.x - v.x, v.z - wp.x), min(wp.z - v.y, v.w - wp.z));
  if (w <= 0.0) { return 0.0; }
  return textureSampleLevel(tTsv, sVol, vec3f(wp.x * u.tsvA.x + u.tsvA.y, wp.z * u.tsvA.x + u.tsvA.z, h * u.tsvA.w), 0.0).r * saturate(w / 8000.0);
}

fn HG(c: f32, g: f32) -> f32 {
  let g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
// Multiple scattering approximation (Wrenninge): sum of octaves with reduced extinction & anisotropy
fn phaseOctaves(c: f32) -> vec4f {
  return vec4f(mix(HG(c, -0.3), HG(c, 0.8), 0.62), mix(HG(c, -0.15), HG(c, 0.4), 0.62),
               mix(HG(c, -0.075), HG(c, 0.2), 0.62), mix(HG(c, -0.0375), HG(c, 0.1), 0.62));
}
fn msScatterP(tau: f32, ph: vec4f) -> f32 {
  let e = exp(-tau * vec4f(1.0, 0.5, 0.25, 0.125));
  return dot(e * vec4f(1.0, 0.55, 0.3025, 0.166375), ph);
}

// Optical depth toward the sun from a point (short march with growing steps), and nS: how much
// the surface there faces the sun (-1..1), from the distance field along the first two steps.
// l, C: clipmap level and column data of the starting point. Returns (tau, nS).
fn lightTauN(wp0: vec3f, h0: f32, l: i32, C: vec4f, jit: f32, lod0: f32) -> vec2f {
  var tau = 0.0;
  var s = 0.0;
  var ds = 25.0;
  var d1 = 0.0;
  var s1 = 0.0;
  var nS = 0.0;
  for (var i = 0; i < 5; i++) {
    let sm = s + ds * (0.25 + 0.5 * jit);
    let wp = wp0 + u.sunDir * sm;
    let h = h0 + u.sunDir.y * sm;
    // the first steps keep the detail of the view sample: bulges shade themselves at any range
    let d = cloudSDF(wp, h, macroAt(vec3f(wp.x, h, wp.z), l), C, lod0 + f32(max(i - 1, 0)) * 0.6);
    if (i == 0) { d1 = d; s1 = sm; }
    else if (i == 1) { nS = clamp((d - d1) / (sm - s1), -1.0, 1.0); }
    // near steps: point density; long far steps: smooth coverage estimate (no contour rings)
    // the density ramp widens with the step length so long steps don't switch abruptly (and is
    // sharp right at the start, so each bulge shades the one beside it)
    tau += saturate(-d / (mix(30.0, EDGE_W, saturate(s / 200.0)) + ds * 0.35)) * ds * SIGMA;
    s += ds;
    ds *= 2.4;
  }
  return vec2f(tau, nS);
}
fn lightTau(wp0: vec3f, h0: f32, l: i32, C: vec4f, jit: f32, lod0: f32) -> f32 {
  return lightTauN(wp0, h0, l, C, jit, lod0).x;
}
`;
