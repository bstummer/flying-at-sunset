#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"
#include "chunks/cloud.wgsl"
#include "chunks/ambient.wgsl"
#include "chunks/sealit.wgsl"

// The cloud raymarch, at low resolution: the clouds' light and transmittance, their depth in km and
// how much light gets through the camera's own cloud (shaders/trace.js)
override DBG = false;   // the debug views of ?dbg (render/setup.js)
// The air between the camera and a cloud: airT (chunks/atmo.wgsl), the clouds sinking into the
// horizon sky's colour as much as it takes of their light.
const CLOUD_SAT = 1.35;
// The light is taken as at a cloud's edge this thick (m), whatever the outline's ramp (a pixel wide):
// at a low sun the light fades within metres of a top, and lit as deep as that ramp is, the tops
// toward the sun lost half their glare (and their light changed with the trace's resolution)
const LIGHT_SKIN = 1.0;
// Which samples in a cloud are lit (a light march each), and at which of those the sky's taps are
// taken again: by how much gets through to the sample, a weight rising smoothly over these ranges
// (a cloud's first lit sample always). The ranges lie between what gets through to a cloud face's
// samples (about 1, 0.7, 0.25, 0.04): where a sample often fell inside one, its weight, and the
// light with it, went with the ray's every hair (specks flickering at rest in a tower's shade).
const LIT_T = vec2f(0.05, 0.12);
const SKY_T = vec2f(0.32, 0.55);
// the depth in a skin LIGHT_SKIN thick that the view has seen as much cloud by as at depth z in the
// outline's ramp E wide, both times the medium's profile (the light at it is then weighted as a
// crisp edge's, whatever the ramp): as much cloud as the depth of full density q
fn lightDepth(z: f32, E: f32) -> f32 {
  let W = LIGHT_SKIN;
  let q = select(profileDepth(z) - profileDepth(E) + profileMoment(E) / E, profileMoment(z) / E, z < E);
  let qW = profileMoment(W) / W;
  if (q < qW) { return min(sqrt(2.0 * W * q / CLOUD_EDGE0), W); }
  return profileInv(q + profileDepth(W) - qW);
}
// ∫ x ρ(x) dx from the surface to depth z (ρ: the profile), and the depth with as much cloud above
// it as the depth of full density q (profileDepth's inverse)
fn profileMoment(z: f32) -> f32 {
  let w = CLOUD_EDGE_W;
  let k = (1.0 - CLOUD_EDGE0) / w;
  let a = min(z, w);
  return CLOUD_EDGE0 * a * a * 0.5 + k * a * a * a / 3.0 + (z * z - a * a) * 0.5;
}
fn profileInv(q: f32) -> f32 {
  let w = CLOUD_EDGE_W;
  let k = (1.0 - CLOUD_EDGE0) / w;
  if (q > w * (1.0 + CLOUD_EDGE0) * 0.5) { return q + w * (1.0 - CLOUD_EDGE0) * 0.5; }
  return 2.0 * q / (CLOUD_EDGE0 + sqrt(CLOUD_EDGE0 * CLOUD_EDGE0 + 2.0 * k * q));
}

// How open the sky is over the large shapes (the heaps, the swells and valleys of the sea, the
// towers and their largest lobes) at p, at 250 and 750 m (the scales of the heaps and the valleys
// between them, wherever the camera is: tied to the pixel, at 9 km they took in a whole tower): how
// much farther from them a point that far out along their normal lies, over that (1 over an open
// face, cos a in a crease between walls at a), the two scales' mean. Their normal from a tetrahedron
// of taps 64 m apart (at a crease it bisects the opening, where a one-sided difference turns into
// one of its walls). Measured on the large shapes alone: the billows' flanks tilt from them, and
// against the billowed surface every flank read as a crease.
// (xyz: their normal, w: the openness)
fn openLarge(p: vec3f, l: i32) -> vec4f {
  let e = 64.0;
  let s = 250.0;
  let k = vec2f(1.0, -1.0);
  let a = macroAt(p + k.xyy * e, l);
  let b = macroAt(p + k.yyx * e, l);
  let c = macroAt(p + k.yxy * e, l);
  let d = macroAt(p + k.xxx * e, l);
  let n = normalize(k.xyy * a + k.yyx * b + k.yxy * c + k.xxx * d + vec3f(0.0, 1e-3, 0.0));
  let m = macroAt(p, l);
  return vec4f(n, 0.5 * (saturate((macroAt(p + n * s, l) - m) / s) + saturate((macroAt(p + n * (3.0 * s), l) - m) / (3.0 * s))));
}

// (depth: the clouds' depth in km, and how much light gets through the camera's own cloud)
struct Out { @location(0) col: vec4f, @location(1) depth: vec2f }

