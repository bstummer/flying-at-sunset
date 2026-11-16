#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"

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
}