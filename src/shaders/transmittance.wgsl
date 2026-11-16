#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"

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
}