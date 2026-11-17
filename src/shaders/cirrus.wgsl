#include "chunks/common.wgsl"
#include "chunks/vnoise.wgsl"

// The cirrus tile: patchy, warped value-noise fbm with fine streaks along x (r: its density, g: the
// streaks, b: the broad pattern)
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / u.size;
  let w = vec2f(fbm(p, vec2f(4.0), 3u), fbm(p + 0.37, vec2f(4.0), 9u)) - 0.5;
  let q = p + w * vec2f(0.08, 0.25);
  // streaks: stretch the fine detail along x
  let base = fbm(q, vec2f(3.0), 17u);
  var streak = 0.0;
  var a = 0.5;
  var per = 4.0;
  for (var i = 0; i < 5; i++) {
    let sp = vec2f(q.x * per, q.y * per * 6.0);
    streak += a * vnoise(sp, vec2f(per), 40u + u32(i));
    a *= 0.55; per *= 2.0;
  }
  let c = saturate((base - 0.47) * 3.2) * (0.35 + 0.9 * streak);
  let patchy = saturate((fbm(p, vec2f(2.0), 77u) - 0.42) * 3.0);
  return vec4f(saturate(c * patchy), streak, base, 1.0);
}