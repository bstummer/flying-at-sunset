// The sky: atmosphere lookup tables after Hillaire 2020 (transmittance, multiple scattering, sky view, ambient)

import { WGSL_COMMON } from './common.js';

export const WGSL_ATMO = /* wgsl */ `
const RG = 6360.0;
const RT = 6460.0;
const RAY_S = vec3f(5.802e-3, 13.558e-3, 33.1e-3);
const RAY_H = 8.0;
const MIE_S = 3.996e-3 * 2.2;
const MIE_A = 4.4e-3 * 2.2;
const MIE_H = 1.2;
const OZO_A = vec3f(0.650e-3, 1.881e-3, 0.085e-3);
const TRANS_SIZE = vec2f(256.0, 64.0);
const SKY_SIZE = vec2f(192.0, 108.0);

struct Medium { scatR: vec3f, scatM: f32, ext: vec3f }
fn mediumAt(h: f32) -> Medium {
  let dR = exp(-h / RAY_H);
  let dM = exp(-h / MIE_H);
  let dO = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
  var m: Medium;
  m.scatR = RAY_S * dR;
  m.scatM = MIE_S * dM;
  m.ext = m.scatR + vec3f(m.scatM + MIE_A * dM) + OZO_A * dO;
  return m;
}
fn distToTop(r: f32, mu: f32) -> f32 {
  let disc = r * r * (mu * mu - 1.0) + RT * RT;
  return max(0.0, -r * mu + sqrt(max(disc, 0.0)));
}
fn distToGround(r: f32, mu: f32) -> f32 {
  let disc = r * r * (mu * mu - 1.0) + RG * RG;
  if (disc < 0.0 || mu > 0.0) { return -1.0; }
  return -r * mu - sqrt(disc);
}
fn rMuToTransUv(r: f32, mu: f32) -> vec2f {
  let H = sqrt(RT * RT - RG * RG);
  let rho = sqrt(max(0.0, r * r - RG * RG));
  let d = distToTop(r, mu);
  let dMin = RT - r;
  let dMax = rho + H;
  let uv = vec2f((d - dMin) / max(dMax - dMin, 1e-4), rho / H);
  return (uv * (TRANS_SIZE - 1.0) + 0.5) / TRANS_SIZE;
}
fn rayleighPhase(c: f32) -> f32 { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
fn cornetteShanks(c: f32, g: f32) -> f32 {
  let g2 = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + c * c)) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
// (the lookup tables are parameters: a pass must not bind the table it renders)
fn sampleTrans(lut: texture_2d<f32>, r: f32, mu: f32) -> vec3f {
  return textureSampleLevel(lut, sLin, rMuToTransUv(r, mu), 0.0).rgb;
}
fn sunTransmittance(lut: texture_2d<f32>, r: f32, muS: f32) -> vec3f {
  let muH = -sqrt(max(0.0, 1.0 - RG * RG / (r * r)));
  return sampleTrans(lut, r, muS) * smoothstep(-0.006, 0.006, muS - muH);
}
fn skyParamsToUv(r: f32, viewZenithCos: f32, lightViewCos: f32, ground: bool) -> vec2f {
  let vHorizon = sqrt(max(r * r - RG * RG, 0.0));
  let beta = acos(clamp(vHorizon / r, -1.0, 1.0));
  let zenithHorizonAngle = PI - beta;
  var uv: vec2f;
  let a = acos(clamp(viewZenithCos, -1.0, 1.0));
  if (!ground) {
    var c = a / zenithHorizonAngle;
    c = 1.0 - sqrt(max(1.0 - c, 0.0));
    uv.y = c * 0.5;
  } else {
    let c = (a - zenithHorizonAngle) / beta;
    uv.y = sqrt(max(c, 0.0)) * 0.5 + 0.5;
  }
  uv.x = sqrt(clamp(-lightViewCos * 0.5 + 0.5, 0.0, 1.0));
  return (uv * (SKY_SIZE - 1.0) + 0.5) / SKY_SIZE;
}
fn skyLookup(skyLut: texture_2d<f32>, dir: vec3f, sunDir: vec3f, camHkm: f32) -> vec3f {
  let r = RG + max(camHkm, 0.01);
  let dh = dir.xz;
  let sh = sunDir.xz;
  let l1 = length(dh);
  let l2 = length(sh);
  let lvc = select(1.0, dot(dh, sh) / (l1 * l2), l1 > 1e-5 && l2 > 1e-5);
  let ground = distToGround(r, dir.y) > 0.0;
  return textureSampleLevel(skyLut, sLin, skyParamsToUv(r, dir.y, lvc, ground), 0.0).rgb;
}
`;

