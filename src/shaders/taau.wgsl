#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"

// Temporal upsampling of the clouds and the sky composite (shaders/taau.js)
fn sampleHist(uv: vec2f) -> vec4f {
  // Catmull-Rom with 9 taps (5 bilinear) for a sharp, stable history
  let p = uv * u.res;
  let tc = floor(p - 0.5) + 0.5;
  let f = p - tc;
  let w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  let w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  let w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  let w3 = f * f * (-0.5 + 0.5 * f);
  let w12 = w1 + w2;
  let tc0 = (tc - 1.0) / u.res;
  let tc3 = (tc + 2.0) / u.res;
  let tc12 = (tc + w2 / w12) / u.res;
  var r = vec4f(0.0);
  r += textureSampleLevel(tHist, sLin, vec2f(tc12.x, tc0.y), 0.0) * (w12.x * w0.y);
  r += textureSampleLevel(tHist, sLin, vec2f(tc0.x, tc12.y), 0.0) * (w0.x * w12.y);
  r += textureSampleLevel(tHist, sLin, vec2f(tc12.x, tc12.y), 0.0) * (w12.x * w12.y);
  r += textureSampleLevel(tHist, sLin, vec2f(tc3.x, tc12.y), 0.0) * (w3.x * w12.y);
  r += textureSampleLevel(tHist, sLin, vec2f(tc12.x, tc3.y), 0.0) * (w12.x * w3.y);
  let wsum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / wsum, vec4f(0.0));
}

fn skyColor(dir: vec3f) -> vec3f {
  let h = u.camPos.y * 0.001;
  var c = skyLookup(tSky, dir, u.sunDir, h);
  // high cirrus veil
  if (dir.y > 0.003) {
    let hc = CIRRUS_H - u.camPos.y;
    let t = hc / max(dir.y, 0.02);
    let p = (u.camPos.xz + dir.xz * t + u.cirrusOff) / CIRRUS_TILE;
    let cs = textureSampleLevel(tCirrus, sRep, p, 0.0);
    let a = cs.r * smoothstep(0.003, 0.08, dir.y);
    let cosT = dot(dir, u.sunDir);
    let ph = HG(cosT, 0.6);
    let cc = u.cirrusCol * (0.25 + 4.0 * ph) * (0.75 + 0.5 * cs.g);
    let fade = exp(-t / 60000.0);
    c = mix(c, cc + c * 0.6, a * 0.32 * fade);
  }
  // sun disk with limb darkening
  let cosA = dot(dir, u.sunDir);
  let ang = acos(clamp(cosA, -1.0, 1.0));
  const SUN_R = 0.0052;
  if (ang < SUN_R * 1.6) {
    let x = saturate(ang / SUN_R);
    let mu = sqrt(max(0.0, 1.0 - x * x));
    let limb = 1.0 - 0.6 * (1.0 - mu) - 0.15 * (1.0 - mu) * (1.0 - mu);
    let edge = 1.0 - smoothstep(SUN_R * 0.92, SUN_R * 1.08, ang);
    c += u.sunDisk * limb * edge;
  }
  return c;
}

