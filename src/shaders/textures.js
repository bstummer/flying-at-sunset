// Static textures, generated once: noise volumes (cloud shapes, detail), cirrus, the two high layers

import { WGSL_COMMON } from './common.js';

export const U_NOISE3D = { z: 'f32', size: 'f32', mode: 'i32', cells: 'vec4f' };
export const FS_NOISE3D = WGSL_COMMON + /* wgsl */ `
// field of random spheres in a tileable lattice; returns signed distance in cell units
fn sphereField(p: vec3f, cells: f32, seed: u32) -> f32 {
  let pc = p * cells;
  let id = floor(pc);
  let f = pc - id;
  var d = 1.0;
  for (var z = -1; z <= 1; z++) {
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let o3 = vec3f(f32(x), f32(y), f32(z));
        let c = mod3(id + o3, vec3f(cells));
        let ci = vec3u(c);
        let h = hash33(ci + vec3u(seed * 101u, seed * 211u, seed * 307u));
        let h2 = hash33(ci * 3u + vec3u(seed * 13u + 7u, seed * 5u + 1u, 11u));
        // (the large billows pack close; the small ones over them a little looser)
        let big = seed <= 2u;
        if (h2.y < select(0.16, 0.1, big)) { continue; }
        let center = o3 + 0.1 + 0.8 * h;
        let rad = select(mix(0.36, 0.72, h2.x), mix(0.4, 0.78, h2.x), big);
        d = min(d, length(center - f) - rad);
      }
    }
  }
  return d;
}
fn worley(p: vec3f, cells: f32, seed: u32) -> f32 {
  let pc = p * cells;
  let id = floor(pc);
  let f = pc - id;
  var d = 1e9;
  for (var z = -1; z <= 1; z++) {
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let o3 = vec3f(f32(x), f32(y), f32(z));
        let c = mod3(id + o3, vec3f(cells));
        let h = hash33(vec3u(c) + vec3u(seed * 97u, seed * 193u, seed * 389u));
        let q = o3 + h - f;
        d = min(d, dot(q, q));
      }
    }
  }
  return sqrt(d);
}
fn grad3(c: vec3f, period: f32, seed: u32) -> vec3f {
  let h = hash33(vec3u(mod3(c, vec3f(period))) + vec3u(seed * 53u, seed * 59u, seed * 61u)) * 2.0 - 1.0;
  return normalize(h + 1e-4);
}
fn perlin(p: vec3f, period: f32, seed: u32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let n000 = dot(grad3(i, period, seed), f);
  let n100 = dot(grad3(i + vec3f(1.0, 0.0, 0.0), period, seed), f - vec3f(1.0, 0.0, 0.0));
  let n010 = dot(grad3(i + vec3f(0.0, 1.0, 0.0), period, seed), f - vec3f(0.0, 1.0, 0.0));
  let n110 = dot(grad3(i + vec3f(1.0, 1.0, 0.0), period, seed), f - vec3f(1.0, 1.0, 0.0));
  let n001 = dot(grad3(i + vec3f(0.0, 0.0, 1.0), period, seed), f - vec3f(0.0, 0.0, 1.0));
  let n101 = dot(grad3(i + vec3f(1.0, 0.0, 1.0), period, seed), f - vec3f(1.0, 0.0, 1.0));
  let n011 = dot(grad3(i + vec3f(0.0, 1.0, 1.0), period, seed), f - vec3f(0.0, 1.0, 1.0));
  let n111 = dot(grad3(i + vec3f(1.0, 1.0, 1.0), period, seed), f - vec3f(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, fu.x), mix(n010, n110, fu.x), fu.y), mix(mix(n001, n101, fu.x), mix(n011, n111, fu.x), fu.y), fu.z);
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = vec3f(pos.xy / u.size, u.z);
  if (u.mode == 0) {
    let d = vec4f(sphereField(p, u.cells.x, 1u), sphereField(p, u.cells.y, 2u), sphereField(p, u.cells.z, 3u), sphereField(p, u.cells.w, 4u));
    return clamp(d * 0.5 + 0.5, vec4f(0.0), vec4f(1.0));
  }
  let w1 = 1.0 - worley(p, u.cells.x, 5u);
  let w2 = 1.0 - worley(p, u.cells.y, 6u);
  let w3 = 1.0 - worley(p, u.cells.z, 7u);
  let wf = saturate(w1 * 0.6 + w2 * 0.28 + w3 * 0.12);
  var pf = 0.0;
  var amp = 0.5;
  var per = u.cells.x;
  for (var k = 0; k < 4; k++) { pf += amp * perlin(p * per, per, u32(9 + k)); amp *= 0.5; per *= 2.0; }
  pf = saturate(pf * 0.9 + 0.5);
  let w4 = 1.0 - worley(p, u.cells.w, 8u);
  return vec4f(wf, pf, saturate(w3 * 0.6 + w4 * 0.4), saturate(perlin(p * u.cells.y, u.cells.y, 21u) * 0.9 + 0.5));
}`;

