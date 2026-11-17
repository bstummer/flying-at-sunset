#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"

// The multiple-scattering table (Hillaire 2020): by the sun's angle and the height, the light
// scattered twice over 8 × 8 directions, summed over all orders as a geometric series
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
}