// --- thin high layers, drawn as sheets at fixed heights (they are thin next to the distances they
// are seen from) and sorted against the clouds by depth
const LAYER_INV2R = 0.5 / (RG * 1000.0);
// distance along dir to height H over the curved planet (parabolic approximation), -1 if none
fn distToHeight(h0: f32, dy: f32, H: f32) -> f32 {
  let c = h0 - H;
  let D = dy * dy - 4.0 * LAYER_INV2R * c;
  if (D < 0.0) { return -1.0; }
  let q = -0.5 * (dy + select(-1.0, 1.0, dy >= 0.0) * sqrt(D));
  if (abs(q) < 1e-9) { return -1.0; }
  let r1 = q / LAYER_INV2R;
  let r2 = c / q;
  let tn = min(r1, r2);
  let tf = max(r1, r2);
  return select(select(-1.0, tf, tf > 0.0), tn, tn > 0.0);
}
// premultiplied colour + alpha of high layer k at distance tL along dir
fn highLayer(k: i32, dir: vec3f, tL: f32, behind: vec3f) -> vec4f {
  let H = select(LAYER_H1, LAYER_H0, k == 0);
  let p = (u.camPos.xz + dir.xz * tL + u.layerOff) / LAYER_TILE;
  let slope = abs(dir.y + 2.0 * tL * LAYER_INV2R);        // ray slope at the layer
  let foot = tL * 2.0 * u.tanHalf.y / u.res.y / max(slope, 0.03);
  let tx = textureSampleLevel(tLayers, sMip, p, log2(max(foot / 62.5, 1.0)));
  let dens = select(tx.g, tx.r, k == 0);
  if (dens < 0.003) { return vec4f(0.0); }
  let tau = min(dens * 0.32 / max(slope, 0.12), 3.0);
  // fade where the sheet is seen edge-on (no razor lines at the horizon) and into the far haze
  let a = (1.0 - exp(-tau)) * exp(-tL / 75000.0) * smoothstep(0.02, 0.1, slope) * smoothstep(60.0, 450.0, abs(u.camPos.y - H));
  // thin and translucent: forward scattering makes them glow toward the sun, golden all over
  let cosT = dot(dir, u.sunDir);
  let ph = HG(cosT, 0.7);
  let c = u.layerCol[k] * (0.22 + 3.2 * ph) * (0.7 + 0.5 * tx.b) + behind * 0.45;
  return vec4f(c * a, a);
}

