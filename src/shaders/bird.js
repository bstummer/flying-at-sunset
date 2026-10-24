// The paper bird: its shading and its shadow map

import { GLSL_COMMON } from './common.js';

export const VS_BIRD = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aAttr;     // x: wing flex weight, y: side (-1, 0, 1), z: panel shade
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat4 uShadowVP;
uniform vec4 uFlex;     // x: bend angle, y: tip twist, z: flutter
out vec3 vPos;
out vec3 vObj;
out vec4 vShadow;
out float vPanel;
void main() {
  vec3 p = aPos;
  float w = aAttr.x, side = aAttr.y;
  if (w > 0.0) {
    float ang = side * (uFlex.x * w + uFlex.z * w * w);
    float c = cos(ang), s = sin(ang);
    p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    // washout twist at the tip (rotate around the span axis)
    float tw = uFlex.y * w * w;
    float ct = cos(tw), st = sin(tw);
    float y0 = p.y - 0.09;
    p.yz = vec2(0.09 + ct * y0 - st * p.z, st * y0 + ct * p.z);
  }
  vObj = aPos;
  vPanel = aAttr.z;
  vec4 wp = uModel * vec4(p, 1.0);
  vPos = wp.xyz;
  vShadow = uShadowVP * wp;
  gl_Position = uViewProj * wp;
}`;

export const FS_BIRD = GLSL_COMMON + /* glsl */ `
in vec3 vPos;
in vec3 vObj;
in vec4 vShadow;
in float vPanel;
uniform sampler2D uProbe;
uniform sampler2DShadow uShadowMap;
uniform vec3 uSunDir;
uniform float uShadowTexel;
out vec4 o;
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = p - i;
  vec3 u = f * f * (3.0 - 2.0 * f);
  uvec3 c = uvec3(ivec3(i) + 4096);
  float a = hash33(c).x, b = hash33(c + uvec3(1, 0, 0)).x, cc = hash33(c + uvec3(0, 1, 0)).x, d = hash33(c + uvec3(1, 1, 0)).x;
  float e = hash33(c + uvec3(0, 0, 1)).x, f1 = hash33(c + uvec3(1, 0, 1)).x, g = hash33(c + uvec3(0, 1, 1)).x, h = hash33(c + uvec3(1, 1, 1)).x;
  return mix(mix(mix(a, b, u.x), mix(cc, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
float shadowAt(vec4 sp) {
  vec3 s = sp.xyz / sp.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return 1.0;
  float acc = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++)
    acc += texture(uShadowMap, vec3(s.xy + vec2(x, y) * uShadowTexel * 1.2, s.z - 0.0025));
  return acc / 9.0;
}
void main() {
  vec3 Nr = cross(dFdx(vPos), dFdy(vPos));
  vec3 N = dot(Nr, Nr) > 1e-20 ? normalize(Nr) : vec3(0.0, 1.0, 0.0);
  vec3 V = normalize(-vPos);
  if (dot(N, V) < 0.0) N = -N;
  vec4 sun = texelFetch(uProbe, ivec2(0, 0), 0);
  vec3 ambUp = texelFetch(uProbe, ivec2(1, 0), 0).rgb;
  vec3 ambDn = texelFetch(uProbe, ivec2(2, 0), 0).rgb;
  vec4 mist = texelFetch(uProbe, ivec2(3, 0), 0);
  vec3 mistL = texelFetch(uProbe, ivec2(4, 0), 0).rgb;

  // paper fibres
  float fib = vnoise3(vObj * 160.0) * 0.55 + vnoise3(vObj * vec3(520.0, 520.0, 90.0)) * 0.45;
  float blot = vnoise3(vObj * 34.0);
  vec3 albedo = vec3(0.93, 0.905, 0.855) * (0.955 + 0.07 * fib) * (0.985 + 0.03 * blot) * (1.0 - 0.035 * vPanel);
  float NL = dot(N, uSunDir);
  float sh = shadowAt(vShadow);
  float layer = mix(0.2, 1.0, sh);   // paper layers let some light through
  vec3 sunC = sun.rgb;
  vec3 col = albedo * sunC * max(NL, 0.0) * layer / PI;
  // translucency: light diffusing through the thin sheet. Strongest when looking toward the sun
  // through the paper (sun behind the bird), with the fibres showing in the glow.
  float thick = 0.85 + 0.3 * fib + 0.25 * (blot - 0.5);
  vec3 transCol = vec3(1.0, 0.78, 0.5);
  float back = max(-NL, 0.0);                                   // sun on the far side of this face
  float vdl = pow(sat(dot(-V, uSunDir)), 3.0);                 // looking toward the sun
  float wrapT = sat(0.5 - NL) * vdl;                           // grazing / backlit sheets still glow
  col += albedo * transCol * sunC * (back * 0.55 + wrapT * 1.1) * layer / (thick * PI);
  // soft sky & cloud-sea light; inside cloud the glowing mist lights the paper from all around
  float up = N.y * 0.5 + 0.5;
  float inC = sat(max(mist.x, mist.y) / 0.008);
  col += albedo * mix(mix(ambDn, ambUp * 1.5, up) / PI, mistL * 0.95, inC);
  // faint sheen at grazing angles
  vec3 H = normalize(V + uSunDir);
  float spec = pow(max(dot(N, H), 0.0), 24.0) * 0.06 * max(NL, 0.0);
  col += sunC * spec * layer;
  // mist between the camera and the bird when flying through cloud
  float dist = length(vPos);
  float tm = exp(-mist.x * dist);
  col = col * tm + mistL * (1.0 - tm);
  o = vec4(col, 1.0);
}`;

export const FS_SHADOW = /* glsl */ `#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(1.0); }`;
