#include "atmo.wgsl"
#include "clip.wgsl"
#include "lobes.wgsl"

// The clouds' shape, density and light toward the sun (shaders/cloud.js)
fn sunColorAt(h: f32) -> vec3f {
  let f = clamp(h / 750.0, 0.0, 14.99);
  let i = i32(f);
  return mix(u.sunCol[i], u.sunCol[i + 1], f - f32(i));
}

// the billows on the large shapes nearest p in level l: how big (m) and how lively (0..1). A volume
// of its own, read only where the billows are built (the empty-space skipping reads the distance)
fn billowAt(p: vec3f, l: i32) -> vec2f {
  let a = u.lvA[l];
  let uvw = vec3f(p.x * a.x + a.y, p.z * a.x + a.z, p.y * a.w);
  if (l == 0) { return textureSampleLevel(tBs0, sVol, uvw, 0.0).rg; }
  if (l == 1) { return textureSampleLevel(tBs1, sVol, uvw, 0.0).rg; }
  if (!inLv(p.xz, 2)) { return vec2f(SEA_BS, 1.0); }
  return textureSampleLevel(tBs2, sVol, uvw, 0.0).rg;
}
// the large shapes in level l: the distance to them, and their billows
fn shapeAt(p: vec3f, l: i32) -> vec3f { return vec3f(macroAt(p, l), billowAt(p, l)); }

fn shellOf(a: f32) -> f32 { return 400.0 * a + 160.0; }    // highest billows above the large shapes
// how much of a finer octave grows where the sphere distance of the lobes is n: all of it on the
// lobes (n < 0), none in the creases and the plain between them (n > w). Cauliflower: small
// billows heaped on the caps of bigger ones, the folds between those deep and smooth.
fn onCap(n: f32, w: f32) -> f32 { return 1.0 - smoothstep(-0.3 * w, w, n); }

// where the domes of a field b (0..1) are highest: the next finer ones heap up there
fn onDome(b: f32) -> f32 { return 0.4 + 0.6 * smoothstep(0.05, 0.5, b); }
// a field of domes moving the surface ds out by a (in where a < 0), less the farther out it already
// is (none past k): domes swell out of the surface, none floats above it
fn dome(ds: f32, a: f32, k: f32) -> f32 { return ds - a * (1.0 - smoothstep(0.0, k, ds)); }

// Signed distance (m) to the cloud surface: the large shapes (sh.x, from a clipmap), lobes of bent
// spheres heaped on them, and domes on those, down to metres; the lobes and turrets only where the
// billows of the nearest bubble are big enough (sh.y, m), all of them lower where those have lost
// their life (sh.z: old parts and wakes soften). C: column data. lod: 0 = full detail.
fn cloudSDF(wp: vec3f, h: f32, sh: vec3f, C: vec4f, lod: f32) -> f32 {
  let dm = sh.x;
  // squashed lookup: billows are wider than tall (heaps, not balls)
  let s = textureSampleLevel(tShape, sRep, (warpLand(wp) + u.shapeOff) * (vec3f(1.0, 1.35, 1.0) / SHAPE_TILE), 0.0);
  let sf = (s.xy * 2.0 - 1.0) * (1.0 / 1.35);
  let A = C.y * mix(0.6, 1.0, sh.z);
  // (the largest lobes are in the large shapes already: the bake grows them on the towers)
  // (lobes on bubbles of more than ~2 km, turrets on those of more than ~1 km: a crown a few hundred
  // metres across boils in small domes, not in lobes bigger than itself)
  let wL = smoothstep(700.0, 1500.0, sh.y);
  let wT = smoothstep(350.0, 800.0, sh.y);
  var ds = octave(dm, sf.x * 1280.0, 300.0 * A * wL, 300.0 * wL + 4.0);
  // (the turrets heap on the lobes' caps: the lobes' flanks and the creases between them stay
  // broad, so the billows come in sizes, not as one bubbly texture)
  ds = octave(ds, sf.y * 640.0, 160.0 * A * wT * mix(0.3, 1.0, onCap(sf.x * 1280.0, 300.0)), 160.0 * wT + 4.0);
  // (a bubble too small for those boils in turrets half their size)
  let wS = smoothstep(800.0, 350.0, sh.y);
  if (wS > 0.01) {
    let st = textureSampleLevel(tShape, sRep, (warpLand(wp) + u.shapeOff) * (vec3f(2.0, 2.7, 2.0) / SHAPE_TILE) + vec3f(0.43, 0.29, 0.71), 0.0).y;
    ds = octave(ds, (st * 2.0 - 1.0) * (320.0 / 1.35), 80.0 * A * wS * mix(0.25, 1.0, onCap(sf.y * 640.0, 160.0)), 80.0 * wS + 4.0);
  }
  // cauliflower everywhere, strongest on the upper parts of the sea and on everything heaped above
  // it: domes pushing the surface out (320 and 160 m cells), more on the lobes' caps and each
  // more on the tops of the one before
  let topW = mix(0.5, 1.0, saturate((h - min(C.x, C.w + 100.0) + 40.0) / 220.0)) * C.z * mix(0.75, 1.0, sh.z);
  ds = dome(ds, 64.0 * (1.0 - smoothstep(1.4, 2.8, lod)) * topW * mix(0.4, 1.0, onCap(sf.y * 640.0, 160.0)) * (s.z - 0.3), 96.0);
  ds = dome(ds, 30.0 * (1.0 - smoothstep(0.35, 1.0, lod)) * topW * onDome(s.z) * (s.w - 0.3), 45.0);
  // the finest domes (the detail volume: 128 to 32 m cells, and near the camera 32 to 8 m), only
  // near the surface (they move it by less than 50 m), drifting and rising with the air; a third
  // to half as high as they are wide, so the light shows them up close (flatter ones, the near sea
  // read as smooth dough)
  let wF = (1.0 - smoothstep(0.35, 0.8, lod)) * topW * onDome(s.w) * mix(mix(0.45, 1.0, onCap(sf.y * 640.0, 160.0)), 1.0, 1.0 - smoothstep(0.1, 0.35, lod)) * (1.0 - smoothstep(80.0, 140.0, ds));
  if (wF > 0.01) {
    let f1 = textureSampleLevel(tDetail, sRep, (wp + u.detailOff) * (1.0 / DETAIL_TILE), 0.0).b;
    ds = dome(ds, 60.0 * wF * (f1 - 0.3), 90.0);
    let wG = (1.0 - smoothstep(0.12, 0.3, lod)) * topW * onDome(f1) * (1.0 - smoothstep(60.0, 100.0, ds));
    if (wG > 0.01) {
      let f2 = textureSampleLevel(tDetail, sRep, (wp + u.detailOff) * (4.0 / DETAIL_TILE) + 0.37, 0.0).b;
      ds = dome(ds, 18.0 * wG * (f2 - 0.3), 27.0);
    }
  }
  return ds;
}
// the same, looking up the large shapes and column data of level l
fn sceneSDF(wp: vec3f, h: f32, l: i32, lod: f32) -> f32 {
  return cloudSDF(wp, h, shapeAt(vec3f(wp.x, h, wp.z), l), colAt(wp.xz, l), lod);
}

