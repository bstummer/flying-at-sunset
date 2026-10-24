// Post: bloom, sun rays, tone mapping

import { GLSL_COMMON } from './common.js';

export const FS_DOWN = GLSL_COMMON + /* glsl */ `
uniform sampler2D uSrc;
uniform sampler2D uBird;
uniform vec4 uBirdBox;
uniform vec2 uSrcTexel;
uniform int uFirst;
uniform float uClampHi;
out vec4 o;
vec3 src(vec2 uv) {
  vec3 c = textureLod(uSrc, uv, 0.0).rgb;
  if (uFirst == 1 && uv.x > uBirdBox.x && uv.y > uBirdBox.y && uv.x < uBirdBox.z && uv.y < uBirdBox.w) {
    vec4 b = textureLod(uBird, uv, 0.0);
    c = c * (1.0 - b.a) + b.rgb;
  }
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  return min(c, vec3(uClampHi));
}
void main() {
  vec2 uv = (floor(gl_FragCoord.xy) * 2.0 + 1.0) * uSrcTexel;
  vec2 t = uSrcTexel;
  vec3 a = src(uv + t * vec2(-2, 2)), b = src(uv + t * vec2(0, 2)), c = src(uv + t * vec2(2, 2));
  vec3 d = src(uv + t * vec2(-2, 0)), e = src(uv), f = src(uv + t * vec2(2, 0));
  vec3 g = src(uv + t * vec2(-2, -2)), h = src(uv + t * vec2(0, -2)), i = src(uv + t * vec2(2, -2));
  vec3 j = src(uv + t * vec2(-1, 1)), k = src(uv + t * vec2(1, 1)), l = src(uv + t * vec2(-1, -1)), m = src(uv + t * vec2(1, -1));
  // 13-tap downsample (no Karis average: the sun is a big stable disk and must bloom fully)
  vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  o = vec4(r, 1.0);
}`;

export const FS_UP = GLSL_COMMON + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uSrcTexel;
uniform vec2 uDstTexel;
uniform float uWeight;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uDstTexel;
  vec2 t = uSrcTexel;
  vec3 s = textureLod(uSrc, uv, 0.0).rgb * 4.0;
  s += (textureLod(uSrc, uv + t * vec2(1, 0), 0.0).rgb + textureLod(uSrc, uv + t * vec2(-1, 0), 0.0).rgb + textureLod(uSrc, uv + t * vec2(0, 1), 0.0).rgb + textureLod(uSrc, uv + t * vec2(0, -1), 0.0).rgb) * 2.0;
  s += textureLod(uSrc, uv + t * vec2(1, 1), 0.0).rgb + textureLod(uSrc, uv + t * vec2(-1, 1), 0.0).rgb + textureLod(uSrc, uv + t * vec2(1, -1), 0.0).rgb + textureLod(uSrc, uv + t * vec2(-1, -1), 0.0).rgb;
  o = vec4(s / 16.0 * uWeight, 1.0);
}`;

export const FS_RAYMASK = GLSL_COMMON + /* glsl */ `
uniform sampler2D uHist;
uniform sampler2D uBird;
uniform vec4 uBirdBox;
uniform vec3 uCamRight, uCamUp, uCamFwd;
uniform vec2 uTanHalf;
uniform vec3 uSunDir;
uniform vec2 uDstTexel;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uDstTexel;
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 dir = normalize(uCamFwd + ndc.x * uTanHalf.x * uCamRight + ndc.y * uTanHalf.y * uCamUp);
  float c = max(dot(dir, uSunDir), 0.0);
  float glow = pow(c, 600.0) * 3.0 + pow(c, 60.0) * 0.4 + pow(c, 8.0) * 0.04;
  float T = textureLod(uHist, uv, 0.0).a;
  if (uv.x > uBirdBox.x && uv.y > uBirdBox.y && uv.x < uBirdBox.z && uv.y < uBirdBox.w) T *= 1.0 - textureLod(uBird, uv, 0.0).a;
  o = vec4(vec3(glow * T), 1.0);
}`;

export const FS_RAYBLUR = GLSL_COMMON + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uSunUv;
uniform vec2 uDstTexel;
uniform float uStepScale;
out vec4 o;
uniform float uDecay;
void main() {
  // radial blur toward the sun; run twice (short then long strides) for smooth, noise-free rays
  vec2 uv = gl_FragCoord.xy * uDstTexel;
  vec2 d = (uSunUv - uv) * uStepScale;
  vec2 p = uv;
  vec3 acc = vec3(0.0);
  float w = 1.0, ws = 0.0;
  for (int i = 0; i < 24; i++) {
    acc += textureLod(uSrc, p, 0.0).rgb * w;
    ws += w;
    w *= uDecay;
    p += d;
  }
  o = vec4(acc / ws, 1.0);
}`;

