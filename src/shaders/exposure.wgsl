#include "chunks/common.wgsl"
#include "chunks/exposure.wgsl"

// The exposure (struct Exposure, bExpo), from what the frame shows: the log-mean luminance of the
// bloom chain's coarsest level (each texel the mean of a block of the frame: the sun's disk counts
// as the block it lies in, not as a thousand times the sky), and how much of the frame is the fog of
// the camera's own cloud (the trace's second target: the light that gets through it), each adapted
// to over time. Outside cloud the exposure is the normal one. In the fog the gain follows the frame
// toward LREF, by the square root of how far it is (a cloud in shadow stays darker than a sunlit one:
// fully adapted, flying through dark cloud turned the screen bright), and only as far as the fog
// fills the frame (by the point at the camera, the open half of a view from a cloud's edge washed
// out with the rest). One workgroup: its threads share the reads, then add them up.
const LREF = -2.3;    // the log-mean luminance the gain aims at (before the exposure)
const GAIN_P = 0.5;   // how much of the way
const GAIN_MAX = 4.0;
const RATE = 2.0;     // 1/s: eyes and cameras adapt in a second or so
const N = 64u;
const GX = 24u;       // the fog over a grid of GX × GY points of the trace
const GY = 14u;
var<workgroup> acc: array<vec2f, 64>;
@compute @workgroup_size(64) fn cs(@builtin(local_invocation_index) li: u32) {
  let n = textureDimensions(tSrc);
  var s = vec2f(0.0);
  for (var k = li; k < n.x * n.y; k += N) { s.x += log(max(luma(textureLoad(tSrc, vec2u(k % n.x, k / n.x), 0).rgb), 1e-7)); }
  for (var k = li; k < GX * GY; k += N) {
    let p = vec2i((vec2f(f32(k % GX), f32(k / GX)) + 0.5) / vec2f(f32(GX), f32(GY)) * u.lowRes);
    s.y += 1.0 - textureLoad(tCurDepth, p, 0).g;
  }
  acc[li] = s;
  workgroupBarrier();
  for (var w = N / 2u; w > 0u; w /= 2u) {
    if (li < w) { acc[li] += acc[li + w]; }
    workgroupBarrier();
  }
  if (li != 0u) { return; }
  let m = acc[0].x / f32(n.x * n.y);
  let f = acc[0].y / f32(GX * GY);
  // (the first frame starts adapted)
  let k = select(1.0 - exp(-u.dt * RATE), 1.0, u.snap > 0.5);
  let a = mix(bExpo.adapted, m, k);
  let fog = mix(bExpo.fog, f, k);
  let g = clamp(exp(GAIN_P * (LREF - a)), 1.0, GAIN_MAX);
  bExpo.mean = m;
  bExpo.adapted = a;
  bExpo.fog = fog;
  bExpo.exposure = u.base * pow(g, fog);
}