// Density (0..1) from the signed distance: real cumulus ends within metres, so the density ramps
// up over edgeW (a few metres, or about a pixel of the trace), at a surface the detail noise frays
// by up to ERODE m (detailW fades it out far away; finer near the camera, nearW). It is only the
// edge: the light doesn't see it, so anything deeper reads as blur, not form (the domes of
// cloudSDF carry the form). Inside a cloud near the camera: drifting variations of density, mist
// streaming past.
const ERODE = 6.0;
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
fn sunScatter(tau: f32, far: vec2f, ph: vec4f, pw: f32, depthIn: f32, nS: f32, nL: f32) -> f32 {
  // (mostly the large shape's side: light soaks from a lit bulge into the creases beside it, but
  // not around to a tower's far side, which the sky lights; deep inside it comes from all around)
  let facing = mix(saturate(0.1 + 0.55 * nL + 0.5 * nS), 0.5, smoothstep(30.0, 200.0, depthIn));
  let diffu = DIFFUSE * facing / (1.0 + 0.11 * (tau + far.x)) * (1.0 - 0.55 * exp(-depthIn * SIGMA / 1.5));
  return (msScatterP(tau + far.x, ph) * pw + diffu) * exp(-far.y);
}
// the sky's light on cloud (bAmb holds irradiance / π; a thick cloud returns most of it)
const AMB_K = 1.4;

// Optical depth toward the sun from a point (short march with growing steps, each sampled at its
// middle), and how much the surface faces the sun (-1..1), from the distance field: nS over the
// first ~60 m (light that wanders inside spreads over that much: finer creases would turn into dark
// pits), nL over ~400 m (the side of the bulge or tower it is on), and the distance 5 m toward the
// sun (the face of the smallest billows: its difference to the point's own). l, C, bs: clipmap
// level, column data and billows of the starting point. Returns (tau, nS, nL, that distance).
fn lightTauN(wp0: vec3f, h0: f32, l: i32, C: vec4f, bs: vec2f, lod0: f32) -> vec4f {
  var tau = 0.0;
  var s = 0.0;
  var ds = 10.0;
  var d0 = 0.0;
  var d1 = 0.0;
  var nS = 0.0;
  var nL = 0.0;
  for (var i = 0; i < 6; i++) {
    // (at the middle of each step, the same for every pixel: a jittered point flips between inside
    // and outside a bulge beside the path from pixel to pixel, a screen-door the history can't
    // calm in motion)
    let sm = s + ds * 0.5;
    let wp = wp0 + u.sunDir * sm;
    let h = h0 + u.sunDir.y * sm;
    // the first steps keep the detail of the view sample: bulges down to metres shade themselves
    let d = cloudSDF(wp, h, vec3f(macroAt(vec3f(wp.x, h, wp.z), l), bs), C, lod0 + f32(max(i - 2, 0)) * 0.6);
    if (i == 0) { d0 = d; }
    else if (i == 1) { d1 = d; }
    else if (i == 2) { nS = clamp((d - d0) / 57.8, -1.0, 1.0); }
    else if (i == 4) { nL = clamp((d - d1) / 374.0, -1.0, 1.0); }
    // near steps: point density; long far steps: smooth coverage estimate (no contour rings)
    // the density ramp widens with the step length so long steps don't switch abruptly (and is
    // sharp right at the start, so each bulge shades the one beside it)
    tau += saturate(-d / (mix(6.0, EDGE_W, saturate(s / 300.0)) + ds * 0.3)) * ds * SIGMA;
    s += ds;
    ds *= 2.4;
  }
  // then on through the cloud it is in, through the large shapes alone, in three long steps out to
  // LIGHT_REACH, until it comes out (a tower's far side shades its backlit face in metres, not in
  // the shadow volume's 768 m texels; the shadows of other clouds stay the shadow volume's)
  ds = 1200.0;
  for (var i = 0; i < 3; i++) {
    let sm = s + ds * 0.5;
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
  return vec4f(tau, nS, nL, d0);
}
fn lightTau(wp0: vec3f, h0: f32, l: i32, C: vec4f, bs: vec2f, lod0: f32) -> f32 {
  return lightTauN(wp0, h0, l, C, bs, lod0).x;
}
