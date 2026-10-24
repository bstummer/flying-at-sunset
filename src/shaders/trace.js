// The cloud raymarch (low resolution)

import { GLSL_COMMON } from './common.js';
import { GLSL_ATMO } from './sky.js';
import { GLSL_CLOUD } from './cloud.js';

export const FS_TRACE = GLSL_COMMON + GLSL_ATMO + GLSL_CLOUD + /* glsl */ `
uniform sampler2D uSky;
uniform sampler2D uAmb;
uniform vec2 uRes;
uniform vec2 uJitter;
uniform vec3 uCamPos;
uniform vec3 uCamRight, uCamUp, uCamFwd;
uniform vec2 uTanHalf;
uniform float uFrame;
uniform vec3 uAmbSea;
uniform float uHazeK;
uniform int uDbgMode;
uniform float uInCloud;
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oDepth;

const float HAZE_H = 2400.0;
float hazeOD(float t, float h0, float dy) {
  float e0 = uHazeK * exp(-h0 / HAZE_H);
  float k = (dy + t * INV2R) / HAZE_H;
  if (abs(k) < 1e-7) return e0 * t;
  return e0 * (1.0 - exp(-k * t)) / k;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 ndc = (frag + uJitter) / uRes * 2.0 - 1.0;
  vec3 dir = normalize(uCamFwd + ndc.x * uTanHalf.x * uCamRight + ndc.y * uTanHalf.y * uCamUp);
  float h0 = uCamPos.y;

  // extent of the cloud shell along the ray (curved planet, parabolic approximation)
  float tEnd = 250000.0;
  {
    // h(t) = h0 + dy t + t^2 INV2R ; solve h(t) = CLOUD_TOP
    float a = INV2R, b = dir.y, c0 = h0 - CLOUD_TOP;
    float D = b * b - 4.0 * a * c0;
    if (D > 0.0) tEnd = min(tEnd, (-b + sqrt(D)) / (2.0 * a));
    float c1 = h0 - SEA_BASE;
    float D1 = b * b - 4.0 * a * c1;
    if (b < 0.0 && D1 > 0.0) tEnd = min(tEnd, (-b - sqrt(D1)) / (2.0 * a));
  }

  // per-pixel low-discrepancy temporal sequences (R2) on top of a spatial IGN pattern
  float fr = mod(uFrame, 1024.0);
  float jit = fract(ign(frag) + fr * 0.75487767);
  float jit2 = fract(ign(frag + vec2(47.0, 17.0)) + fr * 0.56984029);
  // haze colour: the sky just above the horizon for downward rays (no seam at the horizon)
  vec3 hazeDir = normalize(vec3(dir.x, max(dir.y, 0.004), dir.z));
  vec3 skyHaze = skyLookup(uSky, hazeDir, uSunDir, h0 * 0.001);
  vec3 ambUp = texelFetch(uAmb, ivec2(0, 0), 0).rgb * 1.95;
  // light bounced off the sunlit sea of clouds below (Lambertian deck, sun 5 degrees up)
  vec3 seaBounce = uAmbSea * 0.38;
  vec3 ambSunS = texelFetch(uAmb, ivec2(2, 0), 0).rgb * 1.95 + seaBounce * 0.4;
  // (a touch of violet: the anti-sun sky at dusk; on cloud sides it reads as cool, luminous shade)
  vec3 ambAnti = texelFetch(uAmb, ivec2(3, 0), 0).rgb * 1.95 * vec3(1.06, 0.93, 1.1) + seaBounce * 0.15;
  float cosT = dot(dir, uSunDir);
  vec4 phase = phaseOctaves(cosT);
  float powder = 1.0 - 0.28 * sat(0.5 - 0.5 * cosT);

  float T = 1.0;
  vec3 L = vec3(0.0);
  float zSum = 0.0, zW = 0.0;
  float t = (0.2 + jit * 0.8) * 4.0;
  bool done = false;
  float tPrev = 0.0, dPrev = -1.0;   // last point outside the clouds
  float tIn = 0.0, dIn = 0.0;        // nearest point known to be inside, while refining an entry
  int nRef = 0, side = 0;
  bool startIn = false;
  float nIter = 0.0, nIn = 0.0, nSdf = 0.0;
  float lastTau = 0.0, lastDepth = 0.0, lastNS = 0.0, lastNUp = 1.0;
  for (int i = 0; i < 360; i++) {
    nIter += 1.0;
    if (t >= tEnd || T < 0.02) { done = true; break; }
    vec3 rel = dir * t;
    float h = h0 + rel.y + dot(rel.xz, rel.xz) * INV2R;
    vec3 wp = uCamPos + rel;
    wp.y = h;
    // stride floor grows with distance (far detail is softened by haze anyway), slowly enough
    // that distant towers are not stepped over
    float minStep = 6.0 + t * 0.02 + max(t - 8000.0, 0.0) * 0.006;
    float rj = fract(jit + float(i) * 0.61803399);
    // empty space skipping: the distance to the large shapes, less the highest billows on them
    int lv = levelAt(wp.xz, t, jit);
    vec4 C = colAt(wp.xz, lv);
    float dm = macroAt(vec3(wp.x, h, wp.z), lv);
    float bound = dm - shellOf(C.y) - LV_MARGIN[lv];
    if (bound > 0.0 && nRef == 0 && !startIn) { tPrev = t; dPrev = bound; t += max(bound * 0.95, minStep * (0.5 + rj)); continue; }
    float lod = t * (1.0 / 15000.0);
    nSdf += 1.0;
    float d = cloudSDF(wp, h, dm, C, lod);
    float edgeW = mix(14.0, EDGE_W, smoothstep(120.0, 4000.0, t));   // crisper rims up close
    // the billowy tops of the sea and everything piled on it have crisp outlines, only widened
    // enough at range not to alias; the deep troughs of the sea stay soft
    float crisp = smoothstep(-150.0, 250.0, h - C.w);
    edgeW = mix(edgeW, min(edgeW, max(30.0, t * 0.003)), crisp);
    float dtMin = 3.0 + t * 0.002;
    // Entering a cloud: locate the boundary within the last stride (Illinois regula falsi), then
    // start integrating a jittered fraction of a rim step past it. Starting anywhere within a far
    // stride (hundreds of metres deep) would light distant clouds as if from deep inside them.
    float tol = max(edgeW * 0.15, 1.0);
    if (nRef > 0) {
      if (d > 0.0) { tPrev = t; dPrev = d; if (side == 1) dIn *= 0.5; side = 1; }
      else { tIn = t; dIn = d; if (side == 2) dPrev *= 0.5; side = 2; }
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
    float detailW = 1.0 - smoothstep(6000.0, 16000.0, t);
    // (only on heaps piled above the sea)
    float farW = h > C.w + 300.0 ? smoothstep(2500.0, 9000.0, t) : 0.0;
    float nearW = (1.0 - smoothstep(150.0, 900.0, t)) * max(uInCloud, 1.0 - smoothstep(40.0, 120.0, -d));
#ifdef DBG
    if (uDbgMode > 0 && uDbgMode < 4) {
      vec3 nrm;
      float e = 4.0 + t * 0.002;
      nrm.x = sceneSDF(wp + vec3(e, 0, 0), h, lv, lod) - sceneSDF(wp - vec3(e, 0, 0), h, lv, lod);
      nrm.y = sceneSDF(wp + vec3(0, e, 0), h + e, lv, lod) - sceneSDF(wp - vec3(0, e, 0), h - e, lv, lod);
      nrm.z = sceneSDF(wp + vec3(0, 0, e), h, lv, lod) - sceneSDF(wp - vec3(0, 0, e), h, lv, lod);
      nrm = normalize(nrm);
      vec3 c;
      if (uDbgMode == 1) c = vec3(0.08) + vec3(1.0, 0.85, 0.6) * max(dot(nrm, uSunDir), 0.0) + vec3(0.1, 0.15, 0.3) * (nrm.y * 0.5 + 0.5);
      else if (uDbgMode == 2) c = vec3(exp(-lightTau(wp, h, lv, C, jit2, lod + 0.5)));
      else c = vec3(exp(-tsvTau(wp, h)));
      oCol = vec4(c * 0.12, 0.0);
      oDepth = vec4(t * 0.001, 0.0, 0.0, 1.0);
      return;
    }
#endif
    float dens = densityEx(d, wp, detailW, edgeW, nearW, farW);
    // inside a cloud the air right around the camera is kept thin: drifting mist, not a white wall
    dens *= mix(1.0, mix(0.22, 1.0, smoothstep(12.0, 160.0, t)), uInCloud);
    // stride: aim for a fixed optical depth per step (larger once little light gets through),
    // but stay fine inside the soft rim where most of the visible light is scattered
    float sigma = dens * SIGMA;
    float dt = clamp((0.45 + 1.6 * (1.0 - T)) / max(sigma, 0.004), dtMin, 8.0 + t * 0.016);
    dt = min(dt, max(edgeW * 0.55, -d * 0.6 + dtMin)) * (0.75 + 0.5 * jit2);
    if (dens > 0.003) {
      nIn += 1.0;
      // once little light gets through, deeper samples reuse the light of the previous one
      bool reuse = T < 0.22 || (T < 0.65 && mod(nIn, 2.0) > 0.5);
      float tau;
      if (reuse) tau = lastTau + max(-d - lastDepth, 0.0) * SIGMA * 2.0;
      else {
        tau = lightTauN(wp, h, lv, C, jit2, lod + 0.25, lastNS);
        // which way the surface faces: up from one distance tap above, toward the sun from the
        // light march. Each bulge then catches its own sky light, even in shadow. (Only near the
        // visible surface; deeper samples keep the last estimate.)
        if (T > 0.45) {
          float S = 30.0 + t * 0.004;
          lastNUp = clamp((cloudSDF(wp + vec3(0.0, S, 0.0), h + S, macroAt(vec3(wp.x, h + S, wp.z), lv), C, lod) - d) / S, -1.0, 1.0);
        }
      }
      lastTau = tau; lastDepth = -d;
      // distant occluders (towers) block all scattering orders: their shadow is a plain multiplier
      float farT = exp(-tsvTau(wp, h));
      float depthIn = -d;
      float pw = mix(powder, 1.0, 1.0 - exp(-depthIn * 0.035));
      // diffusion: clouds barely absorb, so light soaks deep inside and glows; weaker right at
      // the surface where it leaks out (keeps shadowed sides cool)
      float diffu = 0.032 / (1.0 + 0.025 * tau) * (1.0 - exp(-depthIn / 80.0));
      // light diffusing through the cloud glows golden in thin parts, cooler (blue-violet) where it
      // has travelled far through the cloud; in the shadow of distant towers only a soft, cool
      // isotropic fill remains
      vec3 sc = sunColorAt(h);
      vec3 cool = vec3(0.78, 0.8, 1.25) * luma(sc);
      vec3 glow = mix(sc, cool, 0.6 * sat(tau / 35.0));
      vec3 sunL = sc * (msScatterP(tau, phase) * pw * farT) + glow * diffu * farT + mix(sc, cool, 0.5) * (0.005 * (1.0 - farT));
#ifdef DBG
      if (uDbgMode >= 5) {
        vec4 e = exp(-tau * vec4(1.0, 0.5, 0.25, 0.125));
        float ms = dot(e * vec4(1.0, 0.55, 0.3025, 0.166375), phase) * pw;
        float df = diffu;
        sunL = sunColorAt(h) * farT * (uDbgMode == 5 ? ms : uDbgMode == 6 ? df : 0.0);
      }
#endif
      float up = sat((h - C.w + 250.0) / 1400.0);
      // sky light only reaches the first few tens of metres (short scale also hides the
      // discontinuous interior of the distance field)
      float ao = mix(0.5, 1.0, exp(-depthIn / 55.0));
      // sky light by orientation: the deep blue zenith on tops, the warm sunlit sea under bellies,
      // the golden sun-side or the cool violet anti-sun sky on the sides (a belly sees only part of
      // the sea below past the bulges around it)
      vec3 eSide = mix(ambAnti, ambSunS, sat(0.5 + 0.5 * lastNS));
      vec3 eDir = lastNUp > 0.0 ? mix(eSide, ambUp, lastNUp) : mix(eSide, seaBounce, -0.5 * lastNUp);
      vec3 amb = (eDir * mix(0.45, 1.0, up) + uAmbSea * (1.0 - up) * 0.7) * ao;
#ifdef DBG
      if (uDbgMode == 5 || uDbgMode == 6) amb *= 0.0;
#endif
      vec3 S = sigma * 0.985 * (sunL + amb);
      float st = exp(-sigma * dt);
      vec3 Sint = (S - S * st) / sigma;
      float th = exp(-hazeOD(t, h0, dir.y));
      L += T * (Sint * th + (1.0 - st) * skyHaze * (1.0 - th));
      float w = T * (1.0 - st);
      zSum += w * t; zW += w;
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
    float th = exp(-hazeOD(t, h0, dir.y));
    L += T * skyHaze * (1.0 - th * 0.35);
    zSum += T * t; zW += T;
    T = 0.0;
  }
#ifdef DBG
  if (uDbgMode == 4) { oCol = vec4(vec3(nIter / 200.0, nSdf / 100.0, nIn / 40.0) * 0.12, 0.0); oDepth = vec4(1.0, 0.0, 0.0, 1.0); return; }
#endif
  oCol = vec4(L, T);
  oDepth = vec4(zW > 1e-4 ? (zSum / zW) * 0.001 : 9000.0, 0.0, 0.0, 1.0);
}`;