// The camera's own cloud, where a ray starts in cloud: marched in a loop of its own, before the
// clouds past it (carried through the main loop, its state and branches cost every ray 16-17%), from
// the camera in steps of OWN_TAU optical depths (shorter in the thin ramp at the surface), the same
// for every pixel (in a cloud entered from outside, steps of up to 2 optical depths, each jittered,
// are averaged by the history at rest; through the camera's cloud they set how much of all behind
// it shows, and in flight that was grain over everything), each step's part past a surface taken
// back, until the ray is clear of cloud.
const OWN_TAU = 0.12;
const OWN_CLEAR = 12.0;   // m
// How much of a cloud's edge at depth x (m) is there, at p: wisps of the detail volume's Worley noise
// (16–64 m and 4–16 m cells; its median 0.475, quartiles 0.39 and 0.56), cut by a threshold that
// leaves about 60% of the surface holes, 20% 20 m in, none CLOUD_EDGE_W in
fn fray(p: vec3f, x: f32) -> f32 {
  let k = 1.0 - saturate(x / CLOUD_EDGE_W);
  if (k <= 0.0) { return 1.0; }
  let q = detailAt(p);
  let n = 0.7 * textureSampleLevel(tDetail, sRep, q * (2.0 / DETAIL_TILE) + 0.21, 0.0).r + 0.3 * textureSampleLevel(tDetail, sRep, q * (8.0 / DETAIL_TILE) + 0.63, 0.0).r;
  let thr = mix(0.2, 0.5, k);
  return smoothstep(thr - 0.06, thr + 0.06, n);
}
// a step of optical depth tau from a point at distance d0 < 0 (inside) to one at d1 > 0 (outside):
// (the share of its light to take back, the transmittance to give back) for its part past the
// surface, where the distance crosses zero between its ends
fn exitCut(tau: f32, d0: f32, d1: f32) -> vec2f {
  let f = saturate(-d0 / max(d1 - d0, 1e-3));
  return vec2f((1.0 - exp(-tau * f)) / max(1.0 - exp(-tau), 1e-6) - 1.0, exp(tau * (1.0 - f)));
}
@fragment fn fs(@builtin(position) pos: vec4f) -> Out {
  let frag = pos.xy;
  let ndc = (frag + u.jitter) / u.res * 2.0 - 1.0;
  let dir = normalize(u.camFwd + ndc.x * u.tanHalf.x * u.camRight + ndc.y * u.tanHalf.y * u.camUp);
  let h0 = u.camPos.y;

  // extent of the cloud shell along the ray (curved planet, parabolic approximation)
  var tEnd = 250000.0;
  {
    // h(t) = h0 + dy t + t^2 INV2R ; solve h(t) = CLOUD_TOP
    let a = INV2R;
    let b = dir.y;
    let c0 = h0 - CLOUD_TOP;
    let D = b * b - 4.0 * a * c0;
    if (D > 0.0) { tEnd = min(tEnd, (-b + sqrt(D)) / (2.0 * a)); }
    let c1 = h0 - SEA_BASE;
    let D1 = b * b - 4.0 * a * c1;
    if (b < 0.0 && D1 > 0.0) { tEnd = min(tEnd, (-b - sqrt(D1)) / (2.0 * a)); }
  }

  // a per-pixel low-discrepancy temporal sequence (R2) on top of a spatial IGN pattern, for the dither
  // between the clipmap levels (levelAt) alone. The march has no jitter: the same ray gives the same
  // light, and a ray beside it nearly the same. (Its start, its strides, its first sample in a cloud
  // and its steps there jittered per pixel and frame: grain the history averages at rest and can't
  // where near clouds move past, at their edges most of all.)
  let jit = fract(ign(frag) + mod1(u.frame, 1024.0) * 0.75487767);
  // haze colour: the sky just above the horizon for downward rays (no seam at the horizon)
  let hazeDir = normalize(vec3f(dir.x, max(dir.y, 0.004), dir.z));
  let skyHaze = skyLookup(tSky, hazeDir, u.sunDir, h0 * 0.001);
  // (shade in the sky's blue: the deep zenith on tops, violet from the anti-sun sky at dusk on the
  // sides turned from the sun; the golden horizon toward the sun mostly lights faces turned to it,
  // which the sun outshines. Inside the camera's own cloud the light has wandered in from
  // everywhere: grey.)
  let ambUp0 = bAmb.up.rgb * AMB_K;
  let ambUp = ambUp0 * vec3f(0.88, 0.96, 1.2);
  // (and from below, light bounced off the sea of clouds, by how much of it is in the sun: per sample)
  let skySunS = bAmb.sunSide.rgb * AMB_K;
  let skyAnti0 = bAmb.antiSun.rgb * AMB_K;
  let skyAnti = skyAnti0 * vec3f(1.03, 0.92, 1.18);
  let cosT = dot(dir, u.sunDir);
  let phase = phaseOctaves(cosT);
  let powder = 1.0 - 0.28 * saturate(0.5 - 0.5 * cosT);

  var T = 1.0;
  var L = vec3f(0.0);
  var zSum = 0.0;
  var zW = 0.0;
  var t = 2.4;          // (the first sample, a few metres out)
  // the camera's own cloud: how much light gets through it (to the high layers' order and the
  // history's fog, shaders/taau.wgsl), its depth (km) where nothing shows through
  var tOwn = 1.0;
  var zOwn = 0.0;
  var dOut = -1.0;    // the distance where it comes out of it, the main loop's last point outside
  var own = false;
  var dCam = 1.0;     // the distance at the camera
  {
    let lv0 = levelAt(u.camPos.xz, 0.0, jit);
    let C0 = colAt(u.camPos.xz, lv0);
    let dm0 = macroAt(u.camPos, lv0);
    if (dm0 - shellOf(C0.y) - lvMargin(lv0) <= 0.0) { dCam = cloudSDF(u.camPos, h0, vec3f(dm0, billowAt(u.camPos, lv0)), C0, 0.0); own = dCam < 0.0; }
  }
  if (own) {
    t = 0.0;
    var lp = LightPath(0.0, 0.0, 0.0, 0.0, 0.5, 0.5, 1.0, 0.0, 0.0, 0.0);
    var nUp = 1.0;
    var openL = 1.0;
    var graze = 1.0;
    var sea = seaBounce(SEA_LIT, u.ambSea, ambUp0);
    // (near its surface the camera's fog is lit as the main loop lights the cloud from outside, with
    // the shade's tints, the film's saturation and a grazing view's sky light: a step out of the
    // surface or into it changes nothing, where grey fog against the shaded surface was a jump.
    // Deeper in, grey: the light has wandered in from everywhere.)
    let wSurf = 1.0 - smoothstep(0.0, 30.0, -dCam);
    let ambUpO = ambUp0 * mix(vec3f(1.0), vec3f(0.88, 0.96, 1.2), wSurf);
    let skyAntiO = skyAnti0 * mix(vec3f(1.0), vec3f(1.03, 0.92, 1.18), wSurf);
    let satO = mix(1.0, CLOUD_SAT, wSurf);
    var tauLit = 1e9;    // the optical depth since the light was last made afresh
    var out = false;     // the ray has come out once
    var gap = 0.0;       // how far clear of cloud the air it is in reaches; where it went back in, and
    var tA = 0.0;        // the last point in the air before
    var dA = -1.0;
    var tE = 0.0;
    var wS = 0.0;        // how much the cloud it went back into is lit as a surface seen from outside
    var dLast = dCam;    // the distance at the last sample in cloud, and where (how fast a ray goes in)
    var tLast = 0.0;
    var sTau = 0.0;      // the last step: its optical depth, the light it added, the distance at its start
    var sL = vec3f(0.0);
    var sD = 0.0;
    var zs = 0.0;
    var zw = 0.0;
    for (var k = 0; k < 240; k++) {
      if (T < 0.02) { break; }
      let rel = dir * t;
      let h = h0 + rel.y + dot(rel.xz, rel.xz) * INV2R;
      var wp = u.camPos + rel;
      wp.y = h;
      let pix = t * 2.0 * u.tanHalf.y / u.res.y;
      let lod = max(pix, t * 0.00345) * (1.0 / 52.0);
      let lv = levelAt(wp.xz, t, jit);
      let C = colAt(wp.xz, lv);
      let bs = billowAt(wp, lv);
      let d = cloudSDF(wp, h, vec3f(macroAt(wp, lv), bs), C, lod);
      if (d > 0.0) {
        // out in the air: the last step's part past the surface taken back, and on, by the distance,
        // until clear of every cloud by OWN_CLEAR. A ray skimming a top from just under it dips in and
        // out: all of it the camera's fog (handed to the main loop at the first air, it met the top
        // again as a surface seen from outside, crisp and lit, or didn't, by the smallest bumps of the
        // stored shapes: blocks of veil and surface with stair-stepped edges)
        if (sTau > 0.0) { let c = exitCut(sTau, sD, d); T *= c.y; L += sL * c.x; sTau = 0.0; }
        if (d > OWN_CLEAR) { own = false; dOut = d; break; }
        out = true;
        gap = max(gap, d);
        tA = t;
        dA = d;
        t += max(d * 0.9, 1.0 + t * 0.01);
        continue;
      }
      // frayed in its first metres, where dry air mixes in (the medium's thin edge): shreds and holes
      // that let the lit tops and the sky through; deeper in, variations of density, mist streaming
      // past as the bird flies
      let crisp = smoothstep(-150.0, 250.0, h - C.w);
      let edgeW = mix(max(4.0, 2.0 * pix), max(2.0, 1.25 * pix), crisp);
      // (back in after the air: lit as a surface seen from outside, at the main loop's skin, as far as
      // the ray got clear of cloud in the gap: from a hair's breadth back into the same top, none of
      // it; from across open air, all of it, as the main loop lights it past OWN_CLEAR)
      if (dA > 0.0) {
        tE = tA + (t - tA) * dA / max(dA - d, 1e-3);
        wS = smoothstep(0.0, OWN_CLEAR, gap);
        gap = 0.0;
        dA = -1.0;
        tauLit = 1e9;
      }
      // (frayed until the ray first comes out: a cloud it dips back into within OWN_CLEAR is the medium
      // the main loop draws past there, so no seam shows between them)
      let dens = densityFromSDF(d, wp, 1.0, edgeW, 1.0 - smoothstep(150.0, 900.0, t)) * select(fray(wp, -d), 1.0, out);
      let sigma = dens * SIGMA;
      // (in the erosion's ramp, where the density rises over edgeW, steps of 0.4 of it where the ray
      // goes into or out of the cloud as fast as it goes on, up to 0.8 where it runs along the surface:
      // the fog is thin there, and the same long steps for every pixel stepped over its rises or onto
      // them, a lattice of straight-edged bands across the camera's fog. 0.4 of it everywhere cost the
      // trace a third more in cloud; uncapped along the surface, the lattice stayed)
      let rate = clamp(abs(d - dLast) / max(t - tLast, 0.25), 0.5, 1.0);
      dLast = d;
      tLast = t;
      let dt = clamp(OWN_TAU / max(sigma, 1e-4), 0.5, select(6.0 + t * 0.02, 0.4 * edgeW / rate + 0.02 * t, -d < ERODE + edgeW));
      if (dens > 0.003) {
        // (light made afresh once every 0.4 optical depths, at the sample itself, seen from inside: no
        // outline's ramp to map onto a skin)
        var depth = -d;
        var wpL = wp;
        if (wS > 0.0) {
          depth = mix(-d, lightDepth(-d, edgeW), wS);
          let relL = dir * (tE + (t - tE) * depth / max(-d, 1e-3));
          wpL = u.camPos + relL;
          wpL.y = h0 + relL.y + dot(relL.xz, relL.xz) * INV2R;
        }
        if (tauLit >= 0.4) {
          tauLit = 0.0;
          lp = lightPath(wpL, wpL.y, -depth, lv, C, bs, lod);
          let S = 22.0 + t * 0.005;
          let up = wpL + vec3f(0.0, S, 0.0);
          nUp = clamp((cloudSDF(up, up.y, vec3f(macroAt(up, lv), bs), C, lod) + depth) / S, -1.0, 1.0);
          sea = seaBounce(seaLitBelow(wpL.xz, wpL.y - C.x), u.ambSea, ambUp0);
          let oL = openLarge(wpL, lv);
          openL = oL.w;
          graze = mix(1.0, 0.92 + 0.6 * pow(1.0 - saturate(-dot(dir, oL.xyz)), 3.0), wSurf);
        }
        let pw = mix(powder, 1.0, 1.0 - exp(-profileDepth(depth) * SIGMA));
        let sunL = sunColorAt(h) * sunScatter(lp, tsvTau(wpL, wpL.y), phase, pw, depth);
        // the sky's light as on a cloud's faces, as deep and as open to the sky as the main loop takes
        // it (deep in a tower, the sun's light diffusing in outweighs it)
        let eSide = mix(skyAntiO + sea * 0.15, skySunS + sea * 0.4, saturate(0.5 + 0.5 * lp.nS));
        let eDir = select(mix(eSide, sea, -nUp), mix(eSide, ambUpO, nUp), nUp > 0.0);
        let Lc = sunL + eDir * mix(0.5, 1.0, exp(-profileDepth(depth) / 55.0)) * (0.35 + 0.65 * openL) * graze;
        let Sc = sigma * 0.985 * max(mix(vec3f(luma(Lc)), Lc, satO), vec3f(0.0));
        let st = exp(-sigma * dt);
        let th = airT(t, h0, dir.y, u.hazeK);
        sL = T * ((Sc - Sc * st) / sigma * th + (1.0 - st) * skyHaze * (1.0 - luma(th)));
        sTau = sigma * dt;
        sD = d;
        L += sL;
        zs += T * (1.0 - st) * t;
        zw += T * (1.0 - st);
        T *= st;
        tauLit += sTau;
      } else { sTau = 0.0; }
      t += dt;
    }
    tOwn = select(T, 0.0, T < 0.02);
    zOwn = select(0.05, zs / zw * 0.001, zw > 1e-4);
  }
  var done = false;
  var tPrev = t;        // last point outside the clouds (after the camera's own cloud, where the ray came
  var dPrev = dOut;     // out: a cloud entered right after is found again and lit from its surface, not as
                        // if entered at the camera, its light points tens of metres off)
  var tIn = 0.0;        // nearest point known to be inside, while refining an entry
  var dIn = 0.0;
  var nRef = 0;
  var tEntry = 0.0;     // where the ray entered the cloud it is in
  var side = 0;
  var startIn = false;
  var nIter = 0.0;
  var nIn = 0.0;
  var nSdf = 0.0;
  // In cloud (below): the last sample (none: tS < 0): where, its depth and its eroded depth; the
  // last lit sample's light, and its density; the sky over the last samples whose taps were taken
  // (how far up the surface faces, how open it is times a grazing view's share, how much of the sea
  // below is in the sun, the walls' light). No more than these: every number the loop carries costs
  // each of its steps (the light march's ten, kept from sample to sample: a tenth of the trace and
  // more).
  var tS = -1.0;
  var xS = 0.0;
  var gS = 0.0;
  var Sp = vec4f(0.0);
  var sky = vec4f(1.0, 1.0, SEA_LIT, 0.0);
  for (var i = 0; i < 360; i++) {
    nIter += 1.0;
    if (t >= tEnd || T < 0.02) { done = true; break; }
    let rel = dir * t;
    let h = h0 + rel.y + dot(rel.xz, rel.xz) * INV2R;
    var wp = u.camPos + rel;
    wp.y = h;
    // stride floor grows with distance (far detail is softened by haze anyway), slowly enough
    // that distant towers are not stepped over. Near a surface it is less: a step s past the
    // distance d (to d' after it) can hop over a crest the ray passes within it, up to
    // (s - d - d') / 2 deep, or not, by a hair (rims and silhouettes flicker), so there the floor is
    // 2d plus two outline widths: a crest it misses is grazed at most about an outline deep, where
    // the density is thin. (Two pixels everywhere cost the trace a third more.)
    let minStep = 6.0 + t * 0.02 + max(t - 8000.0, 0.0) * 0.006;
    let pix = t * 2.0 * u.tanHalf.y / u.res.y;
    // (the pixel the detail and the strides follow: never finer than a 270-row trace's, as at 960×540
    // with a half-size trace; following a finer trace, the domes reaching twice as far and the
    // strides twice as fine cost the trace +30% at 1920×1080)
    let pixC = max(pix, t * 0.00345);
    // (the strides' share of their floor: from step to step, the same for every pixel)
    let rj = fract(0.5 + f32(i) * 0.61803399);
    // empty space skipping: the distance to the large shapes, less the highest billows on them
    let lv = levelAt(wp.xz, t, jit);
    let C = colAt(wp.xz, lv);
    let dm = macroAt(vec3f(wp.x, h, wp.z), lv);
    let bound = dm - shellOf(C.y) - lvMargin(lv);
    if (bound > 0.0 && nRef == 0 && !startIn && tS < 0.0) { tPrev = t; dPrev = bound; t += max(bound * 0.95, min(minStep, 2.0 * bound + 2.5 * pixC) * (0.5 + rj)); continue; }
    // the detail the pixel resolves: its footprint over 52 m (t / 15000 at the 270-row trace), each
    // octave of billows fading as its cells shrink to a few pixels (cloudSDF)
    let lod = pixC * (1.0 / 52.0);
    nSdf += 1.0;
    let bs = billowAt(vec3f(wp.x, h, wp.z), lv);
    let d = cloudSDF(wp, h, vec3f(dm, bs), C, lod);
    // the billowy tops of the sea and everything piled on it have crisp outlines, about a pixel of
    // the trace wide (no wider: it would alias); the deep troughs of the sea are soft far away (near
    // the camera within metres too: any wider looks out of focus)
    let crisp = smoothstep(-150.0, 250.0, h - C.w);
    let edgeW = mix(max(mix(4.0, EDGE_W, smoothstep(300.0, 6000.0, t)), 2.0 * pix), max(2.0, 1.25 * pix), crisp);
    let dtMin = 3.0 + t * 0.002;
    // Entering a cloud: locate the boundary within the last stride (Illinois regula falsi), then
    // start integrating a quarter of a rim step past it. Starting anywhere within a far
    // stride (hundreds of metres deep) would light distant clouds as if from deep inside them.
    let tol = max(edgeW * 0.15, 1.0);
    if (nRef > 0) {
      if (d > 0.0) { tPrev = t; dPrev = d; if (side == 1) { dIn *= 0.5; } side = 1; }
      else { tIn = t; dIn = d; if (side == 2) { dPrev *= 0.5; } side = 2; }
      nRef--;
      t = tPrev + (tIn - tPrev) * dPrev / max(dPrev - dIn, 1e-3);
      if (nRef == 0 || tIn - tPrev < tol) { nRef = 0; dPrev = -1.0; startIn = true; tEntry = t; t += 0.25 * max(edgeW * 0.55, dtMin); }
      continue;
    }
    let air = d > 0.0 && !startIn;
    // approach the surface (each entry is located above: where the strides fall no longer shows as
    // "wood grain", which their jitter was for)
    if (air && tS < 0.0) { tPrev = t; dPrev = d; t += max(d * 0.75, min(minStep, 2.0 * d + max(2.0 * edgeW, 2.5 * pixC)) * (0.35 + rj)); continue; }
    var entered = startIn;
    if (!air && dPrev > 0.0) {
      if (t - tPrev > tol) {
        tIn = t; dIn = d; nRef = 3; side = 0;
        t = tPrev + (t - tPrev) * dPrev / max(dPrev - d, 1e-3);
        continue;
      }
      tEntry = tPrev + (t - tPrev) * dPrev / max(dPrev - d, 1e-3);
      entered = true;
    }
    startIn = false;
    let detailW = 1.0 - smoothstep(6000.0, 16000.0, t);
    // In cloud the ray is taken in stretches, from one sample to the next (the first from where it
    // came in, the last out into the air). A stretch's optical depth comes from the eroded depth at
    // its two ends, the outline's ramp taken exactly between them (rampMean; in the air, as eroded as
    // the sample before); its light is the lit samples' at its ends, each by its density, or the last
    // lit sample's. (A sample's density and light for the whole step after it: a near cloud's frayed
    // edge, where the density rises within metres and the steps are longer, came out as much cloud
    // as the step's start happened to see, speckled from ray to ray.)
    let x = -d;
    var g = x - (xS - gS);
    if (!air) {
      dPrev = -1.0;
      g = erodedDepth(x, wp, detailW, edgeW);
      if (entered || tS < 0.0) { tS = select(t, tEntry, entered); xS = select(x, 0.0, entered); gS = select(g, g - x, entered); Sp = vec4f(0.0); }
    }
    let st = exp(-SIGMA * rampMean(gS, g, edgeW) * profile(0.5 * (xS + x)) * (t - tS));
    let Tn = T * st;        // what gets through to this sample
    var dt = 0.0;
    var Sn = vec4f(0.0);    // this sample's light, and its density (none where it isn't lit)
    if (!air) {
      if (DBG && u.dbgMode > 0 && u.dbgMode < 4) {
        let e = 4.0 + t * 0.002;
        var nrm = vec3f(sceneSDF(wp + vec3f(e, 0.0, 0.0), h, lv, lod) - sceneSDF(wp - vec3f(e, 0.0, 0.0), h, lv, lod),
                        sceneSDF(wp + vec3f(0.0, e, 0.0), h + e, lv, lod) - sceneSDF(wp - vec3f(0.0, e, 0.0), h - e, lv, lod),
                        sceneSDF(wp + vec3f(0.0, 0.0, e), h, lv, lod) - sceneSDF(wp - vec3f(0.0, 0.0, e), h, lv, lod));
        nrm = normalize(nrm);
        var c: vec3f;
        if (u.dbgMode == 1) { c = vec3f(0.08) + vec3f(1.0, 0.85, 0.6) * max(dot(nrm, u.sunDir), 0.0) + vec3f(0.1, 0.15, 0.3) * (nrm.y * 0.5 + 0.5); }
        else if (u.dbgMode == 2) { c = vec3f(exp(-lightTau(wp, h, d, lv, C, bs, lod + 0.5))); }
        else {
          let f = tsvTau(wp, h);
          let wF = sunMapW(wp.xz);
          let wC = (1.0 - wF) * sunMapCW(wp.xz);
          c = vec3f(exp(-f.x - f.y * (1.0 - wF - wC) - sunMapAt(wp.xz, h, 0.0).x * wF - sunMapCAt(wp.xz, h, 0.0) * wC));
        }
        return Out(vec4f(c * 0.12, 0.0), vec2f(t * 0.001, tOwn));
      }
      let dens = saturate(g / edgeW) * profile(x);
      // stride: aim for a fixed optical depth per step (larger once little light gets through),
      // but stay fine inside the soft rim where most of the visible light is scattered: steps growing
      // with the depth of full density (as fine in the medium's thin edge as in a uniform one, and no
      // finer: by its depth in metres, the thin edge took a third more steps, each lit afresh), by
      // twice it: a cloud's face in three lit samples (by 0.6 of it, four: a tenth more of the trace)
      dt = clamp((0.45 + 1.6 * (1.0 - Tn)) / max(dens * SIGMA, 0.004), dtMin, 8.0 + t * 0.016);
      dt = min(dt, max(edgeW * 0.55, (2.0 * (profileDepth(x) + min(x, 0.0)) + dtMin) / profile(x)));
      // Which samples are lit: all until little gets through (LIT_T), each by a march of its own. (The
      // deeper ones with the light march of the last, its path toward the sun longer by the depth:
      // lit afresh on every other sample past a threshold, a sample more or less in a thin edge
      // changed which ones, specks; and that one march's surroundings stood for all the cloud
      // behind it, blotches on a near cloud's face that only the jitter had blurred.) A sample that
      // isn't lit adds its cloud to the stretches around it.
      let wl = select(smoothstep(LIT_T.x, LIT_T.y, Tn), 1.0, Sp.a <= 0.0);
      if (dens > 0.003 && wl > 0.0) {
        nIn += 1.0;
        let depthIn = max(x, 1e-3);
        let depthL = lightDepth(depthIn, edgeW);
        let pd = profileDepth(depthL);
        // the light, the sky's included, where the ray, as far in as the light's depth, would be
        let relL = dir * (tEntry + (t - tEntry) * depthL / depthIn);
        var wpL = u.camPos + relL;
        wpL.y = h0 + relL.y + dot(relL.xz, relL.xz) * INV2R;
        // (at the view sample's own detail: rel below compares the two, and where the finest domes
        // fade with distance a coarser march would see a face on every dome's top)
        let lp = lightPath(wpL, wpL.y, -depthL, lv, C, bs, lod);
        // the smallest billows' faces, over 5 m toward the sun, against the face around them: each
        // bulge bright where it turns to the sun, dimmer where it turns away (detail up close, as
        // in the far towers' lobes); the light inside spreads, so only the surface's first metres
        let rel = mix(1.0, clamp(1.0 + 0.9 * (clamp((lp.d0 + depthL) / 5.0, -1.0, 1.0) - lp.nS), 0.3, 1.8), (1.0 - smoothstep(1500.0, 6000.0, t)) * exp(-pd / 12.0));
        // which way the surface faces: up from one distance tap above, toward the sun from the
        // light march. Each bulge then catches its own sky light, even in shadow. And how open the
        // sky is over it: between the turrets and lobes and among the heaps, out along the large
        // shapes' normal (openLarge); between the domes, at a point out along it and back toward the
        // camera, the side of a visible surface that is open (up and back, it ran into every belly
        // seen from below). (Only near the visible surface, SKY_T; deeper samples keep the last
        // estimate. At a cloud's first lit sample always, as deep as it lies: where the frayed edge
        // left the sample before it empty, little got through to it, and the face kept the sky of the
        // loop's start, an open top's, or of the cloud before: spots of zenith blue on a flank in
        // shade, in the shape of the edge's noise.)
        let ws = select(smoothstep(SKY_T.x, SKY_T.y, Tn), 1.0, Sp.a <= 0.0);
        if (ws > 0.0) {
          let S = 22.0 + t * 0.005;
          let nUp = clamp((cloudSDF(wpL + vec3f(0.0, S, 0.0), wpL.y + S, vec3f(macroAt(vec3f(wpL.x, wpL.y + S, wpL.z), lv), bs), C, lod) + depthL) / S, -1.0, 1.0);
          let oL = openLarge(wpL, lv);
          let qo = wpL + normalize(oL.xyz - dir) * (2.5 * S);
          let open = smoothstep(0.0, 0.8, (cloudSDF(qo, qo.y, vec3f(macroAt(qo, lv), bs), C, lod) + depthL) / (2.5 * S));
          // (seen at a grazing angle, a surface sends more of the sky's light: from the bright horizon it
          // comes in grazing and leaves grazing; a flat top seen 10° down 1.6-2 times what it sends up, by
          // the reference, less on billows, whose faces tilt toward such a view)
          let graze = 0.92 + 0.6 * pow(1.0 - saturate(-dot(dir, oL.xyz)), 3.0);
          // (how much of the sea below and of the cloud around is in the sun)
          let lit = seaLitBelow(wpL.xz, wpL.y - C.x);
          sky = mix(sky, vec4f(nUp, mix(0.6, 1.0, open) * (0.35 + 0.65 * oL.w) * graze, lit, (1.0 - oL.w) * lit), ws);
        }
        // past the light march: the rest of this cloud, and the clouds beyond (sunScatter)
        let far = tsvTau(wpL, wpL.y);
        let pw = mix(powder, 1.0, 1.0 - exp(-pd * SIGMA));
        let sc = sunColorAt(h);
        var sunL = sc * sunScatter(lp, far, phase, pw, depthL) * rel;
        if (DBG && u.dbgMode >= 5) {
          // (5: the octaves alone, 6: the diffusion alone, 7: no sun)
          let ms = msScatterP(lp.own + far.x + lp.other, phase) * pw * exp(-beyond(lp, far));
          sunL = sc * select(select(0.0, sunScatter(lp, far, phase, pw, depthL) - ms, u.dbgMode == 6), ms, u.dbgMode == 5);
        }
        // sky light only reaches the first few tens of metres (short scale also hides the
        // discontinuous interior of the distance field), and as much of it as the sky is open (a
        // crease between walls at 30, 45 and 60° sends 0.8, 0.7 and 0.6 of an open top's, where the
        // distance out of it is 0.87, 0.71 and 0.5 of the way, tools/light/reference.js; where the sky
        // is closed, the walls that close it send light of their own)
        let ao = mix(0.5, 1.0, exp(-pd / 55.0)) * sky.y;
        // sky light by orientation: the deep blue zenith on tops, the sea below under bellies (warm
        // where it is sunlit, the sky's blue where it lies in shadow), the golden sun-side or the cool
        // violet anti-sun sky on the sides, and the sea's light on their lower half (more toward the
        // sun: its glare comes that way)
        let sea = seaBounce(sky.z, u.ambSea, bAmb.up.rgb * AMB_K);
        let eSide = mix(skyAnti + sea * 0.15, skySunS + sea * 0.4, saturate(0.5 + 0.5 * lp.nS));
        var eDir: vec3f;
        if (sky.x > 0.0) { eDir = mix(eSide, ambUp, sky.x); } else { eDir = mix(eSide, sea, -sky.x); }
        // and where the heaps around close the sky, the light of their sunlit flanks (a sunlit face sends
        // ~0.1 of the sunlight, half of what it sends a shaded point reaches it: tools/light/reference.js),
        // as much as the cloud around is lit, on faces turned from the sun (the flanks facing them are
        // the lit ones), at the surface only (deep in a cloud nothing closes a sky: inside a tower it lit
        // the mist)
        let walls = sc * (0.05 * sky.w * saturate(0.5 - 0.5 * lp.nS) * exp(-pd / 55.0));
        var amb = eDir * ao + walls;
        if (DBG && (u.dbgMode == 5 || u.dbgMode == 6)) { amb *= 0.0; }
        // (the cloud's light with a colour film's saturation: golden-hour orange on the lit faces, the
        // sky's blue in the shade; the air's veil keeps the sky's own colour)
        let Lc = sunL + amb;
        Sn = vec4f(0.985 * max(mix(vec3f(luma(Lc)), Lc, CLOUD_SAT), vec3f(0.0)), dens * wl);
      }
    }
    if (Tn < T) {
      let tm = 0.5 * (tS + t);
      let th = airT(tm, h0, dir.y, u.hazeK);
      let w = T - Tn;
      L += w * ((Sp.rgb * Sp.a + Sn.rgb * Sn.a) / max(Sp.a + Sn.a, 1e-6) * th + skyHaze * (1.0 - luma(th)));
      zSum += w * tm;
      zW += w;
      T = Tn;
    }
    if (air) { tS = -1.0; tPrev = t; dPrev = d; t += max(d * 0.75, min(minStep, 2.0 * d + max(2.0 * edgeW, 2.5 * pixC)) * (0.35 + rj)); continue; }
    tS = t;
    xS = x;
    gS = g;
    if (Sn.a > 0.0) { Sp = Sn; }
    t += dt;
  }
  if (done && T < 0.02) {
    // terminated inside an opaque cloud: treat the remainder as the same cloud
    L /= max(1.0 - T, 0.5);
    T = 0.0;
  }
  if (!done && T > 0.02) {
    // ran out of steps while grazing the far cloud sea: let it melt into the haze
    let th = airT(t, h0, dir.y, u.hazeK);
    L += T * skyHaze * (1.0 - luma(th) * 0.35);
    zSum += T * t;
    zW += T;
    T = 0.0;
  }
  if (DBG && u.dbgMode == 4) { return Out(vec4f(vec3f(nIter / 200.0, nSdf / 100.0, nIn / 40.0) * 0.12, 0.0), vec2f(1.0, tOwn)); }
  // (the depth the history is reprojected by: of what shows through the camera's own cloud, else the
  // sky's; the fog's own only where nothing shows through it. The fog is smooth, what shows through
  // it is not: by the fog's tens of metres the far towers' silhouettes were reprojected as if near,
  // with dark fringes in flight)
  var z = select(9000.0, (zSum / zW) * 0.001, zW > 1e-4);
  if (zW <= 1e-4 && tOwn < 0.02) { z = zOwn; }
  return Out(vec4f(L, T), vec2f(z, tOwn));
}