export const FS_TRANSMITTANCE = WGSL_COMMON + WGSL_ATMO + /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = (pos.xy - 0.5) / (TRANS_SIZE - 1.0);
  let H = sqrt(RT * RT - RG * RG);
  let rho = H * uv.y;
  let r = sqrt(rho * rho + RG * RG);
  let dMin = RT - r;
  let dMax = rho + H;
  let d = dMin + uv.x * (dMax - dMin);
  var mu = select((H * H - rho * rho - d * d) / (2.0 * r * d), 1.0, d == 0.0);
  mu = clamp(mu, -1.0, 1.0);
  let L = distToTop(r, mu);
  var od = vec3f(0.0);
  const N = 48;
  let ds = L / f32(N);
  for (var i = 0; i < N; i++) {
    let s = (f32(i) + 0.5) * ds;
    let rr = sqrt(r * r + s * s + 2.0 * r * mu * s);
    od += mediumAt(rr - RG).ext * ds;
  }
  return vec4f(exp(-od), 1.0);
}`;

export const FS_MULTISCAT = WGSL_COMMON + WGSL_ATMO + /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = (pos.xy - 0.5) / 31.0;
  let muS = uv.x * 2.0 - 1.0;
  let r = RG + max(uv.y * (RT - RG), 0.02);
  let sunDir = vec3f(sqrt(max(0.0, 1.0 - muS * muS)), muS, 0.0);
  let p0 = vec3f(0.0, r, 0.0);
  var L2 = vec3f(0.0);
  var Fms = vec3f(0.0);
  const SQ = 8;
  for (var i = 0; i < SQ; i++) {
    for (var j = 0; j < SQ; j++) {
      let th = 2.0 * PI * (f32(i) + 0.5) / f32(SQ);
      let cp = 1.0 - 2.0 * (f32(j) + 0.5) / f32(SQ);
      let sp = sqrt(max(0.0, 1.0 - cp * cp));
      let dir = vec3f(sp * cos(th), cp, sp * sin(th));
      let tG = distToGround(r, dir.y);
      let tMax = select(distToTop(r, dir.y), tG, tG > 0.0);
      const NS = 24;
      let dt = tMax / f32(NS);
      var T = vec3f(1.0);
      var Lp = vec3f(0.0);
      var Fp = vec3f(0.0);
      for (var k = 0; k < NS; k++) {
        let t = (f32(k) + 0.5) * dt;
        let p = p0 + dir * t;
        let rr = length(p);
        let up = p / rr;
        let m = mediumAt(rr - RG);
        let sS = m.scatR + vec3f(m.scatM);
        let Ts = sunTransmittance(tTrans, rr, dot(up, sunDir));
        let st = exp(-m.ext * dt);
        let S = sS * Ts / (4.0 * PI);
        Lp += T * (S - S * st) / max(m.ext, vec3f(1e-7));
        Fp += T * (sS - sS * st) / max(m.ext, vec3f(1e-7));
        T *= st;
      }
      if (tG > 0.0) {
        let pg = p0 + dir * tG;
        let up = normalize(pg);
        let mu = dot(up, sunDir);
        Lp += T * sunTransmittance(tTrans, RG, mu) * saturate(mu) * 0.55 / PI;
      }
      L2 += Lp;
      Fms += Fp;
    }
  }
  L2 /= f32(SQ * SQ);
  Fms /= f32(SQ * SQ);
  return vec4f(L2 / (1.0 - Fms), 1.0);
}`;