export const FS_FINAL = GLSL_COMMON + /* glsl */ `
uniform sampler2D uScene;
uniform sampler2D uBird;
uniform sampler2D uBloom;
uniform sampler2D uRays;
uniform vec4 uBirdBox;
uniform float uExposure;
uniform float uBloomMix;
uniform float uBloomScale;
uniform vec3 uRayCol;
uniform float uTime;
uniform vec2 uRes;
uniform int uView;
uniform int uTM;
uniform float uContrast;
uniform sampler2D uDbg;
uniform sampler2D uDbg2;
uniform vec2 uDbgScale;
out vec4 o;
// ACES fitted (Stephen Hill)
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 ACESIn = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 ACESOut = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  c = ACESIn * c; c = RRTAndODTFit(c); c = ACESOut * c;
  return sat(c);
}
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  if (uView == 1) { o = vec4(vec3(textureLod(uDbg, uv, 0.0).a), 1.0); return; }
  if (uView == 2) { o = vec4(toSRGB(sat(textureLod(uDbg, uv, 0.0).rgb * uExposure * 0.5)), 1.0); return; }
  if (uView == 3) { float d = textureLod(uDbg2, uv * uDbgScale, 0.0).r; o = vec4(vec3(sat(log2(1.0 + d) / 8.0)), 1.0); return; }
  if (uView == 4) { o = vec4(toSRGB(sat(textureLod(uRays, uv, 0.0).rgb * uRayCol * uExposure)), 1.0); return; }
  if (uView == 5) { o = vec4(toSRGB(sat(textureLod(uBloom, uv, 0.0).rgb * uExposure * 0.25)), 1.0); return; }
  vec3 c = textureLod(uScene, uv, 0.0).rgb;
  if (uv.x > uBirdBox.x && uv.y > uBirdBox.y && uv.x < uBirdBox.z && uv.y < uBirdBox.w) {
    vec4 b = textureLod(uBird, uv, 0.0);
    c = c * (1.0 - b.a) + b.rgb;
  }
  if (any(isnan(c))) c = vec3(0.0);
  vec3 bloom = textureLod(uBloom, uv, 0.0).rgb;
  c = c * (1.0 - uBloomMix) + bloom * uBloomScale;   // energy-conserving mix with the normalised bloom
  c += textureLod(uRays, uv, 0.0).rgb * uRayCol;
  c *= uExposure;
  // gentle contrast around middle grey (pre-curve)
  float lc = max(luma(c), 1e-6);
  c *= pow(lc / 0.18, uContrast - 1.0);
  if (uTM == 0) {
    float l = luma(c);
    c = mix(c, c * vec3(0.95, 0.985, 1.07), 0.35 * (1.0 - sat(l * 2.0)));
    c = aces(c * 1.05);
  } else {
    // hue-preserving filmic: tone map luminance, keep chroma; extreme highlights roll off to white
    float l = max(luma(c), 1e-6);
    vec3 a = aces(c);
    float lt = luma(aces(vec3(l)));
    vec3 hp = c * (lt / l);
    // keep saturated highlights in gamut by desaturating toward luminance as needed
    float mx = max(hp.r, max(hp.g, hp.b));
    if (mx > 1.0) hp = mix(vec3(lt), hp, (1.0 - lt) / max(mx - lt, 1e-4));
    c = mix(hp, a, smoothstep(0.55, 1.0, lt) * 0.85);
    // golden hour split tone: warm highlights, cool violet shadows
    float t = sat(lt * 1.4);
    c *= mix(vec3(0.93, 0.95, 1.08), vec3(1.04, 1.0, 0.93), t);
    c = sat(c);
  }
  // vignette
  vec2 q = uv - 0.5;
  q.x *= uRes.x / uRes.y;
  c *= mix(1.0, 0.74, smoothstep(0.35, 1.25, length(q)));
  c = toSRGB(c);
  // grain / dither
  float n = ign(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(113.0, 71.0)) - 0.5;
  c += n * (1.5 / 255.0);
  o = vec4(c, 1.0);
}`;
