#include "chunks/common.wgsl"
#include "chunks/cloud.wgsl"
#include "chunks/ambient.wgsl"

// A mist puff (one instance) in its wrapped cell around the camera: the cloud's density and light
// there (the volume's model), on a quad facing the camera
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
    let ambSky = bAmb.up.rgb;
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
}