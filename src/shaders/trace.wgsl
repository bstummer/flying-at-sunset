#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"
#include "chunks/cloud.wgsl"
#include "chunks/ambient.wgsl"

// The cloud raymarch, at low resolution: the clouds' light and transmittance, and their depth in km
// (shaders/trace.js)
override DBG = false;   // the debug views of ?dbg (render/setup.js)
// The air between the camera and a cloud: a low haze (scale height 2.4 km, ?haze) and the
// atmosphere's molecules and aerosols (chunks/atmo.wgsl), their optical depth along the ray in
// closed form (the planet's curvature in the height's slope). Blue fades several times faster than
// red: distant clouds turn warm. The veil they sink into has the colour of the horizon sky that way
// (golden toward the sun, blue away from it), as much of it as the air takes of their light.
const HAZE_H = 2400.0;
fn layerOD(t: f32, h0: f32, dy: f32, H: f32) -> f32 {
  let e0 = exp(-h0 / H);
  let k = (dy + t * INV2R) / H;
  if (abs(k) < 1e-7) { return e0 * t; }
  return e0 * (1.0 - exp(-k * t)) / k;
}
fn airT(t: f32, h0: f32, dy: f32) -> vec3f {
  return exp(-(u.hazeK * layerOD(t, h0, dy, HAZE_H) + RAY_S * 1e-3 * layerOD(t, h0, dy, RAY_H * 1000.0)
               + (MIE_S + MIE_A) * 1e-3 * layerOD(t, h0, dy, MIE_H * 1000.0)));
}

