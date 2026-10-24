// Temporal upsampling and the sky composite

import { GLSL_COMMON } from './common.js';
import { GLSL_ATMO } from './sky.js';

export const FS_TAAU = GLSL_COMMON + GLSL_ATMO + /* glsl */ `
uniform sampler2D uCur;
uniform sampler2D uCurDepth;
uniform sampler2D uHist;
uniform sampler2D uSky;
uniform sampler2D uCirrus;
uniform vec2 uLowRes;
uniform vec2 uLowTex;
uniform vec2 uRes;
uniform vec2 uJitter;
uniform vec3 uCamRight, uCamUp, uCamFwd;
uniform vec2 uTanHalf;
uniform mat4 uPrevVP;
uniform vec3 uCamDelta;
uniform float uHistValid;
uniform vec3 uSunDir;
uniform vec3 uCamPos;
uniform vec3 uSunDisk;
uniform vec3 uCirrusCol;
uniform vec2 uCirrusOff;
uniform sampler2D uLayers;
uniform vec2 uLayerOff;
uniform vec3 uLayerCol[2];      // sunlight at the height of each high layer
layout(location = 0) out vec4 oHist;
layout(location = 1) out vec4 oScene;

vec4 sampleHist(vec2 uv) {
  // Catmull-Rom with 9 taps (5 bilinear) for a sharp, stable history
  vec2 pos = uv * uRes;
  vec2 tc = floor(pos - 0.5) + 0.5;
  vec2 f = pos - tc;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 tc0 = (tc - 1.0) / uRes, tc3 = (tc + 2.0) / uRes, tc12 = (tc + w2 / w12) / uRes;
  vec4 r = vec4(0.0);
  r += textureLod(uHist, vec2(tc12.x, tc0.y), 0.0) * (w12.x * w0.y);
  r += textureLod(uHist, vec2(tc0.x, tc12.y), 0.0) * (w0.x * w12.y);
  r += textureLod(uHist, vec2(tc12.x, tc12.y), 0.0) * (w12.x * w12.y);
  r += textureLod(uHist, vec2(tc3.x, tc12.y), 0.0) * (w3.x * w12.y);
  r += textureLod(uHist, vec2(tc12.x, tc3.y), 0.0) * (w12.x * w3.y);
  float wsum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / wsum, vec4(0.0));
}

vec3 skyColor(vec3 dir) {
  float h = uCamPos.y * 0.001;
  vec3 c = skyLookup(uSky, dir, uSunDir, h);
  // high cirrus veil
  if (dir.y > 0.003) {
    float hc = 9800.0 - uCamPos.y;
    float t = hc / max(dir.y, 0.02);
    vec2 p = (uCamPos.xz + dir.xz * t + uCirrusOff) / 32000.0;
    vec4 cs = textureLod(uCirrus, p, 0.0);
    float a = cs.r * smoothstep(0.003, 0.08, dir.y);
    float cosT = dot(dir, uSunDir);
    float g = 0.6;
    float ph = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * cosT, 1.5));
    vec3 cc = uCirrusCol * (0.25 + 4.0 * ph) * (0.75 + 0.5 * cs.g);
    float fade = exp(-t / 60000.0);
    c = mix(c, cc + c * 0.6, a * 0.32 * fade);
  }
  // sun disk with limb darkening
  float cosA = dot(dir, uSunDir);
  float ang = acos(clamp(cosA, -1.0, 1.0));
  const float SUN_R = 0.0052;
  if (ang < SUN_R * 1.6) {
    float x = sat(ang / SUN_R);
    float mu = sqrt(max(0.0, 1.0 - x * x));
    float limb = 1.0 - 0.6 * (1.0 - mu) - 0.15 * (1.0 - mu) * (1.0 - mu);
    float edge = 1.0 - smoothstep(SUN_R * 0.92, SUN_R * 1.08, ang);
    c += uSunDisk * limb * edge;
  }
  return c;
}

// --- thin high layers, drawn as sheets at fixed heights (they are thin next to the distances they
// are seen from) and sorted against the clouds by depth
const float LAYER_INV2R = 0.5 / 6360000.0;
// distance along dir to height H over the curved planet (parabolic approximation), -1 if none
float distToHeight(float h0, float dy, float H) {
  float c = h0 - H;
  float D = dy * dy - 4.0 * LAYER_INV2R * c;
  if (D < 0.0) return -1.0;
  float q = -0.5 * (dy + (dy >= 0.0 ? 1.0 : -1.0) * sqrt(D));
  if (abs(q) < 1e-9) return -1.0;
  float r1 = q / LAYER_INV2R, r2 = c / q;
  float tn = min(r1, r2), tf = max(r1, r2);
  return tn > 0.0 ? tn : (tf > 0.0 ? tf : -1.0);
}
// premultiplied colour + alpha of high layer k at distance tL along dir
vec4 highLayer(int k, vec3 dir, float tL, vec3 behind) {
  float H = k == 0 ? 6300.0 : 7700.0;
  vec2 p = (uCamPos.xz + dir.xz * tL + uLayerOff) / 64000.0;
  float slope = abs(dir.y + 2.0 * tL * LAYER_INV2R);        // ray slope at the layer
  float foot = tL * 2.0 * uTanHalf.y / uRes.y / max(slope, 0.03);
  vec4 tx = textureLod(uLayers, p, log2(max(foot / 62.5, 1.0)));
  float dens = k == 0 ? tx.r : tx.g;
  if (dens < 0.003) return vec4(0.0);
  float tau = min(dens * 0.32 / max(slope, 0.12), 3.0);
  // fade where the sheet is seen edge-on (no razor lines at the horizon) and into the far haze
  float a = (1.0 - exp(-tau)) * exp(-tL / 75000.0) * smoothstep(0.02, 0.1, slope) * smoothstep(60.0, 450.0, abs(uCamPos.y - H));
  // thin and translucent: forward scattering makes them glow toward the sun, golden all over
  float cosT = dot(dir, uSunDir);
  float g = 0.7, ph = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * cosT, 1.5));
  vec3 c = uLayerCol[k] * (0.22 + 3.2 * ph) * (0.7 + 0.5 * tx.b) + behind * 0.45;
  return vec4(c * a, a);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 dir = normalize(uCamFwd + ndc.x * uTanHalf.x * uCamRight + ndc.y * uTanHalf.y * uCamUp);

  // current low-res estimate (low-res sample i sits at (i + 0.5 + jitter))
  vec2 lp = uv * uLowRes - 0.5 - uJitter;
  vec2 lpr = floor(lp + 0.5);
  vec2 cuv = (lp + 0.5) / uLowTex;
  cuv = clamp(cuv, 0.5 / uLowTex, (uLowRes - 0.5) / uLowTex);
  vec4 cur = textureLod(uCur, cuv, 0.0);
  // neighbourhood statistics: 3x3 bilinear taps centred on this pixel's exact position, so the
  // clamp box varies smoothly between output pixels (no blocky grid from the low-res lattice)
  vec4 m1 = vec4(0.0), m2 = vec4(0.0);
  vec2 lo2 = 0.5 / uLowTex, hi2 = (uLowRes - 0.5) / uLowTex;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec4 s = textureLod(uCur, clamp(cuv + vec2(x, y) / uLowTex, lo2, hi2), 0.0);
    m1 += s; m2 += s * s;
  }
  m1 /= 9.0; m2 /= 9.0;
  vec4 sd = sqrt(max(m2 - m1 * m1, vec4(0.0)));
  float dkm = texelFetch(uCurDepth, clamp(ivec2(lpr), ivec2(0), ivec2(uLowRes) - 1), 0).r;
  vec3 prel = dkm > 5000.0 ? dir * 1.0e7 : dir * dkm * 1000.0 + uCamDelta;
  vec4 pc = uPrevVP * vec4(prel, 1.0);
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  float valid = pc.w > 1e-6 ? uHistValid : 0.0;
  valid *= step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
  vec4 res = cur;
  if (valid > 0.5) {
    vec4 hist = sampleHist(puv);
    vec4 lo = m1 - 1.25 * sd, hi = m1 + 1.25 * sd;
    lo = min(lo, cur); hi = max(hi, cur);
    vec4 hc = clamp(hist, lo, hi);
    vec2 fd = lp - lpr;
    float wcur = exp(-2.2 * dot(fd, fd));
    float motion = length((puv - uv) * uRes);
    float alpha = mix(0.07, 0.38, sat(motion / 18.0)) * (0.55 + 0.45 * wcur);
    res = mix(hc, cur, alpha);
  }
  oHist = res;
  vec3 sky = skyColor(dir);
  // high layers: behind the clouds they join the sky, in front of them they veil the clouds
  float cd = dkm > 5000.0 ? 1.0e9 : dkm * 1000.0;
  float t0 = distToHeight(uCamPos.y, dir.y, 6300.0), t1 = distToHeight(uCamPos.y, dir.y, 7700.0);
  vec4 l0 = t0 > 0.0 ? highLayer(0, dir, t0, sky) : vec4(0.0);
  vec4 l1 = t1 > 0.0 ? highLayer(1, dir, t1, sky) : vec4(0.0);
  if (t1 > 0.0 && (t0 < 0.0 || t1 < t0)) { vec4 x = l0; l0 = l1; l1 = x; float y = t0; t0 = t1; t1 = y; }  // l0 nearest
  vec3 back = sky, frontL = vec3(0.0);
  float frontT = 1.0;
  if (t1 > 0.0) { if (t1 < cd) { frontL = l1.rgb; frontT = 1.0 - l1.a; } else back = back * (1.0 - l1.a) + l1.rgb; }
  if (t0 > 0.0) { if (t0 < cd) { frontL = l0.rgb + frontL * (1.0 - l0.a); frontT *= 1.0 - l0.a; } else back = back * (1.0 - l0.a) + l0.rgb; }
  oScene = vec4(frontL + frontT * (back * res.a + res.rgb), 1.0);
}`;
