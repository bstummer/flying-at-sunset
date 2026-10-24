// Drifting mist: soft puffs near the camera
// Each puff lives in a wrapped 180 m cell around the camera, samples the real cloud density at its
// position and is lit with the same model as the volume, so it only shows where cloud really is.

import { GLSL_COMMON } from './common.js';
import { GLSL_CLOUD } from './cloud.js';

export const VS_MIST = GLSL_COMMON + GLSL_CLOUD + /* glsl */ `
uniform vec3 uCamPos;
uniform vec3 uCamOffset;
uniform vec3 uCamRight, uCamUp;
uniform mat4 uViewProj;
uniform sampler2D uAmb;
uniform float uStrength;
out vec2 vUv;
out vec4 vCol;
out float vSeed;
const float CELL = 180.0;
void main() {
  vec3 h3 = hash33(uvec3(gl_InstanceID, 17, 71));
  vec3 h4 = hash33(uvec3(gl_InstanceID, 5, 13));
  vec3 rel = mod(h3 * CELL - uCamOffset, CELL) - CELL * 0.5;
  float dist = length(rel);
  vec3 wp = uCamPos + rel;
  float h = wp.y;
  vec4 C = colAt(wp.xz, 0);
  float dm = macroAt(vec3(wp.x, h, wp.z), 0);
  float d = dm - shellOf(C.y) - LV_MARGIN[0];
  float dens = 0.0;
  if (d <= 0.0) { d = cloudSDF(wp, h, dm, C, 0.0); dens = densityFromSDF(d, wp, 1.0, 32.0, 1.0); }
  float alpha = sat(dens * 1.6) * (1.0 - smoothstep(52.0, 84.0, dist)) * smoothstep(4.0, 12.0, dist) * uStrength;
  vec3 col = vec3(0.0);
  if (alpha > 0.002) {
    float tau = lightTau(wp, h, 0, C, 0.5, 0.0);
    float farT = exp(-tsvTau(wp, h));
    vec3 ambSky = texelFetch(uAmb, ivec2(0, 0), 0).rgb;
    float cosT = dot(rel / max(dist, 1e-3), uSunDir);
    float di = max(-d, 0.0);
    col = sunColorAt(h) * ((msScatterP(tau, phaseOctaves(cosT)) + 0.032 / (1.0 + 0.025 * tau) * (1.0 - exp(-di / 80.0))) * farT + 0.007 * (1.0 - farT))
        + ambSky * 1.95 * mix(0.5, 1.0, exp(-di / 55.0));
  }
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  float size = mix(9.0, 26.0, h4.x);
  float a = h4.y * 6.2831853;
  vec2 rc = mat2(cos(a), sin(a), -sin(a), cos(a)) * c;
  vec3 pos = rel + (uCamRight * rc.x + uCamUp * rc.y) * size;
  gl_Position = uViewProj * vec4(pos, 1.0);
  vUv = c;
  vSeed = h4.z * 97.0;
  vCol = vec4(col * alpha, alpha);
}`;
export const FS_MIST = GLSL_COMMON + /* glsl */ `
in vec2 vUv;
in vec4 vCol;
in float vSeed;
out vec4 o;
float vn(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  uvec3 c = uvec3(ivec3(ivec2(i) + 512, int(vSeed)));
  float a = hash33(c).x, b = hash33(c + uvec3(1, 0, 0)).x, cc = hash33(c + uvec3(0, 1, 0)).x, d = hash33(c + uvec3(1, 1, 0)).x;
  return mix(mix(a, b, u.x), mix(cc, d, u.x), u.y);
}
void main() {
  float r = length(vUv);
  float a = 1.0 - smoothstep(0.15, 1.0, r);
  float n = vn(vUv * 2.5) * 0.6 + vn(vUv * 5.5 + 3.1) * 0.4;
  a *= a * sat(n * 1.6 - 0.15);
  o = vCol * a;
}`;
