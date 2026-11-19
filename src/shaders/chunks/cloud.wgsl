#include "atmo.wgsl"
#include "clip.wgsl"

// The clouds' shape, density and light toward the sun (shaders/cloud.js)
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
// how much of a child octave grows where its parent octave's sphere distance is n: all of it on the
// parent's bulges (n < 0), none in the creases and the plain between them (n > w). Cauliflower:
// small billows heaped on the caps of bigger ones, the folds between those deep and smooth.
fn onCap(n: f32, w: f32) -> f32 { return 1.0 - smoothstep(-0.3 * w, w, n); }

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
  // (each on the caps of the one before)
  ds = octave(ds, sf.z * 320.0, 56.0 * w3 * C.z * onCap(sf.y * 640.0, 160.0), 90.0);
  return octave(ds, sf.w * 160.0, 26.0 * w4 * C.z * onCap(sf.z * 320.0, 80.0), 45.0);
}
// the same, looking up the large shapes and column data of level l
fn sceneSDF(wp: vec3f, h: f32, l: i32, lod: f32) -> f32 {
  return cloudSDF(wp, h, macroAt(vec3f(wp.x, h, wp.z), l), colAt(wp.xz, l), lod);
}

// Density (0..1) from the signed distance: real cumulus ends within metres, so the density ramps
// up over edgeW (about a pixel of the trace where the outline is crisp), at a surface the detail
// noise eats into by up to ERODE m: creases along the cells of the Worley noise, billowy texture
// below the billow octaves (detailW fades it out far away), and finer still near the camera
// (nearW). Inside a cloud near the camera: drifting variations of density, mist streaming past.
const ERODE = 14.0;
fn densityFromSDF(d: f32, wp: vec3f, detailW: f32, edgeW: f32, nearW: f32) -> f32 {
  let x = -d;
  if (x <= 0.0) { return 0.0; }
  let amp = ERODE * detailW;
  if (x < amp + edgeW) {
    let dn = textureSampleLevel(tDetail, sRep, (wp + u.detailOff) * (1.0 / DETAIL_TILE), 0.0);
    var e = saturate((0.8 - dn.r) / 0.45);
    if (nearW > 0.01) {
      let dn2 = textureSampleLevel(tDetail, sRep, (wp + u.detailOff * 2.0) * (4.0 / DETAIL_TILE) + dn.a * 0.35, 0.0);
      e = mix(e, e * 0.6 + saturate((0.8 - dn2.r) / 0.45) * 0.4, nearW);
    }
    return saturate((x - amp * e) / edgeW);
  }
  var dens = saturate(x / edgeW);
  if (nearW > 0.01) {
    let dn = textureSampleLevel(tDetail, sRep, (wp + u.detailOff * 2.0) * (2.0 / DETAIL_TILE), 0.0);
    dens *= mix(1.0, 0.25 + 1.1 * dn.r * dn.r + 0.3 * dn.g, nearW);
  }
  return dens;
}

// optical depth toward the sun from the shadow volume, past the light march's reach: through the
// cloud the point is in, and through the clouds beyond (no shadows outside its window)
fn tsvTau(wp: vec3f, h: f32) -> vec2f {
  let v = u.tsvV;
  let w = min(min(wp.x - v.x, v.z - wp.x), min(wp.z - v.y, v.w - wp.z));
  if (w <= 0.0) { return vec2f(0.0); }
  return textureSampleLevel(tTsv, sVol, vec3f(wp.x * u.tsvA.x + u.tsvA.y, wp.z * u.tsvA.x + u.tsvA.z, h * u.tsvA.w), 0.0).rg * saturate(w / 8000.0);
}

// Multiple scattering approximation (Wrenninge): sum of octaves with reduced extinction & anisotropy
// (each octave's share falls as fast as its extinction, a = b: no light that was never taken out)
fn phaseOctaves(c: f32) -> vec4f {
  return vec4f(mix(HG(c, -0.3), HG(c, 0.8), 0.62), mix(HG(c, -0.15), HG(c, 0.4), 0.62),
               mix(HG(c, -0.075), HG(c, 0.2), 0.62), mix(HG(c, -0.0375), HG(c, 0.1), 0.62));
}
fn msScatterP(tau: f32, ph: vec4f) -> f32 {
  let k = vec4f(1.0, 0.5, 0.25, 0.125);
  return dot(exp(-tau * k) * k, ph);
}
// The sun's light scattered at a point in a cloud, per unit of sunlight: the low orders by octaves,
// and the high ones as diffusion (light that wandered deep into the cloud: about E/π where the sun
// gets in square to the surface, less where it grazes it (a cloud top at 5° takes in a fraction of
// what a face turned to the sun does), falling off as a thick cloud's diffuse transmission
// (two-stream, g ≈ 0.85) with the optical depth toward the sun, and lower within a mean free path
// or two of the surface, where it leaks out). Neutral: droplets scatter every colour alike.
// tau: optical depth toward the sun (lightTauN); far: past its reach (tsvTau: through this cloud,
// through the clouds beyond, whose shadow takes every order alike); pw: the powder term; depthIn:
// depth below the surface (m); nS: how squarely the surface nearby faces the sun (-1..1, lightTauN).
const DIFFUSE = 0.3;
fn sunScatter(tau: f32, far: vec2f, ph: vec4f, pw: f32, depthIn: f32, nS: f32) -> f32 {
  let facing = 0.35 + 0.65 * saturate(nS);
  let diffu = DIFFUSE * facing / (1.0 + 0.11 * (tau + far.x)) * (1.0 - 0.55 * exp(-depthIn * SIGMA / 1.5));
  return (msScatterP(tau + far.x, ph) * pw + diffu) * exp(-far.y);
}
// the sky's light on cloud (bAmb holds irradiance / π; a thick cloud returns most of it)
const AMB_K = 1.0;

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
  // then on through the cloud it is in, through the large shapes alone, in three long steps out to
  // LIGHT_REACH, until it comes out (a tower's far side shades its backlit face in metres, not in
  // the shadow volume's 768 m texels; the shadows of other clouds stay the shadow volume's)
  ds = 1200.0;
  for (var i = 0; i < 3; i++) {
    let sm = s + ds * (0.25 + 0.5 * jit);
    let p = vec3f(wp0.x, h0, wp0.z) + u.sunDir * sm;
    var lf = l;
    if (lf == 0 && !inLv(p.xz, 0)) { lf = 1; }
    if (lf == 1 && !inLv(p.xz, 1)) { lf = 2; }
    let occ = saturate((120.0 - macroAt(p, lf)) / 380.0);
    if (occ < 0.05) { break; }
    tau += occ * ds * SIGMA;
    s += ds;
    ds *= 1.33;
  }
  return vec2f(tau, nS);
}
fn lightTau(wp0: vec3f, h0: f32, l: i32, C: vec4f, jit: f32, lod0: f32) -> f32 {
  return lightTauN(wp0, h0, l, C, jit, lod0).x;
}
