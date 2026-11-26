#include "chunks/common.wgsl"
#include "chunks/ambient.wgsl"
#include "chunks/probe.wgsl"

// The paper: fibres, the sun through the bird's shadow map (paper layers let some light through),
// translucency when backlit, the light of the sky and the sea of clouds by the way each facet faces
// (bAmb, bProbe: toward the low sun's bright horizon gold, away from it blue, from below the sea's),
// so the folds shade apart in shade too; in cloud the glowing mist's, more from the sun's side, and
// a little of the camera's mist in front of it
struct Varyings { @builtin(position) pos: vec4f, @location(0) wpos: vec3f, @location(1) obj: vec3f, @location(2) shadow: vec4f, @location(3) panel: f32 }
fn vnoise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * (3.0 - 2.0 * f);
  let c = vec3u(vec3i(i) + 4096);
  let a = hash33(c).x;
  let b = hash33(c + vec3u(1u, 0u, 0u)).x;
  let cc = hash33(c + vec3u(0u, 1u, 0u)).x;
  let d = hash33(c + vec3u(1u, 1u, 0u)).x;
  let e = hash33(c + vec3u(0u, 0u, 1u)).x;
  let f1 = hash33(c + vec3u(1u, 0u, 1u)).x;
  let g = hash33(c + vec3u(0u, 1u, 1u)).x;
  let h = hash33(c + vec3u(1u, 1u, 1u)).x;
  return mix(mix(mix(a, b, fu.x), mix(cc, d, fu.x), fu.y), mix(mix(e, f1, fu.x), mix(g, h, fu.x), fu.y), fu.z);
}
// the sky's and the sea's light on a facet turned N (irradiance / π): the faces bAmb holds (upward;
// upright toward and away from the sun, their upper half) and the sea's from below (ambDn), half of
// which an upright face sees, blended by N's components squared (an ambient cube); in cloud the
// sky's dimmed (ambUp.a). The sky's light and the shade's tints are the trace's (trace.wgsl): paper
// in shade a little darker than a cloud in it (half as strong again, it was as pale, a ghost).
fn skyOn(N: vec3f) -> vec3f {
  let occ = bProbe.ambUp.a;
  let dn = bProbe.ambDn.rgb / PI;
  let s = normalize(vec3f(u.sunDir.x, 0.0, u.sunDir.z));
  let ns = dot(N, s);
  let nt = dot(N, vec3f(-s.z, 0.0, s.x));
  let up = bAmb.up.rgb * vec3f(0.88, 0.96, 1.2) * occ;
  let toward = bAmb.sunSide.rgb * occ + 0.5 * dn;
  let away = bAmb.antiSun.rgb * vec3f(1.03, 0.92, 1.18) * occ + 0.5 * dn;
  return N.y * N.y * select(dn, up, N.y > 0.0) + ns * ns * select(away, toward, ns > 0.0) + nt * nt * 0.5 * (toward + away);
}
fn shadowAt(sp: vec4f) -> f32 {
  let s = sp.xyz / sp.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) { return 1.0; }
  var acc = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      acc += textureSampleCompareLevel(tShadowMap, sShadow, s.xy + vec2f(f32(x), f32(y)) * u.shadowTexel * 1.2, s.z - 0.0025);
    }
  }
  return acc / 9.0;
}
@fragment fn fs(v: Varyings) -> @location(0) vec4f {
  let Nr = cross(dpdx(v.wpos), dpdy(v.wpos));
  var N = select(vec3f(0.0, 1.0, 0.0), normalize(Nr), dot(Nr, Nr) > 1e-20);
  let V = normalize(-v.wpos);
  if (dot(N, V) < 0.0) { N = -N; }
  let sun = bProbe.sun;
  let mist = bProbe.medium;
  let mistL = bProbe.mistL.rgb;

  // paper fibres
  let fib = vnoise3(v.obj * 160.0) * 0.55 + vnoise3(v.obj * vec3f(520.0, 520.0, 90.0)) * 0.45;
  let blot = vnoise3(v.obj * 34.0);
  let albedo = vec3f(0.93, 0.905, 0.855) * (0.955 + 0.07 * fib) * (0.985 + 0.03 * blot) * (1.0 - 0.035 * v.panel);
  let NL = dot(N, u.sunDir);
  let sh = shadowAt(v.shadow);
  let layer = mix(0.2, 1.0, sh);   // paper layers let some light through
  let sunC = sun.rgb;
  var col = albedo * sunC * max(NL, 0.0) * layer / PI;
  // translucency: light diffusing through the thin sheet. Strongest when looking toward the sun
  // through the paper (sun behind the bird), with the fibres showing in the glow.
  let thick = 0.85 + 0.3 * fib + 0.25 * (blot - 0.5);
  let transCol = vec3f(1.0, 0.78, 0.5);
  let back = max(-NL, 0.0);                                   // sun on the far side of this face
  let vdl = pow(saturate(dot(-V, u.sunDir)), 3.0);           // looking toward the sun
  let wrapT = saturate(0.5 - NL) * vdl;                       // grazing / backlit sheets still glow
  col += albedo * transCol * sunC * (back * 0.55 + wrapT * 1.1) * layer / (thick * PI);
  // the sky's and the sea's light; inside cloud the glowing mist's, from all around but more from
  // the sun's side and above (0.4–1.2 of its radiance: evenly lit, the paper was the mist's colour, a
  // ghost)
  let inC = saturate(max(mist.x, mist.y) / 0.008);
  let mistOn = mistL * (0.8 + 0.4 * dot(N, normalize(u.sunDir + vec3f(0.0, 0.6, 0.0))));
  col += albedo * mix(skyOn(N), mistOn, inC);
  // faint sheen at grazing angles
  let H = normalize(V + u.sunDir);
  let spec = pow(max(dot(N, H), 0.0), 24.0) * 0.06 * max(NL, 0.0);
  col += sunC * spec * layer;
  // mist between the camera and the bird when flying through cloud: 0.4 of what lies there (4 m of
  // a cloud's core hid the bird's facets; beautiful wins)
  let dist = length(v.wpos);
  let tm = exp(-mist.x * dist * 0.4);
  col = col * tm + mistL * (1.0 - tm);
  return vec4f(col, 1.0);
}