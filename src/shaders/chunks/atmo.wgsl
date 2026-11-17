
// The atmosphere (Rayleigh, Mie, ozone; lengths in km), phase functions, and lookups into the
// transmittance and sky-view tables (shaders/sky.js)
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
// Henyey-Greenstein: the clouds, the cirrus, the high layers
fn HG(c: f32, g: f32) -> f32 {
  let g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
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
