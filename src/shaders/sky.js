// The sky: atmosphere lookup tables after Hillaire 2020 (transmittance, multiple scattering, sky view, ambient)

import { GLSL_COMMON } from './common.js';

export const GLSL_ATMO = /* glsl */ `
const float RG = 6360.0;
const float RT = 6460.0;
const vec3 RAY_S = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float RAY_H = 8.0;
const float MIE_S = 3.996e-3 * 2.2;
const float MIE_A = 4.4e-3 * 2.2;
const float MIE_H = 1.2;
const vec3 OZO_A = vec3(0.650e-3, 1.881e-3, 0.085e-3);
const vec2 TRANS_SIZE = vec2(256.0, 64.0);
const vec2 SKY_SIZE = vec2(192.0, 108.0);

void mediumAt(float h, out vec3 scatR, out float scatM, out vec3 ext) {
  float dR = exp(-h / RAY_H), dM = exp(-h / MIE_H), dO = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
  scatR = RAY_S * dR;
  scatM = MIE_S * dM;
  ext = scatR + vec3(scatM + MIE_A * dM) + OZO_A * dO;
}
float distToTop(float r, float mu) {
  float disc = r * r * (mu * mu - 1.0) + RT * RT;
  return max(0.0, -r * mu + sqrt(max(disc, 0.0)));
}
float distToGround(float r, float mu) {
  float disc = r * r * (mu * mu - 1.0) + RG * RG;
  if (disc < 0.0 || mu > 0.0) return -1.0;
  return -r * mu - sqrt(disc);
}
vec2 rMuToTransUv(float r, float mu) {
  float H = sqrt(RT * RT - RG * RG);
  float rho = sqrt(max(0.0, r * r - RG * RG));
  float d = distToTop(r, mu);
  float dMin = RT - r, dMax = rho + H;
  vec2 uv = vec2((d - dMin) / max(dMax - dMin, 1e-4), rho / H);
  return (uv * (TRANS_SIZE - 1.0) + 0.5) / TRANS_SIZE;
}
float rayleighPhase(float c) { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
float cornetteShanks(float c, float g) {
  float g2 = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + c * c)) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
vec3 sampleTrans(sampler2D lut, float r, float mu) {
  return textureLod(lut, rMuToTransUv(r, mu), 0.0).rgb;
}
vec3 sunTransmittance(sampler2D lut, float r, float muS) {
  float muH = -sqrt(max(0.0, 1.0 - RG * RG / (r * r)));
  return sampleTrans(lut, r, muS) * smoothstep(-0.006, 0.006, muS - muH);
}
vec2 skyParamsToUv(float r, float viewZenithCos, float lightViewCos, bool ground) {
  float vHorizon = sqrt(max(r * r - RG * RG, 0.0));
  float beta = acos(clamp(vHorizon / r, -1.0, 1.0));
  float zenithHorizonAngle = PI - beta;
  vec2 uv;
  float a = acos(clamp(viewZenithCos, -1.0, 1.0));
  if (!ground) {
    float c = a / zenithHorizonAngle;
    c = 1.0 - sqrt(max(1.0 - c, 0.0));
    uv.y = c * 0.5;
  } else {
    float c = (a - zenithHorizonAngle) / beta;
    uv.y = sqrt(max(c, 0.0)) * 0.5 + 0.5;
  }
  uv.x = sqrt(clamp(-lightViewCos * 0.5 + 0.5, 0.0, 1.0));
  return (uv * (SKY_SIZE - 1.0) + 0.5) / SKY_SIZE;
}
vec3 skyLookup(sampler2D skyLut, vec3 dir, vec3 sunDir, float camHkm) {
  float r = RG + max(camHkm, 0.01);
  vec2 dh = dir.xz, sh = sunDir.xz;
  float l1 = length(dh), l2 = length(sh);
  float lvc = (l1 > 1e-5 && l2 > 1e-5) ? dot(dh, sh) / (l1 * l2) : 1.0;
  bool ground = distToGround(r, dir.y) > 0.0;
  return textureLod(skyLut, skyParamsToUv(r, dir.y, lvc, ground), 0.0).rgb;
}
`;