struct Out { @location(0) hist: vec4f, @location(1) scene: vec4f, @location(2) fog: f32 }
@fragment fn fs(@builtin(position) pos: vec4f) -> Out {
  let uv = pos.xy / u.res;
  let ndc = uv * 2.0 - 1.0;
  let dir = normalize(u.camFwd + ndc.x * u.tanHalf.x * u.camRight + ndc.y * u.tanHalf.y * u.camUp);

  // current low-res estimate (low-res sample i sits at (i + 0.5 + jitter))
  let lp = uv * u.lowRes - 0.5 - u.jitter;
  let lpr = floor(lp + 0.5);
  var cuv = (lp + 0.5) / u.lowTex;
  cuv = clamp(cuv, 0.5 / u.lowTex, (u.lowRes - 0.5) / u.lowTex);
  let cur = textureSampleLevel(tCur, sLin, cuv, 0.0);
  // neighbourhood statistics: 3x3 bilinear taps centred on this pixel's exact position, so the
  // clamp box varies smoothly between output pixels (no blocky grid from the low-res lattice)
  var m1 = vec4f(0.0);
  var m2 = vec4f(0.0);
  let lo2 = 0.5 / u.lowTex;
  let hi2 = (u.lowRes - 0.5) / u.lowTex;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let s = textureSampleLevel(tCur, sLin, clamp(cuv + vec2f(f32(x), f32(y)) / u.lowTex, lo2, hi2), 0.0);
      m1 += s;
      m2 += s * s;
    }
  }
  m1 /= 9.0;
  m2 /= 9.0;
  let sd = sqrt(max(m2 - m1 * m1, vec4f(0.0)));
  // (the clouds' depth, km, to reproject the history by; and how much light gets through the camera's
  // own cloud, here and its range around: whatever the depth, that fog lies in front of the high layers)
  let ip = clamp(vec2i(lpr), vec2i(0), vec2i(u.lowRes) - 1);
  let cdep = textureLoad(tCurDepth, ip, 0).rg;
  var dkm = cdep.x;
  var fogLo = cdep.y;
  var fogHi = cdep.y;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let d = textureLoad(tCurDepth, clamp(ip + vec2i(x, y), vec2i(0), vec2i(u.lowRes) - 1), 0).rg;
      dkm = min(dkm, d.x);
      fogLo = min(fogLo, d.y);
      fogHi = max(fogHi, d.y);
    }
  }
  var prel = dir * dkm * 1000.0 + u.camDelta;
  if (dkm > 5000.0) { prel = dir * 1.0e7; }
  let pc = u.prevVP * vec4f(prel, 1.0);
  let puv = pc.xy / pc.w * 0.5 + 0.5;
  var valid = select(0.0, 1.0, pc.w > 1e-6 && u.histFrames > 0.5);
  valid *= step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
  // (without history where a turn brings in the frame's edge: the neighbourhood's mean, softer than
  // one jittered sample for the frames until the history has more; the first frame keeps its own
  // sample, which the slow blend carries for many frames)
  var res = select(cur, mix(m1, cur, 0.5), u.histFrames > 0.5);
  var fog = cdep.y;
  if (valid > 0.5) {
    let hist = sampleHist(puv);
    // how far the history lies from where it would at infinity, in pixels: the parallax of the
    // camera's own movement, which one depth a pixel (a weighted mean) can place wrongly (ghosts at
    // the edges between near and far). A turn, a bank, the camera's shake move the image by a
    // rotation alone, which reprojects exactly: judged by all the motion, every turn tightened the
    // clamp and the blend followed each frame's jittered rims (grain at the clouds' edges in flight)
    let pci = u.prevVP * vec4f(dir * 1.0e7, 1.0);
    let motion = length((puv - (pci.xy / pci.w * 0.5 + 0.5)) * u.res);
    // the clamp box: tight in motion (no ghosts), wider where the image holds still, so the history
    // settles over the jitter sequence instead of following each frame's crisp rims
    let gam = mix(2.4, 1.25, saturate(motion * 0.5));
    var lo = m1 - gam * sd;
    var hi = m1 + gam * sd;
    lo = min(lo, cur);
    hi = max(hi, cur);
    let hc = clamp(hist, lo, hi);
    let fd = lp - lpr;
    let wcur = exp(-2.2 * dot(fd, fd));
    // (and over the history's first 8 frames, their plain mean: from the start the first frame's one
    // sample would linger for seconds at the slow rate)
    let alpha = max(mix(0.035, 0.38, saturate(motion / 12.0)) * (0.55 + 0.45 * wcur), select(0.0, 1.0 / (u.histFrames + 1.0), u.histFrames < 8.0));
    // the camera's own fog the history holds, against the range of it around now: past it by more
    // than a drift through thin fog, the history is stale, and gives way to the neighbourhood's mean
    // (a jittered sample there was grain while the fog cleared). Out of a cloud's edge, the fog it
    // held lingered on the far clouds' outlines, where the clamp box spans cloud and sky: a pale rim
    // for a second, as nothing moves there to quicken the blend. At the shreds' edges the range
    // spans them.
    let hFog = textureSampleLevel(tHistFog, sLin, puv, 0.0).r;
    let stale = saturate(8.0 * (max(max(fogLo - hFog, hFog - fogHi), 0.0) - 0.06));
    res = mix(mix(hc, m1, stale), cur, alpha);
    fog = mix(mix(hFog, cdep.y, stale), cdep.y, alpha);
  }
  let sky = skyColor(dir);
  // high layers: behind the clouds they join the sky, in front of them they veil the clouds
  let cd = select(select(dkm * 1000.0, 1.0e9, dkm > 5000.0), 0.0, cdep.y < 0.999);
  var t0 = distToHeight(u.camPos.y, dir.y, LAYER_H0);
  var t1 = distToHeight(u.camPos.y, dir.y, LAYER_H1);
  var l0 = vec4f(0.0);
  var l1 = vec4f(0.0);
  if (t0 > 0.0) { l0 = highLayer(0, dir, t0, sky); }
  if (t1 > 0.0) { l1 = highLayer(1, dir, t1, sky); }
  if (t1 > 0.0 && (t0 < 0.0 || t1 < t0)) { let x = l0; l0 = l1; l1 = x; let y = t0; t0 = t1; t1 = y; }  // l0 nearest
  var back = sky;
  var frontL = vec3f(0.0);
  var frontT = 1.0;
  if (t1 > 0.0) { if (t1 < cd) { frontL = l1.rgb; frontT = 1.0 - l1.a; } else { back = back * (1.0 - l1.a) + l1.rgb; } }
  if (t0 > 0.0) { if (t0 < cd) { frontL = l0.rgb + frontL * (1.0 - l0.a); frontT *= 1.0 - l0.a; } else { back = back * (1.0 - l0.a) + l0.rgb; } }
  // (the scene's alpha: how much sky shows past the clouds, the sun rays' mask)
  return Out(res, vec4f(frontL + frontT * (back * res.a + res.rgb), res.a), fog);
}