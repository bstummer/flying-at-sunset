#include "chunks/common.wgsl"
#include "chunks/vnoise.wgsl"

// The two thin high layers' tile: a few long patches, stretched along x and streaky inside (r, g:
// the two layers; b: fine streaks)
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
}