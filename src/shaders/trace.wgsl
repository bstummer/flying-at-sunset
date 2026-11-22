#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"
#include "chunks/cloud.wgsl"
#include "chunks/ambient.wgsl"
#include "chunks/sealit.wgsl"

// The cloud raymarch, at low resolution: the clouds' light and transmittance, and their depth in km
// (shaders/trace.js)
override DBG = false;   // the debug views of ?dbg (render/setup.js)
// The air between the camera and a cloud: haze (scale height 6 km, ?haze: it reaches the towers'
// tops, so the farthest clouds are the haziest, as through the 100–200 km of visibility real air
// has up there) and the atmosphere's molecules and aerosols (chunks/atmo.wgsl), their optical
// depth along the ray in closed form (the planet's curvature in the height's slope). Blue fades
// several times faster than red: distant clouds turn warm. The veil they sink into has the colour
// of the horizon sky that way (golden toward the sun, blue away from it), as much of it as the air
// takes of their light.
const HAZE_H = 6000.0;
const CLOUD_SAT = 1.35;
// The light is taken as at a cloud's edge this thick (m), whatever the outline's ramp (a pixel wide):
// at a 5° sun the light fades within metres of a top, and lit as deep as that ramp is, the tops
// toward the sun lost half their glare (and their light changed with the trace's resolution)
const LIGHT_SKIN = 1.0;
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
  // (shade in the sky's blue: the deep zenith on tops, violet from the anti-sun sky at dusk on the
  // sides turned from the sun; the golden horizon toward the sun mostly lights faces turned to it,
  // which the sun outshines. Inside cloud the light has wandered in from everywhere: grey.)
  let cool = 1.0 - u.inCloud;
  let ambUp = bAmb.up.rgb * AMB_K * mix(vec3f(1.0), vec3f(0.88, 0.96, 1.2), cool);
  // (and from below, light bounced off the sea of clouds, by how much of it is in the sun: per sample)
  let skySunS = bAmb.sunSide.rgb * AMB_K;
  let skyAnti = bAmb.antiSun.rgb * AMB_K * mix(vec3f(1.0), vec3f(1.03, 0.92, 1.18), cool);
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
  var tEntry = 0.0;     // where the ray entered the cloud it is in
  var side = 0;
  var startIn = false;
  var nIter = 0.0;
  var nIn = 0.0;
  var nSdf = 0.0;
  var lastLp = LightPath(0.0, 0.0, 0.0, 0.0, 0.5, 0.5, 1.0, 0.0, 0.0, 0.0);
  var lastDepth = 0.0;
  var lastRel = 1.0;
  var lastNUp = 1.0;
  var lastOpen = 1.0;
  var lastOpenL = 1.0;
  var lastSea = seaBounce(SEA_LIT, u.ambSea, bAmb.up.rgb * AMB_K);
  var lastWalls = 0.0;
  var lastGraze = 1.0;
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
    // (s - d - d') / 2 deep, by the jitter (rims and silhouettes flicker), so there the floor is
    // 2d plus two outline widths: a crest it misses is grazed at most about an outline deep, where
    // the density is thin. (Two pixels everywhere cost the trace a third more.)
    let minStep = 6.0 + t * 0.02 + max(t - 8000.0, 0.0) * 0.006;
    let pix = t * 2.0 * u.tanHalf.y / u.res.y;
    // (the pixel the detail and the strides follow: never finer than a 270-row trace's, as at 960×540
    // with a half-size trace; following a finer trace, the domes reaching twice as far and the
    // strides twice as fine cost the trace +30% at 1920×1080)
    let pixC = max(pix, t * 0.00345);
    let rj = fract(jit + f32(i) * 0.61803399);
    // empty space skipping: the distance to the large shapes, less the highest billows on them
    let lv = levelAt(wp.xz, t, jit);
    let C = colAt(wp.xz, lv);
    let dm = macroAt(vec3f(wp.x, h, wp.z), lv);
    let bound = dm - shellOf(C.y) - lvMargin(lv);
    if (bound > 0.0 && nRef == 0 && !startIn) { tPrev = t; dPrev = bound; t += max(bound * 0.95, min(minStep, 2.0 * bound + 2.5 * pixC) * (0.5 + rj)); continue; }
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
    // start integrating a jittered fraction of a rim step past it. Starting anywhere within a far
    // stride (hundreds of metres deep) would light distant clouds as if from deep inside them.
    let tol = max(edgeW * 0.15, 1.0);
    if (nRef > 0) {
      if (d > 0.0) { tPrev = t; dPrev = d; if (side == 1) { dIn *= 0.5; } side = 1; }
      else { tIn = t; dIn = d; if (side == 2) { dPrev *= 0.5; } side = 2; }
      nRef--;
      t = tPrev + (tIn - tPrev) * dPrev / max(dPrev - dIn, 1e-3);
      if (nRef == 0 || tIn - tPrev < tol) { nRef = 0; dPrev = -1.0; startIn = true; tEntry = t; t += 0.5 * jit2 * max(edgeW * 0.55, dtMin); }
      continue;
    }
    // approach the surface with a per-pixel/per-step jittered stride: avoids "wood grain" banding
    if (d > 0.0 && !startIn) { tPrev = t; dPrev = d; t += max(d * 0.75, min(minStep, 2.0 * d + max(2.0 * edgeW, 2.5 * pixC)) * (0.35 + rj)); continue; }
    if (dPrev > 0.0 && t - tPrev > tol) {
      tIn = t; dIn = d; nRef = 3; side = 0;
      t = tPrev + (t - tPrev) * dPrev / max(dPrev - d, 1e-3);
      continue;
    }
    if (dPrev > 0.0) { tEntry = tPrev + (t - tPrev) * dPrev / max(dPrev - d, 1e-3); }
    startIn = false;
    dPrev = -1.0;
    let detailW = 1.0 - smoothstep(6000.0, 16000.0, t);
    let nearW = (1.0 - smoothstep(150.0, 900.0, t)) * u.inCloud;
    if (DBG && u.dbgMode > 0 && u.dbgMode < 4) {
      let e = 4.0 + t * 0.002;
      var nrm = vec3f(sceneSDF(wp + vec3f(e, 0.0, 0.0), h, lv, lod) - sceneSDF(wp - vec3f(e, 0.0, 0.0), h, lv, lod),
                      sceneSDF(wp + vec3f(0.0, e, 0.0), h + e, lv, lod) - sceneSDF(wp - vec3f(0.0, e, 0.0), h - e, lv, lod),
                      sceneSDF(wp + vec3f(0.0, 0.0, e), h, lv, lod) - sceneSDF(wp - vec3f(0.0, 0.0, e), h, lv, lod));
      nrm = normalize(nrm);
      var c: vec3f;
      if (u.dbgMode == 1) { c = vec3f(0.08) + vec3f(1.0, 0.85, 0.6) * max(dot(nrm, u.sunDir), 0.0) + vec3f(0.1, 0.15, 0.3) * (nrm.y * 0.5 + 0.5); }
      else if (u.dbgMode == 2) { c = vec3f(exp(-lightTau(wp, h, d, lv, C, bs, lod + 0.5))); }
      else { let f = tsvTau(wp, h); c = vec3f(exp(-f.x - mix(f.y, sunMapAt(wp.xz, h, 0.0), sunMapW(wp.xz)))); }
      return Out(vec4f(c * 0.12, 0.0), t * 0.001);
    }
    var dens = densityFromSDF(d, wp, detailW, edgeW, nearW);
    // inside a cloud the air right around the camera is kept thin: drifting mist, not a white wall
    dens *= mix(1.0, mix(0.22, 1.0, smoothstep(12.0, 160.0, t)), u.inCloud);
    // stride: aim for a fixed optical depth per step (larger once little light gets through),
    // but stay fine inside the soft rim where most of the visible light is scattered: steps growing
    // with the depth of full density (as fine in the medium's thin edge as in a uniform one, and no
    // finer: by its depth in metres, the thin edge took a third more steps, each lit afresh)
    let sigma = dens * SIGMA;
    var dt = clamp((0.45 + 1.6 * (1.0 - T)) / max(sigma, 0.004), dtMin, 8.0 + t * 0.016);
    let xd = -d;
    dt = min(dt, max(edgeW * 0.55, (0.6 * (profileDepth(xd) + min(xd, 0.0)) + dtMin) / profile(xd))) * (0.75 + 0.5 * jit2);
    if (dens > 0.003) {
      nIn += 1.0;
      // once little light gets through, deeper samples reuse the light of the previous one (the path
      // toward the sun longer by the extra depth over how squarely the light came in)
      let reuse = T < 0.22 || (T < 0.65 && mod1(nIn, 2.0) > 0.5);
      let depthIn = -d;
      let depthL = lightDepth(depthIn, edgeW);
      // the light, the sky's included, where the ray, as far in as the light's depth, would be
      let relL = dir * (tEntry + (t - tEntry) * depthL / max(depthIn, 1e-3));
      var wpL = u.camPos + relL;
      wpL.y = h0 + relL.y + dot(relL.xz, relL.xz) * INV2R;
      if (reuse) { lastLp.own += max(profileDepth(depthL) - profileDepth(lastDepth), 0.0) * SIGMA / max(mix(lastLp.muF, lastLp.muN, lastLp.near), 0.1); }
      else {
        // (at the view sample's own detail: rel below compares the two, and where the finest domes
        // fade with distance a coarser march would see a face on every dome's top)
        lastLp = lightPath(wpL, wpL.y, -depthL, lv, C, bs, lod);
        // the smallest billows' faces, over 5 m toward the sun, against the face around them: each
        // bulge bright where it turns to the sun, dimmer where it turns away (detail up close, as
        // in the far towers' lobes); the light inside spreads, so only the surface's first metres
        let rel = clamp(1.0 + 0.9 * (clamp((lastLp.d0 + depthL) / 5.0, -1.0, 1.0) - lastLp.nS), 0.3, 1.8);
        lastRel = mix(1.0, rel, (1.0 - smoothstep(1500.0, 6000.0, t)) * exp(-profileDepth(depthL) / 12.0));
        // which way the surface faces: up from one distance tap above, toward the sun from the
        // light march. Each bulge then catches its own sky light, even in shadow. And how open the
        // sky is over it: between the turrets and lobes and among the heaps, out along the large
        // shapes' normal (lastOpenL); between the domes, at a point out along it and back toward the
        // camera, the side of a visible surface that is open (lastOpen; up and back, it ran into every
        // belly seen from below). (Only near the visible surface; deeper samples keep the last
        // estimate.)
        if (T > 0.45) {
          let S = 22.0 + t * 0.005;
          lastNUp = clamp((cloudSDF(wpL + vec3f(0.0, S, 0.0), wpL.y + S, vec3f(macroAt(vec3f(wpL.x, wpL.y + S, wpL.z), lv), bs), C, lod) + depthL) / S, -1.0, 1.0);
          let oL = openLarge(wpL, lv);
          lastOpenL = oL.w;
          lastGraze = 0.92 + 0.6 * pow(1.0 - saturate(-dot(dir, oL.xyz)), 3.0);
          let qo = wpL + normalize(oL.xyz - dir) * (2.5 * S);
          lastOpen = smoothstep(0.0, 0.8, (cloudSDF(qo, qo.y, vec3f(macroAt(qo, lv), bs), C, lod) + depthL) / (2.5 * S));
          // (how much of the sea below and of the cloud around is in the sun)
          let lit = seaLitBelow(wpL.xz, wpL.y - C.x);
          lastSea = seaBounce(lit, u.ambSea, bAmb.up.rgb * AMB_K);
          lastWalls = (1.0 - lastOpenL) * lit;
        }
      }
      lastDepth = depthL;
      // past the light march: the rest of this cloud, and the clouds beyond (sunScatter)
      let far = tsvTau(wpL, wpL.y);
      let pw = mix(powder, 1.0, 1.0 - exp(-profileDepth(depthL) * SIGMA));
      let sc = sunColorAt(h);
      var sunL = sc * sunScatter(lastLp, far, phase, pw, depthL) * lastRel;
      if (DBG && u.dbgMode >= 5) {
        // (5: the octaves alone, 6: the diffusion alone, 7: no sun)
        let ms = msScatterP(lastLp.own + far.x + lastLp.other, phase) * pw * exp(-beyond(lastLp, far));
        sunL = sc * select(select(0.0, sunScatter(lastLp, far, phase, pw, depthL) - ms, u.dbgMode == 6), ms, u.dbgMode == 5);
      }
      // sky light only reaches the first few tens of metres (short scale also hides the
      // discontinuous interior of the distance field), and as much of it as the sky is open (a
      // crease between walls at 30, 45 and 60° sends 0.8, 0.7 and 0.6 of an open top's, where the
      // distance out of it is 0.87, 0.71 and 0.5 of the way, tools/light/reference.js; where the sky
      // is closed, the walls that close it send light of their own)
      let ao = mix(0.5, 1.0, exp(-profileDepth(depthL) / 55.0)) * mix(0.6, 1.0, lastOpen) * (0.35 + 0.65 * lastOpenL);
      // sky light by orientation: the deep blue zenith on tops, the sea below under bellies (warm
      // where it is sunlit, the sky's blue where it lies in shadow), the golden sun-side or the cool
      // violet anti-sun sky on the sides, and the sea's light on their lower half (more toward the
      // sun: its glare comes that way)
      let eSide = mix(skyAnti + lastSea * 0.15, skySunS + lastSea * 0.4, saturate(0.5 + 0.5 * lastLp.nS));
      var eDir: vec3f;
      if (lastNUp > 0.0) { eDir = mix(eSide, ambUp, lastNUp); } else { eDir = mix(eSide, lastSea, -lastNUp); }
      // and where the heaps around close the sky, the light of their sunlit flanks (a sunlit face sends
      // ~0.1 of the sunlight, half of what it sends a shaded point reaches it: tools/light/reference.js),
      // as much as the cloud around is lit, on faces turned from the sun (the flanks facing them are
      // the lit ones), at the surface only (deep in a cloud nothing closes a sky: inside a tower it lit
      // the mist)
      let walls = sc * (0.05 * lastWalls * saturate(0.5 - 0.5 * lastLp.nS) * exp(-profileDepth(depthL) / 55.0));
      // (seen at a grazing angle, a surface sends more of the sky's light: from the bright horizon it
      // comes in grazing and leaves grazing; a flat top seen 10° down 1.6-2 times what it sends up, by
      // the reference, less on billows, whose faces tilt toward such a view)
      var amb = eDir * ao * lastGraze + walls;
      if (DBG && (u.dbgMode == 5 || u.dbgMode == 6)) { amb *= 0.0; }
      // (the cloud's light with a colour film's saturation: golden-hour orange on the lit faces, the
      // sky's blue in the shade; the air's veil keeps the sky's own colour)
      let Lc = sunL + amb;
      let S = sigma * 0.985 * max(mix(vec3f(luma(Lc)), Lc, mix(1.0, CLOUD_SAT, cool)), vec3f(0.0));
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