// Static textures, generated once: noise volumes (cloud shapes, detail), cirrus, the two high layers

import { GLSL_COMMON } from './common.js';

export const FS_NOISE3D = GLSL_COMMON + /* glsl */ `
uniform float uZ;
uniform float uSize;
uniform vec4 uCells;
uniform int uMode;
out vec4 o;
// field of random spheres in a tileable lattice; returns signed distance in cell units
float sphereField(vec3 p, float cells, uint seed) {
  vec3 pc = p * cells;
  vec3 id = floor(pc);
  vec3 f = pc - id;
  float d = 1.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o3 = vec3(x, y, z);
    vec3 c = mod(id + o3, cells);
    uvec3 ci = uvec3(c);
    vec3 h = hash33(ci + uvec3(seed * 101u, seed * 211u, seed * 307u));
    vec3 h2 = hash33(ci * 3u + uvec3(seed * 13u + 7u, seed * 5u + 1u, 11u));
    // (the large billows pack close; the small ones over them a little looser)
    bool big = seed <= 2u;
    if (h2.y < (big ? 0.1 : 0.16)) continue;
    vec3 center = o3 + 0.1 + 0.8 * h;
    float rad = big ? mix(0.4, 0.78, h2.x) : mix(0.36, 0.72, h2.x);
    d = min(d, length(center - f) - rad);
  }
  return d;
}
float worley(vec3 p, float cells, uint seed) {
  vec3 pc = p * cells;
  vec3 id = floor(pc);
  vec3 f = pc - id;
  float d = 1e9;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o3 = vec3(x, y, z);
    vec3 c = mod(id + o3, cells);
    vec3 h = hash33(uvec3(c) + uvec3(seed * 97u, seed * 193u, seed * 389u));
    vec3 q = o3 + h - f;
    d = min(d, dot(q, q));
  }
  return sqrt(d);
}
vec3 grad3(vec3 c, float period, uint seed) {
  vec3 h = hash33(uvec3(mod(c, period)) + uvec3(seed * 53u, seed * 59u, seed * 61u)) * 2.0 - 1.0;
  return normalize(h + 1e-4);
}
float perlin(vec3 p, float period, uint seed) {
  vec3 i = floor(p), f = p - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(grad3(i, period, seed), f);
  float n100 = dot(grad3(i + vec3(1, 0, 0), period, seed), f - vec3(1, 0, 0));
  float n010 = dot(grad3(i + vec3(0, 1, 0), period, seed), f - vec3(0, 1, 0));
  float n110 = dot(grad3(i + vec3(1, 1, 0), period, seed), f - vec3(1, 1, 0));
  float n001 = dot(grad3(i + vec3(0, 0, 1), period, seed), f - vec3(0, 0, 1));
  float n101 = dot(grad3(i + vec3(1, 0, 1), period, seed), f - vec3(1, 0, 1));
  float n011 = dot(grad3(i + vec3(0, 1, 1), period, seed), f - vec3(0, 1, 1));
  float n111 = dot(grad3(i + vec3(1, 1, 1), period, seed), f - vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
void main() {
  vec3 p = vec3(gl_FragCoord.xy / uSize, uZ);
  if (uMode == 0) {
    vec4 d = vec4(sphereField(p, uCells.x, 1u), sphereField(p, uCells.y, 2u), sphereField(p, uCells.z, 3u), sphereField(p, uCells.w, 4u));
    o = clamp(d * 0.5 + 0.5, 0.0, 1.0);
  } else {
    float w1 = 1.0 - worley(p, uCells.x, 5u);
    float w2 = 1.0 - worley(p, uCells.y, 6u);
    float w3 = 1.0 - worley(p, uCells.z, 7u);
    float wf = sat(w1 * 0.6 + w2 * 0.28 + w3 * 0.12);
    float pf = 0.0, amp = 0.5, per = uCells.x;
    for (int k = 0; k < 4; k++) { pf += amp * perlin(p * per, per, uint(9 + k)); amp *= 0.5; per *= 2.0; }
    pf = sat(pf * 0.9 + 0.5);
    float w4 = 1.0 - worley(p, uCells.w, 8u);
    o = vec4(wf, pf, sat(w3 * 0.6 + w4 * 0.4), sat(perlin(p * uCells.y, uCells.y, 21u) * 0.9 + 0.5));
  }
}`;

