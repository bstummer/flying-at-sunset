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

// where a point (render space) looks up the detail volume: turned in 3D (DETAIL_ROT, constants.js), so
// no surface cuts its 512 m tile along the lattice and repeats, and drifting with the air
fn detailAt(p: vec3f) -> vec3f { return DETAIL_ROT * p + u.detailOff; }

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
    let q = detailAt(wp);
    let f1 = textureSampleLevel(tDetail, sRep, q * (1.0 / DETAIL_TILE), 0.0).b;
    ds = dome(ds, 60.0 * wF * (f1 - 0.3), 90.0);
    let wG = (1.0 - smoothstep(0.12, 0.3, lod)) * topW * onDome(f1) * (1.0 - smoothstep(60.0, 100.0, ds));
    if (wG > 0.01) {
      let f2 = textureSampleLevel(tDetail, sRep, q * (4.0 / DETAIL_TILE) + 0.37, 0.0).b;
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
  // (the mist streams past at twice the drift: detailDrift once more)
  if (x < amp + edgeW) {
    let q = detailAt(wp);
    let dn = textureSampleLevel(tDetail, sRep, q * (1.0 / DETAIL_TILE), 0.0);
    var e = saturate((0.8 - dn.r) / 0.45);
    if (nearW > 0.01) {
      let dn2 = textureSampleLevel(tDetail, sRep, (q + u.detailDrift) * (4.0 / DETAIL_TILE) + dn.a * 0.35, 0.0);
      e = mix(e, e * 0.6 + saturate((0.8 - dn2.r) / 0.45) * 0.4, nearW);
    }
    return saturate((x - amp * e) / edgeW);
  }
  var dens = saturate(x / edgeW);
  if (nearW > 0.01) {
    let dn = textureSampleLevel(tDetail, sRep, (detailAt(wp) + u.detailDrift) * (2.0 / DETAIL_TILE), 0.0);
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

// Multiple scattering approximation (Wrenninge): sum of octaves with reduced extinction (each
// octave's share falls as fast as its extinction, a = b: no light that was never taken out). Their
// forward lobe keeps its strength from order to order and the back lobe fades: in a real cloud
// (g ≈ 0.85) the low orders still scatter forward, the glare off the sea toward the sun (fitted to
// a Monte Carlo of the medium, tools/light/)
fn phaseOctaves(c: f32) -> vec4f {
  return vec4f(mix(HG(c, -0.3), HG(c, 0.85), 0.95), mix(HG(c, -0.09), HG(c, 0.76), 0.62),
               mix(HG(c, -0.027), HG(c, 0.722), 0.62), mix(HG(c, -0.0081), HG(c, 0.686), 0.62));
}
fn msScatterP(tau: f32, ph: vec4f) -> f32 {
  let k = vec4f(1.0, 0.5, 0.25, 0.125);
  return dot(exp(-tau * k) * k, ph);
}
// The sun's light scattered at a point in a cloud, per unit of sunlight (fitted to a Monte Carlo of
// the medium, tools/light/): the low orders by octaves, and the high ones as diffusion: light that
// wandered in where the path toward the sun leaves the cloud, as much as gets in there (mu^1.4: at
// a grazing angle most of it scatters forward and out again), falling off as a thick cloud's diffuse
// transmission (two-stream, g ≈ 0.85) with the depth below that entry (own mu), and lower within a
// mean free path or two of the surface, where it leaks out. Where the light came in close by
// (lp.near), mu is the surface's own large-scale facing (lp.muN); farther in, where the path leaves
// (lp.muF: through a tower to its shade, its far, sunlit side; a few % of the lit side get through).
// Clouds toward the sun past this one (other) take the direct light and the low orders; the
// diffusion only the farther ones thin (otherD): light diffusing under the surface from the lit
// cloud around fills a small shadow, and the shadow volume's clouds beyond (far.y, 768 m texels:
// large shadows) take all of it. Neutral: droplets scatter every colour alike. lp: the path toward
// the sun (lightPath; past its reach, the shadow volume's far.x through this cloud); pw: the powder
// term; depthIn: depth below the surface (m).
const DIFFUSE = 0.42;
fn sunScatter(lp: LightPath, far: vec2f, ph: vec4f, pw: f32, depthIn: f32) -> f32 {
  let tau = lp.own + far.x;
  let mu = max(mix(lp.muF, lp.muN, lp.near), 1e-4);
  let diffu = DIFFUSE * pow(mu, 1.4) / (1.0 + 0.11 * (tau * mu + lp.otherD)) * (1.0 - 0.55 * exp(-depthIn * SIGMA / 1.5));
  return (msScatterP(tau + lp.other, ph) * pw + diffu) * exp(-far.y);
}
// the sky's light on cloud (bAmb holds irradiance / π; a thick cloud returns nearly all of it: as the
// sky gives it, now that diffusion lights the shade; more made the shade milky and the lit side flat)
const AMB_K = 1.0;

// The light's path toward the sun from a point (a short march with growing steps, each sampled at
// its middle), from the distance field: the optical depth through the cloud the point is in (own)
// and through the clouds it meets after leaving it (other: their shadow; otherD: as the diffusion
// sees them, those past ~100 m, their edges blurred with distance: light diffusing under a surface
// fills smaller shadows and softens the rest); whether the light came in close by (near: the path
// is out of its cloud within ~60 m); how squarely it came in there (muN: how much the surface faces
// the sun over 60 and 400 m, the scale diffusing light spreads over; the slope of each small dome
// turned creases into dark pits) and farther in (muF: the distance's slope along the path where it
// leaves its cloud; 0.5 if it doesn't within the march). Each of these is a smooth weight, never a
// choice: how surely the path is still in its own cloud (inside) falls from step to step as each
// step's length inside does, and every choice of a step cut the diffusion into flat blots. nS: how
// much the surface faces the sun over the first ~60 m (-1..1); d0: the distance 5 m toward the sun
// (the face of the smallest billows, against the point's own). dView: the point's own distance; l,
// C, bs: clipmap level, column data and billows of the start.
struct LightPath { own: f32, other: f32, otherD: f32, nS: f32, muN: f32, muF: f32, near: f32, d0: f32 }
fn lightPath(wp0: vec3f, h0: f32, dView: f32, l: i32, C: vec4f, bs: vec2f, lod0: f32) -> LightPath {
  var lp = LightPath(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  var s = 0.0;
  var ds = 10.0;
  var dPrev = dView;
  var sPrev = 0.0;
  var inside = 1.0;
  var wOut = 0.0;     // how surely the path has left its cloud, and the slopes where, by that weight
  var gOut = 0.0;
  var d1 = 0.0;
  var nL = 0.0;
  for (var i = 0; i < 6; i++) {
    // (at the middle of each step, the same for every pixel: a jittered point flips between inside
    // and outside a bulge beside the path from pixel to pixel, a screen-door the history can't
    // calm in motion)
    let sm = s + ds * 0.5;
    let wp = wp0 + u.sunDir * sm;
    let h = h0 + u.sunDir.y * sm;
    // the first steps keep the detail of the view sample: bulges down to metres shade themselves
    // (all with the start's column data and billows: each step's own cost the trace 10-13%)
    let d = cloudSDF(wp, h, vec3f(macroAt(vec3f(wp.x, h, wp.z), l), bs), C, lod0 + f32(max(i - 2, 0)) * 0.6);
    if (i == 0) { lp.d0 = d; }
    else if (i == 1) { d1 = d; }
    else if (i == 2) { lp.nS = clamp((d - lp.d0) / 57.8, -1.0, 1.0); }
    else if (i == 4) { nL = clamp((d - d1) / 374.0, -1.0, 1.0); }
    // the step's length inside: where the distance, running on at its slope from the sample before,
    // crosses zero (a grazed top is inside for a whole long step though its middle is metres deep;
    // the air just above it is outside), blurred over 3 m (cloud edges are not hard)
    let g = (d - dPrev) / (sm - sPrev);
    let f = saturate(0.5 - d / max(abs(g) * ds, 3.0));
    lp.own += f * inside * ds * SIGMA;
    lp.other += f * (1.0 - inside) * ds * SIGMA;
    lp.otherD += saturate(0.5 - d / max(abs(g) * ds, 0.15 * sm)) * (1.0 - inside) * ds * SIGMA * smoothstep(60.0, 300.0, sm);
    let w = max(inside - f, 0.0);
    wOut += w;
    gOut += w * saturate(g);
    inside = min(inside, f);
    if (i == 2) { lp.near = 1.0 - inside; }
    dPrev = d;
    sPrev = sm;
    s += ds;
    ds *= 2.4;
  }
  // then on, through the large shapes alone, in three long steps out to LIGHT_REACH, until it comes
  // out (a tower's far side shades its backlit face in metres, not in the shadow volume's 768 m
  // texels; the shadows of clouds beyond stay the shadow volume's)
  ds = 1200.0;
  for (var i = 0; i < 3; i++) {
    let sm = s + ds * 0.5;
    let p = vec3f(wp0.x, h0, wp0.z) + u.sunDir * sm;
    var lf = l;
    if (lf == 0 && !inLv(p.xz, 0)) { lf = 1; }
    if (lf == 1 && !inLv(p.xz, 1)) { lf = 2; }
    let d = macroAt(p, lf);
    let f = saturate((120.0 - d) / 380.0);
    lp.own += f * inside * ds * SIGMA;
    lp.other += f * (1.0 - inside) * ds * SIGMA;
    lp.otherD += f * (1.0 - inside) * ds * SIGMA;
    let w = max(inside - f, 0.0);
    wOut += w;
    gOut += w * saturate((d - dPrev) / (sm - sPrev));
    inside = min(inside, f);
    if (f < 0.05) { break; }
    dPrev = d;
    sPrev = sm;
    s += ds;
    ds *= 1.33;
  }
  lp.muN = saturate(0.5 * lp.nS + 0.5 * nL);
  lp.muF = (gOut + 0.01) / (wOut + 0.02);
  return lp;
}
// the optical depth toward the sun the march sees, through every cloud
fn lightTau(wp0: vec3f, h0: f32, dView: f32, l: i32, C: vec4f, bs: vec2f, lod0: f32) -> f32 {
  let lp = lightPath(wp0, h0, dView, l, C, bs, lod0);
  return lp.own + lp.other;
}