export const U_SKYVIEW = { camH: 'f32', sunDir: 'vec3f' };   // camH in km
export const FS_SKYVIEW = WGSL_COMMON + WGSL_ATMO + /* wgsl */ `
fn msLookup(r: f32, muS: f32) -> vec3f {
  var uv = vec2f(muS * 0.5 + 0.5, (r - RG) / (RT - RG));
  uv = (uv * 31.0 + 0.5) / 32.0;
  return textureSampleLevel(tMS, sLin, uv, 0.0).rgb;
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = (pos.xy - 0.5) / (SKY_SIZE - 1.0);
  let r = RG + max(u.camH, 0.01);
  let vHorizon = sqrt(max(r * r - RG * RG, 0.0));
  let beta = acos(clamp(vHorizon / r, -1.0, 1.0));
  let zha = PI - beta;
  var vz: f32;
  if (uv.y < 0.5) {
    var c = 2.0 * uv.y; c = 1.0 - c; c *= c; c = 1.0 - c;
    vz = zha * c;
  } else {
    var c = uv.y * 2.0 - 1.0; c *= c;
    vz = zha + beta * c;
  }
  let cvz = cos(vz);
  let svz = sin(vz);
  let c = uv.x * uv.x;
  let lvc = -(c * 2.0 - 1.0);
  let slv = sqrt(max(0.0, 1.0 - lvc * lvc));
  let dir = vec3f(svz * lvc, cvz, svz * slv);
  let sunH = length(u.sunDir.xz);
  let sunDir = vec3f(sunH, u.sunDir.y, 0.0);
  let tG = distToGround(r, dir.y);
  var tMax = select(distToTop(r, dir.y), tG, tG > 0.0);
  tMax = min(tMax, 900.0);
  let cosT = dot(dir, sunDir);
  let pR = rayleighPhase(cosT);
  let pM = cornetteShanks(cosT, 0.8);
  let p0 = vec3f(0.0, r, 0.0);
  var T = vec3f(1.0);
  var L = vec3f(0.0);
  const N = 40;
  var tPrev = 0.0;
  for (var i = 0; i < N; i++) {
    let f = (f32(i) + 0.5) / f32(N);
    let t = tMax * f * f;
    let tn = tMax * pow((f32(i) + 1.0) / f32(N), 2.0);
    let dt = tn - tPrev;
    tPrev = tn;
    let p = p0 + dir * t;
    let rr = length(p);
    let up = p / rr;
    let muS = dot(up, sunDir);
    let m = mediumAt(rr - RG);
    let Ts = sunTransmittance(tTrans, rr, muS);
    let ms = msLookup(rr, muS);
    let S = m.scatR * (Ts * pR + ms) + m.scatM * (Ts * pM + ms);
    let st = exp(-m.ext * dt);
    L += T * (S - S * st) / max(m.ext, vec3f(1e-7));
    T *= st;
  }
  return vec4f(L, 1.0);
}`;

// ambient: px0 = cosine weighted sky irradiance / PI (upper hemisphere), px1 = mean radiance near
// horizon, px2 / px3 = sky irradiance / PI on a vertical face turned toward / away from the sun
export const U_AMBIENT = { sunDir: 'vec3f', camH: 'f32' };
export const FS_AMBIENT = WGSL_COMMON + WGSL_ATMO + /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let px = i32(pos.x);
  var acc = vec3f(0.0);
  var w = 0.0;
  let face = normalize(vec3f(u.sunDir.x, 0.0, u.sunDir.z)) * select(-1.0, 1.0, px == 2);
  for (var i = 0; i < 24; i++) {
    for (var j = 0; j < 10; j++) {
      let ph = 2.0 * PI * (f32(i) + 0.5) / 24.0;
      var ct = (f32(j) + 0.5) / 10.0;
      if (px == 1) { ct = ct * 0.25; }
      let st = sqrt(1.0 - ct * ct);
      let d = vec3f(st * cos(ph), ct, st * sin(ph));
      let L = skyLookup(tSky, d, u.sunDir, u.camH);
      var wt = max(dot(d, face), 0.0);
      if (px == 0) { wt = ct; } else if (px == 1) { wt = 1.0; }
      acc += L * wt;
      w += wt;
    }
  }
  // px0: irradiance/PI = mean(L cos)/mean(cos) * ... ; uniform-in-cos sampling -> E = 2PI * mean(L cos)
  let r = select(acc / f32(240) * 2.0, acc / w, px == 1);
  return vec4f(r, 1.0);
}`;