export const FS_CIRRUS = GLSL_COMMON + /* glsl */ `
uniform float uSize;
out vec4 o;
float vnoise(vec2 p, float per, uint seed) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash33(uvec3(uvec2(mod(i, per)), seed)).x;
  float b = hash33(uvec3(uvec2(mod(i + vec2(1, 0), per)), seed)).x;
  float c = hash33(uvec3(uvec2(mod(i + vec2(0, 1), per)), seed)).x;
  float d = hash33(uvec3(uvec2(mod(i + vec2(1, 1), per)), seed)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, float per, uint seed) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * vnoise(p * per, per, seed + uint(i)); a *= 0.5; per *= 2.0; }
  return s;
}
void main() {
  vec2 p = gl_FragCoord.xy / uSize;
  vec2 w = vec2(fbm(p, 4.0, 3u), fbm(p + 0.37, 4.0, 9u)) - 0.5;
  vec2 q = p + w * vec2(0.08, 0.25);
  // streaks: stretch the fine detail along x
  float base = fbm(q, 3.0, 17u);
  float streak = 0.0, a = 0.5, per = 4.0;
  for (int i = 0; i < 5; i++) {
    vec2 sp = vec2(q.x * per, q.y * per * 6.0);
    streak += a * vnoise(sp, per, 40u + uint(i)) ;
    a *= 0.55; per *= 2.0;
  }
  float c = sat((base - 0.47) * 3.2) * (0.35 + 0.9 * streak);
  float patchy = sat((fbm(p, 2.0, 77u) - 0.42) * 3.0);
  o = vec4(sat(c * patchy), streak, base, 1.0);
}`;

// thin high layers: r, g = density of the two layers (a few long patches drawn out along the
// wind, streaky inside), b = fine streaks. Tiles over 64 km.
export const FS_LAYERS = GLSL_COMMON + /* glsl */ `
uniform float uSize;
out vec4 o;
float vnoise(vec2 p, vec2 per, uint seed) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash33(uvec3(uvec2(mod(i, per)), seed)).x;
  float b = hash33(uvec3(uvec2(mod(i + vec2(1, 0), per)), seed)).x;
  float c = hash33(uvec3(uvec2(mod(i + vec2(0, 1), per)), seed)).x;
  float d = hash33(uvec3(uvec2(mod(i + vec2(1, 1), per)), seed)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, vec2 per, uint seed) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * vnoise(p * per, per, seed + uint(i)); a *= 0.5; per *= 2.0; }
  return s;
}
float layer(vec2 p, uint seed) {
  vec2 w = vec2(fbm(p, vec2(3.0, 6.0), seed + 60u), fbm(p + 0.31, vec2(3.0, 6.0), seed + 70u)) - 0.5;
  vec2 q = p + w * vec2(0.05, 0.03);
  float patchy = smoothstep(0.62, 0.76, fbm(q, vec2(2.0, 5.0), seed));         // a few long patches
  float body = smoothstep(0.32, 0.72, fbm(q, vec2(3.0, 20.0), seed + 20u));     // stretched along x
  float streak = fbm(q, vec2(6.0, 64.0), seed + 40u);
  return patchy * body * (0.45 + 0.75 * streak);
}
void main() {
  vec2 p = gl_FragCoord.xy / uSize;
  o = vec4(sat(layer(p, 101u)), sat(layer(p + vec2(0.43, 0.27), 151u)), fbm(p, vec2(8.0, 96.0), 211u), 1.0);
}`;