export const U_SIZE = { size: 'f32' };
export const FS_CIRRUS = WGSL_COMMON + /* wgsl */ `
fn vnoise(p: vec2f, per: f32, seed: u32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * (3.0 - 2.0 * f);
  let a = hash33(vec3u(vec2u(mod2(i, vec2f(per))), seed)).x;
  let b = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 0.0), vec2f(per))), seed)).x;
  let c = hash33(vec3u(vec2u(mod2(i + vec2f(0.0, 1.0), vec2f(per))), seed)).x;
  let d = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 1.0), vec2f(per))), seed)).x;
  return mix(mix(a, b, fu.x), mix(c, d, fu.x), fu.y);
}
fn fbm(p: vec2f, per0: f32, seed: u32) -> f32 {
  var s = 0.0;
  var a = 0.5;
  var per = per0;
  for (var i = 0; i < 6; i++) { s += a * vnoise(p * per, per, seed + u32(i)); a *= 0.5; per *= 2.0; }
  return s;
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / u.size;
  let w = vec2f(fbm(p, 4.0, 3u), fbm(p + 0.37, 4.0, 9u)) - 0.5;
  let q = p + w * vec2f(0.08, 0.25);
  // streaks: stretch the fine detail along x
  let base = fbm(q, 3.0, 17u);
  var streak = 0.0;
  var a = 0.5;
  var per = 4.0;
  for (var i = 0; i < 5; i++) {
    let sp = vec2f(q.x * per, q.y * per * 6.0);
    streak += a * vnoise(sp, per, 40u + u32(i));
    a *= 0.55; per *= 2.0;
  }
  let c = saturate((base - 0.47) * 3.2) * (0.35 + 0.9 * streak);
  let patchy = saturate((fbm(p, 2.0, 77u) - 0.42) * 3.0);
  return vec4f(saturate(c * patchy), streak, base, 1.0);
}`;

// thin high layers: r, g = density of the two layers (a few long patches drawn out along the
// wind, streaky inside), b = fine streaks. Tiles over 64 km.
export const FS_LAYERS = WGSL_COMMON + /* wgsl */ `
fn vnoise(p: vec2f, per: vec2f, seed: u32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * (3.0 - 2.0 * f);
  let a = hash33(vec3u(vec2u(mod2(i, per)), seed)).x;
  let b = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 0.0), per)), seed)).x;
  let c = hash33(vec3u(vec2u(mod2(i + vec2f(0.0, 1.0), per)), seed)).x;
  let d = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 1.0), per)), seed)).x;
  return mix(mix(a, b, fu.x), mix(c, d, fu.x), fu.y);
}
fn fbm(p: vec2f, per0: vec2f, seed: u32) -> f32 {
  var s = 0.0;
  var a = 0.5;
  var per = per0;
  for (var i = 0; i < 6; i++) { s += a * vnoise(p * per, per, seed + u32(i)); a *= 0.5; per *= 2.0; }
  return s;
}
fn layer(p: vec2f, seed: u32) -> f32 {
  let w = vec2f(fbm(p, vec2f(3.0, 6.0), seed + 60u), fbm(p + 0.31, vec2f(3.0, 6.0), seed + 70u)) - 0.5;
  let q = p + w * vec2f(0.05, 0.03);
  let patchy = smoothstep(0.62, 0.76, fbm(q, vec2f(2.0, 5.0), seed));         // a few long patches
  let body = smoothstep(0.32, 0.72, fbm(q, vec2f(3.0, 20.0), seed + 20u));     // stretched along x
  let streak = fbm(q, vec2f(6.0, 64.0), seed + 40u);
  return patchy * body * (0.45 + 0.75 * streak);
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / u.size;
  return vec4f(saturate(layer(p, 101u)), saturate(layer(p + vec2f(0.43, 0.27), 151u)), fbm(p, vec2f(8.0, 96.0), 211u), 1.0);
}`;

// the next mip level of the high layers (seen at grazing angles far away): each texel the mean of
// the four below it
export const FS_MIP = /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  return textureSampleLevel(tSrc, sLin, pos.xy / u.size, 0.0);
}`;