struct Out { @location(0) col: vec4f, @location(1) depth: f32 }
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

  // per-pixel low-discrepancy temporal sequences (R2) on top of a spatial IGN pattern
  let fr = mod1(u.frame, 1024.0);
  let jit = fract(ign(frag) + fr * 0.75487767);
  let jit2 = fract(ign(frag + vec2f(47.0, 17.0)) + fr * 0.56984029);
  // haze colour: the sky just above the horizon for downward rays (no seam at the horizon)
  let hazeDir = normalize(vec3f(dir.x, max(dir.y, 0.004), dir.z));
  let skyHaze = skyLookup(tSky, hazeDir, u.sunDir, h0 * 0.001);
  let ambUp = bAmb.up.rgb * AMB_K;
  // light bounced off the sunlit sea of clouds below (Lambertian deck, sun 5 degrees up)
  let seaBounce = u.ambSea * 0.38;
  let ambSunS = bAmb.sunSide.rgb * AMB_K + seaBounce * 0.4;
  // (a touch of violet: the anti-sun sky at dusk; on cloud sides it reads as cool, luminous shade)
  let ambAnti = bAmb.antiSun.rgb * AMB_K * vec3f(1.06, 0.93, 1.1) + seaBounce * 0.15;
  let cosT = dot(dir, u.sunDir);
  let phase = phaseOctaves(cosT);
  let powder = 1.0 - 0.28 * saturate(0.5 - 0.5 * cosT);

  var T = 1.0;
  var L = vec3f(0.0);
  var zSum = 0.0;
  var zW = 0.0;
  var t = (0.2 + jit * 0.8) * 4.0;
  var done = false;
  var tPrev = 0.0;      // last point outside the clouds
  var dPrev = -1.0;
  var tIn = 0.0;        // nearest point known to be inside, while refining an entry
  var dIn = 0.0;
  var nRef = 0;
  var side = 0;
  var startIn = false;
  var nIter = 0.0;
  var nIn = 0.0;
  var nSdf = 0.0;
  var lastTau = 0.0;
  var lastDepth = 0.0;
  var lastNS = 0.0;
  var lastNUp = 1.0;
  var lastOpen = 1.0;
  // (up and back toward the camera: the side of a visible surface that is open)
  let openDir = normalize(vec3f(0.0, 1.0, 0.0) - dir);
  for (var i = 0; i < 360; i++) {
    nIter += 1.0;
    if (t >= tEnd || T < 0.02) { done = true; break; }
    let rel = dir * t;
    let h = h0 + rel.y + dot(rel.xz, rel.xz) * INV2R;
    var wp = u.camPos + rel;
    wp.y = h;
    // stride floor grows with distance (far detail is softened by haze anyway), slowly enough
    // that distant towers are not stepped over
    let minStep = 6.0 + t * 0.02 + max(t - 8000.0, 0.0) * 0.006;
    let rj = fract(jit + f32(i) * 0.61803399);
    // empty space skipping: the distance to the large shapes, less the highest billows on them
    let lv = levelAt(wp.xz, t, jit);
    let C = colAt(wp.xz, lv);
    let dm = macroAt(vec3f(wp.x, h, wp.z), lv);
    let bound = dm - shellOf(C.y) - lvMargin(lv);
    if (bound > 0.0 && nRef == 0 && !startIn) { tPrev = t; dPrev = bound; t += max(bound * 0.95, minStep * (0.5 + rj)); continue; }
    let lod = t * (1.0 / 15000.0);
    nSdf += 1.0;
    let d = cloudSDF(wp, h, dm, C, lod);
    // the billowy tops of the sea and everything piled on it have crisp outlines, about a pixel of
    // the trace wide (no wider: it would alias); the deep troughs of the sea stay soft
    let pix = t * 2.0 * u.tanHalf.y / u.res.y;
    let crisp = smoothstep(-150.0, 250.0, h - C.w);
    let edgeW = mix(max(mix(14.0, EDGE_W, smoothstep(120.0, 4000.0, t)), 2.0 * pix), max(3.0, 1.25 * pix), crisp);
    let dtMin = 3.0 + t * 0.002;
    // Entering a cloud: locate the boundary within the last stride (Illinois regula falsi), then
    // start integrating a jittered fraction of a rim step past it. Starting anywhere within a far
    // stride (hundreds of metres deep) would light distant clouds as if from deep inside them.
    let tol = max(edgeW * 0.15, 1.0);
    if (nRef > 0) {
      if (d > 0.0) { tPrev = t; dPrev = d; if (side == 1) { dIn *= 0.5; } side = 1; }
      else { tIn = t; dIn = d; if (side == 2) { dPrev *= 0.5; } side = 2; }
      nRef--;
      t = tPrev + (tIn - tPrev) * dPrev / max(dPrev - dIn, 1e-3);
      if (nRef == 0 || tIn - tPrev < tol) { nRef = 0; dPrev = -1.0; startIn = true; t += 0.5 * jit2 * max(edgeW * 0.55, dtMin); }
      continue;
    }
    // approach the surface with a per-pixel/per-step jittered stride: avoids "wood grain" banding
    if (d > 0.0 && !startIn) { tPrev = t; dPrev = d; t += max(d * 0.75, minStep * (0.35 + rj)); continue; }
    if (dPrev > 0.0 && t - tPrev > tol) {
      tIn = t; dIn = d; nRef = 3; side = 0;
      t = tPrev + (t - tPrev) * dPrev / max(dPrev - d, 1e-3);
      continue;
    }
    startIn = false;
    dPrev = -1.0;
    // (the detail creases are the finest texture near the camera: deeper there)
    let detailW = (1.0 - smoothstep(6000.0, 16000.0, t)) * (1.0 + 1.2 * (1.0 - smoothstep(400.0, 3000.0, t)));
    let nearW = (1.0 - smoothstep(150.0, 900.0, t)) * max(u.inCloud, 1.0 - smoothstep(40.0, 120.0, -d));
    if (DBG && u.dbgMode > 0 && u.dbgMode < 4) {
      let e = 4.0 + t * 0.002;
      var nrm = vec3f(sceneSDF(wp + vec3f(e, 0.0, 0.0), h, lv, lod) - sceneSDF(wp - vec3f(e, 0.0, 0.0), h, lv, lod),
                      sceneSDF(wp + vec3f(0.0, e, 0.0), h + e, lv, lod) - sceneSDF(wp - vec3f(0.0, e, 0.0), h - e, lv, lod),
                      sceneSDF(wp + vec3f(0.0, 0.0, e), h, lv, lod) - sceneSDF(wp - vec3f(0.0, 0.0, e), h, lv, lod));
      nrm = normalize(nrm);
      var c: vec3f;
      if (u.dbgMode == 1) { c = vec3f(0.08) + vec3f(1.0, 0.85, 0.6) * max(dot(nrm, u.sunDir), 0.0) + vec3f(0.1, 0.15, 0.3) * (nrm.y * 0.5 + 0.5); }
      else if (u.dbgMode == 2) { c = vec3f(exp(-lightTau(wp, h, lv, C, jit2, lod + 0.5))); }
      else { let f = tsvTau(wp, h); c = vec3f(exp(-f.x - f.y)); }
      return Out(vec4f(c * 0.12, 0.0), t * 0.001);
    }
    var dens = densityFromSDF(d, wp, detailW, edgeW, nearW);
    // inside a cloud the air right around the camera is kept thin: drifting mist, not a white wall
    dens *= mix(1.0, mix(0.22, 1.0, smoothstep(12.0, 160.0, t)), u.inCloud);
    // stride: aim for a fixed optical depth per step (larger once little light gets through),
    // but stay fine inside the soft rim where most of the visible light is scattered
    let sigma = dens * SIGMA;
    var dt = clamp((0.45 + 1.6 * (1.0 - T)) / max(sigma, 0.004), dtMin, 8.0 + t * 0.016);
    dt = min(dt, max(edgeW * 0.55, -d * 0.6 + dtMin)) * (0.75 + 0.5 * jit2);
    if (dens > 0.003) {
      nIn += 1.0;
      // once little light gets through, deeper samples reuse the light of the previous one
      let reuse = T < 0.22 || (T < 0.65 && mod1(nIn, 2.0) > 0.5);
      var tau: f32;
      if (reuse) { tau = lastTau + max(-d - lastDepth, 0.0) * SIGMA * 2.0; }
      else {
        let tn = lightTauN(wp, h, lv, C, jit2, lod + 0.25);
        tau = tn.x;
        lastNS = tn.y;
        // which way the surface faces: up from one distance tap above, toward the sun from the
        // light march. Each bulge then catches its own sky light, even in shadow. And how open the
        // sky is over it: the distance to the cloud at a point up and back toward the camera,
        // short in the folds between bulges and under overhangs. (Only near the visible surface;
        // deeper samples keep the last estimate.)
        if (T > 0.45) {
          let S = 30.0 + t * 0.004;
          lastNUp = clamp((cloudSDF(wp + vec3f(0.0, S, 0.0), h + S, macroAt(vec3f(wp.x, h + S, wp.z), lv), C, lod) - d) / S, -1.0, 1.0);
          let qo = wp + openDir * (2.5 * S);
          let ho = h + openDir.y * 2.5 * S;
          lastOpen = smoothstep(0.0, 0.8, (cloudSDF(qo, ho, macroAt(vec3f(qo.x, ho, qo.z), lv), C, lod) - d) / (2.5 * S));
        }
      }
      lastTau = tau;
      lastDepth = -d;
      // past the light march: the rest of this cloud, and the clouds beyond (sunScatter)
      let far = tsvTau(wp, h);
      let depthIn = -d;
      let pw = mix(powder, 1.0, 1.0 - exp(-depthIn * SIGMA));
      let sc = sunColorAt(h);
      var sunL = sc * sunScatter(tau, far, phase, pw, depthIn, lastNS);
      if (DBG && u.dbgMode >= 5) {
        // (5: the octaves alone, 6: the diffusion alone, 7: no sun)
        let ms = msScatterP(tau + far.x, phase) * pw * exp(-far.y);
        sunL = sc * select(select(0.0, sunScatter(tau, far, phase, pw, depthIn, lastNS) - ms, u.dbgMode == 6), ms, u.dbgMode == 5);
      }
      let up = saturate((h - C.w + 250.0) / 1400.0);
      // sky light only reaches the first few tens of metres (short scale also hides the
      // discontinuous interior of the distance field)
      let ao = mix(0.5, 1.0, exp(-depthIn / 55.0)) * mix(0.4, 1.0, lastOpen);
      // sky light by orientation: the deep blue zenith on tops, the warm sunlit sea under bellies,
      // the golden sun-side or the cool violet anti-sun sky on the sides (a belly sees only part of
      // the sea below past the bulges around it)
      let eSide = mix(ambAnti, ambSunS, saturate(0.5 + 0.5 * lastNS));
      var eDir: vec3f;
      if (lastNUp > 0.0) { eDir = mix(eSide, ambUp, lastNUp); } else { eDir = mix(eSide, seaBounce, -0.5 * lastNUp); }
      var amb = eDir * mix(0.45, 1.0, up) * ao;
      if (DBG && (u.dbgMode == 5 || u.dbgMode == 6)) { amb *= 0.0; }
      let S = sigma * 0.985 * (sunL + amb);
      let st = exp(-sigma * dt);
      let Sint = (S - S * st) / sigma;
      let th = airT(t, h0, dir.y);
      L += T * (Sint * th + (1.0 - st) * skyHaze * (1.0 - luma(th)));
      let w = T * (1.0 - st);
      zSum += w * t;
      zW += w;
      T *= st;
    }
    t += dt;
  }
  if (done && T < 0.02) {
    // terminated inside an opaque cloud: treat the remainder as the same cloud
    L /= max(1.0 - T, 0.5);
    T = 0.0;
  }
  if (!done && T > 0.02) {
    // ran out of steps while grazing the far cloud sea: let it melt into the haze
    let th = airT(t, h0, dir.y);
    L += T * skyHaze * (1.0 - luma(th) * 0.35);
    zSum += T * t;
    zW += T;
    T = 0.0;
  }
  if (DBG && u.dbgMode == 4) { return Out(vec4f(vec3f(nIter / 200.0, nSdf / 100.0, nIn / 40.0) * 0.12, 0.0), 1.0); }
  return Out(vec4f(L, T), select(9000.0, (zSum / zW) * 0.001, zW > 1e-4));
}