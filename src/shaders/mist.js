// Drifting mist: soft puffs near the camera
// Each puff lives in a wrapped 180 m cell around the camera, samples the real cloud density at its
// position and is lit with the same model as the volume, so it only shows where cloud really is.

import { WGSL_COMMON } from './common.js';
import { U_CLIP, U_CLOUD, WGSL_CLOUD } from './cloud.js';

export const U_MIST = {
  ...U_CLIP, ...U_CLOUD,
  viewProj: 'mat4x4f',
  camPos: 'vec3f', strength: 'f32', camOffset: 'vec3f', camRight: 'vec3f', camUp: 'vec3f',
};
export const VS_MIST = WGSL_COMMON + WGSL_CLOUD + /* wgsl */ `
struct Varyings { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) seed: f32 }
const CELL = 180.0;
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Varyings {
  let h3 = hash33(vec3u(ii, 17u, 71u));
  let h4 = hash33(vec3u(ii, 5u, 13u));
  let rel = mod3(h3 * CELL - u.camOffset, vec3f(CELL)) - CELL * 0.5;
  let dist = length(rel);
  let wp = u.camPos + rel;
  let h = wp.y;
  let C = colAt(wp.xz, 0);
  let dm = macroAt(vec3f(wp.x, h, wp.z), 0);
  var d = dm - shellOf(C.y) - lvMargin(0);
  var dens = 0.0;
  if (d <= 0.0) { d = cloudSDF(wp, h, dm, C, 0.0); dens = densityFromSDF(d, wp, 1.0, 32.0, 1.0); }
  let alpha = saturate(dens * 1.6) * (1.0 - smoothstep(52.0, 84.0, dist)) * smoothstep(4.0, 12.0, dist) * u.strength;
  var col = vec3f(0.0);
  if (alpha > 0.002) {
    let tau = lightTau(wp, h, 0, C, 0.5, 0.0);
    let farT = exp(-tsvTau(wp, h));
    let ambSky = textureLoad(tAmb, vec2i(0, 0), 0).rgb;
    let cosT = dot(rel / max(dist, 1e-3), u.sunDir);
    let di = max(-d, 0.0);
    col = sunColorAt(h) * ((msScatterP(tau, phaseOctaves(cosT)) + 0.032 / (1.0 + 0.025 * tau) * (1.0 - exp(-di / 80.0))) * farT + 0.007 * (1.0 - farT))
        + ambSky * 1.95 * mix(0.5, 1.0, exp(-di / 55.0));
  }
  let c = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let size = mix(9.0, 26.0, h4.x);
  let a = h4.y * 6.2831853;
  let rc = mat2x2f(cos(a), sin(a), -sin(a), cos(a)) * c;
  let p = rel + (u.camRight * rc.x + u.camUp * rc.y) * size;
  var o: Varyings;
  o.pos = toClip(u.viewProj * vec4f(p, 1.0));
  o.uv = c;
  o.seed = h4.z * 97.0;
  o.col = vec4f(col * alpha, alpha);
  return o;
}`;
export const FS_MIST = WGSL_COMMON + /* wgsl */ `
struct Varyings { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) seed: f32 }
fn vn(p: vec2f, seed: f32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * (3.0 - 2.0 * f);
  let c = vec3u(vec3i(vec2i(i) + 512, i32(seed)));
  let a = hash33(c).x;
  let b = hash33(c + vec3u(1u, 0u, 0u)).x;
  let cc = hash33(c + vec3u(0u, 1u, 0u)).x;
  let d = hash33(c + vec3u(1u, 1u, 0u)).x;
  return mix(mix(a, b, fu.x), mix(cc, d, fu.x), fu.y);
}
@fragment fn fs(v: Varyings) -> @location(0) vec4f {
  let r = length(v.uv);
  var a = 1.0 - smoothstep(0.15, 1.0, r);
  let n = vn(v.uv * 2.5, v.seed) * 0.6 + vn(v.uv * 5.5 + 3.1, v.seed) * 0.4;
  a *= a * saturate(n * 1.6 - 0.15);
  return v.col * a;
}`;
