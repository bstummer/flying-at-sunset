// The paper bird: its shading and its shadow map

import { WGSL_COMMON } from './common.js';

export const U_BIRD = {
  model: 'mat4x4f', viewProj: 'mat4x4f', shadowVP: 'mat4x4f',
  flex: 'vec4f',        // x: bend angle, y: tip twist, z: flutter
  sunDir: 'vec3f', shadowTexel: 'f32',
};
// (also the shadow map's vertex shader, with viewProj = shadowVP)
export const VS_BIRD = WGSL_COMMON + /* wgsl */ `
struct Varyings { @builtin(position) pos: vec4f, @location(0) wpos: vec3f, @location(1) obj: vec3f, @location(2) shadow: vec4f, @location(3) panel: f32 }
// aAttr: x: wing flex weight, y: side (-1, 0, 1), z: panel shade
@vertex fn vs(@location(0) aPos: vec3f, @location(1) aAttr: vec3f) -> Varyings {
  var p = aPos;
  let w = aAttr.x;
  let side = aAttr.y;
  if (w > 0.0) {
    let ang = side * (u.flex.x * w + u.flex.z * w * w);
    let c = cos(ang);
    let s = sin(ang);
    p = vec3f(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
    // washout twist at the tip (rotate around the span axis)
    let tw = u.flex.y * w * w;
    let ct = cos(tw);
    let st = sin(tw);
    let y0 = p.y - 0.09;
    p = vec3f(p.x, 0.09 + ct * y0 - st * p.z, st * y0 + ct * p.z);
  }
  var o: Varyings;
  o.obj = aPos;
  o.panel = aAttr.z;
  let wp = u.model * vec4f(p, 1.0);
  o.wpos = wp.xyz;
  o.shadow = u.shadowVP * wp;
  o.pos = toClip(u.viewProj * wp);
  return o;
}`;

export const FS_BIRD = WGSL_COMMON + /* wgsl */ `
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
  let sun = textureLoad(tProbe, vec2i(0, 0), 0);
  let ambUp = textureLoad(tProbe, vec2i(1, 0), 0).rgb;
  let ambDn = textureLoad(tProbe, vec2i(2, 0), 0).rgb;
  let mist = textureLoad(tProbe, vec2i(3, 0), 0);
  let mistL = textureLoad(tProbe, vec2i(4, 0), 0).rgb;

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
  // soft sky & cloud-sea light; inside cloud the glowing mist lights the paper from all around
  let up = N.y * 0.5 + 0.5;
  let inC = saturate(max(mist.x, mist.y) / 0.008);
  col += albedo * mix(mix(ambDn, ambUp * 1.5, up) / PI, mistL * 0.95, inC);
  // faint sheen at grazing angles
  let H = normalize(V + u.sunDir);
  let spec = pow(max(dot(N, H), 0.0), 24.0) * 0.06 * max(NL, 0.0);
  col += sunC * spec * layer;
  // mist between the camera and the bird when flying through cloud
  let dist = length(v.wpos);
  let tm = exp(-mist.x * dist);
  col = col * tm + mistL * (1.0 - tm);
  return vec4f(col, 1.0);
}`;