export const FS_TRANSMITTANCE = GLSL_COMMON + GLSL_ATMO + /* glsl */ `
out vec4 o;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5) / (TRANS_SIZE - 1.0);
  float H = sqrt(RT * RT - RG * RG);
  float rho = H * uv.y;
  float r = sqrt(rho * rho + RG * RG);
  float dMin = RT - r, dMax = rho + H;
  float d = dMin + uv.x * (dMax - dMin);
  float mu = d == 0.0 ? 1.0 : (H * H - rho * rho - d * d) / (2.0 * r * d);
  mu = clamp(mu, -1.0, 1.0);
  float L = distToTop(r, mu);
  vec3 od = vec3(0.0);
  const int N = 48;
  float ds = L / float(N);
  for (int i = 0; i < N; i++) {
    float s = (float(i) + 0.5) * ds;
    float rr = sqrt(r * r + s * s + 2.0 * r * mu * s);
    vec3 sR, ext; float sM;
    mediumAt(rr - RG, sR, sM, ext);
    od += ext * ds;
  }
  o = vec4(exp(-od), 1.0);
}`;

export const FS_MULTISCAT = GLSL_COMMON + GLSL_ATMO + /* glsl */ `
uniform sampler2D uTrans;
out vec4 o;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5) / 31.0;
  float muS = uv.x * 2.0 - 1.0;
  float r = RG + max(uv.y * (RT - RG), 0.02);
  vec3 sunDir = vec3(sqrt(max(0.0, 1.0 - muS * muS)), muS, 0.0);
  vec3 pos = vec3(0.0, r, 0.0);
  vec3 L2 = vec3(0.0), Fms = vec3(0.0);
  const int SQ = 8;
  for (int i = 0; i < SQ; i++) for (int j = 0; j < SQ; j++) {
    float th = 2.0 * PI * (float(i) + 0.5) / float(SQ);
    float cp = 1.0 - 2.0 * (float(j) + 0.5) / float(SQ);
    float sp = sqrt(max(0.0, 1.0 - cp * cp));
    vec3 dir = vec3(sp * cos(th), cp, sp * sin(th));
    float tG = distToGround(r, dir.y);
    float tMax = tG > 0.0 ? tG : distToTop(r, dir.y);
    const int NS = 24;
    float dt = tMax / float(NS);
    vec3 T = vec3(1.0), Lp = vec3(0.0), Fp = vec3(0.0);
    for (int k = 0; k < NS; k++) {
      float t = (float(k) + 0.5) * dt;
      vec3 p = pos + dir * t;
      float rr = length(p);
      vec3 up = p / rr;
      vec3 sR, ext; float sM;
      mediumAt(rr - RG, sR, sM, ext);
      vec3 sS = sR + vec3(sM);
      vec3 Ts = sunTransmittance(uTrans, rr, dot(up, sunDir));
      vec3 st = exp(-ext * dt);
      vec3 S = sS * Ts / (4.0 * PI);
      Lp += T * (S - S * st) / max(ext, vec3(1e-7));
      Fp += T * (sS - sS * st) / max(ext, vec3(1e-7));
      T *= st;
    }
    if (tG > 0.0) {
      vec3 pg = pos + dir * tG;
      vec3 up = normalize(pg);
      float mu = dot(up, sunDir);
      Lp += T * sunTransmittance(uTrans, RG, mu) * sat(mu) * 0.55 / PI;
    }
    L2 += Lp; Fms += Fp;
  }
  L2 /= float(SQ * SQ);
  Fms /= float(SQ * SQ);
  o = vec4(L2 / (1.0 - Fms), 1.0);
}`;

