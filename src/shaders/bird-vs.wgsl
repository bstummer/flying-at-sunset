#include "chunks/common.wgsl"

// The bird's vertices, its wings flexed (bend and flutter, and a washout twist toward the tips);
// also the shadow map's
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
}