export const FS_SKYVIEW = GLSL_COMMON + GLSL_ATMO + /* glsl */ `
uniform sampler2D uTrans;
uniform sampler2D uMS;
uniform float uCamH;   // km
uniform vec3 uSunDir;
out vec4 o;
vec3 msLookup(float r, float muS) {
  vec2 uv = vec2(muS * 0.5 + 0.5, (r - RG) / (RT - RG));
  uv = (uv * 31.0 + 0.5) / 32.0;
  return textureLod(uMS, uv, 0.0).rgb;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5) / (SKY_SIZE - 1.0);
  float r = RG + max(uCamH, 0.01);
  float vHorizon = sqrt(max(r * r - RG * RG, 0.0));
  float beta = acos(clamp(vHorizon / r, -1.0, 1.0));
  float zha = PI - beta;
  float vz;
  if (uv.y < 0.5) {
    float c = 2.0 * uv.y; c = 1.0 - c; c *= c; c = 1.0 - c;
    vz = zha * c;
  } else {
    float c = uv.y * 2.0 - 1.0; c *= c;
    vz = zha + beta * c;
  }
  float cvz = cos(vz), svz = sin(vz);
  float c = uv.x * uv.x;
  float lvc = -(c * 2.0 - 1.0);
  float slv = sqrt(max(0.0, 1.0 - lvc * lvc));
  vec3 dir = vec3(svz * lvc, cvz, svz * slv);
  float sunH = length(uSunDir.xz);
  vec3 sunDir = vec3(sunH, uSunDir.y, 0.0);
  float tG = distToGround(r, dir.y);
  float tMax = tG > 0.0 ? tG : distToTop(r, dir.y);
  tMax = min(tMax, 900.0);
  float cosT = dot(dir, sunDir);
  float pR = rayleighPhase(cosT), pM = cornetteShanks(cosT, 0.8);
  vec3 pos = vec3(0.0, r, 0.0);
  vec3 T = vec3(1.0), L = vec3(0.0);
  const int N = 40;
  float tPrev = 0.0;
  for (int i = 0; i < N; i++) {
    float f = (float(i) + 0.5) / float(N);
    float t = tMax * f * f;
    float tn = tMax * pow((float(i) + 1.0) / float(N), 2.0);
    float dt = tn - tPrev; tPrev = tn;
    vec3 p = pos + dir * t;
    float rr = length(p);
    vec3 up = p / rr;
    float muS = dot(up, sunDir);
    vec3 sR, ext; float sM;
    mediumAt(rr - RG, sR, sM, ext);
    vec3 Ts = sunTransmittance(uTrans, rr, muS);
    vec3 ms = msLookup(rr, muS);
    vec3 S = sR * (Ts * pR + ms) + sM * (Ts * pM + ms);
    vec3 st = exp(-ext * dt);
    L += T * (S - S * st) / max(ext, vec3(1e-7));
    T *= st;
  }
  o = vec4(L, 1.0);
}`;

// ambient: px0 = cosine weighted sky irradiance / PI (upper hemisphere), px1 = mean radiance near
// horizon, px2 / px3 = sky irradiance / PI on a vertical face turned toward / away from the sun
export const FS_AMBIENT = GLSL_COMMON + GLSL_ATMO + /* glsl */ `
uniform sampler2D uSky;
uniform vec3 uSunDir;
uniform float uCamH;
out vec4 o;
void main() {
  int px = int(gl_FragCoord.x);
  vec3 acc = vec3(0.0); float w = 0.0;
  vec3 face = normalize(vec3(uSunDir.x, 0.0, uSunDir.z)) * (px == 2 ? 1.0 : -1.0);
  for (int i = 0; i < 24; i++) for (int j = 0; j < 10; j++) {
    float ph = 2.0 * PI * (float(i) + 0.5) / 24.0;
    float ct = (float(j) + 0.5) / 10.0;
    if (px == 1) ct = ct * 0.25;
    float st = sqrt(1.0 - ct * ct);
    vec3 d = vec3(st * cos(ph), ct, st * sin(ph));
    vec3 L = skyLookup(uSky, d, uSunDir, uCamH);
    float wt = px == 0 ? ct : px == 1 ? 1.0 : max(dot(d, face), 0.0);
    acc += L * wt; w += wt;
  }
  // px0: irradiance/PI = mean(L cos)/mean(cos) * ... ; uniform-in-cos sampling -> E = 2PI * mean(L cos)
  vec3 r = px == 1 ? acc / w : acc / float(240) * 2.0;
  o = vec4(r, 1.0);
}`;
