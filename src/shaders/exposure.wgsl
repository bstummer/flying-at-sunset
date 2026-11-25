#include "chunks/common.wgsl"
#include "chunks/exposure.wgsl"

// The exposure (struct Exposure, bExpo), metered from what the frame shows as a photographer
// meters it at golden hour, for its light, in cloud and out alike: a level of the bloom chain about
// 60 texels across (each the mean of a block of the frame; the sun's disk counts as the block it
// lies in, not as a thousand times the sky), and the luminance its brightest tenth starts at (a
// histogram of quarter stops, read between its bins). Where that lies under HREF, the gain over the
// base exposure lifts it GAIN_Q of the way there: a frame of shade with a few sunlit tops is lifted
// until the tops are bright, a frame with sunlit faces keeps the base, as does a frame toward the
// sun (the gain never darkens), and fog, which has no highlights, is lifted most; never the whole
// way, so shade stays darker than sunlight and a cloud in shadow darker than a sunlit one. Adapted
// to over time in stops, faster down than up, as eyes do. And the frame's mean light, for the
// lens's veiling glare (shaders/final.wgsl). One workgroup: its threads share the reads into a
// histogram and a sum.
const HREF = -2.75;    // ln: where the brightest tenth is lifted toward (before the exposure)
const GAIN_Q = 0.7;    // how much of the way
const GAIN_MAX = 4.0;
const RATE_UP = 1.5;   // 1/s: brighter over a second or so
const RATE_DOWN = 3.0; // 1/s: darker twice as fast (into the sun)
const N = 64u;
const BINS = 64u;      // the histogram: log2 luminance in quarter stops from LO2 up
const LO2 = -14.0;
const LN2 = 0.6931472;
const MEAN_MAX = 1.0;  // the mean light takes a texel's up to this: the sun's disk as bright sky (its own glare
                       // would wash the view into it out)
var<workgroup> hist: array<atomic<u32>, 64>;
var<workgroup> acc: array<vec3f, 64>;
@compute @workgroup_size(64) fn cs(@builtin(local_invocation_index) li: u32) {
  let n = textureDimensions(tSrc);
  atomicStore(&hist[li], 0u);
  workgroupBarrier();
  var s = vec3f(0.0);
  for (var k = li; k < n.x * n.y; k += N) {
    let c = textureLoad(tSrc, vec2u(k % n.x, k / n.x), 0).rgb;
    let l = max(luma(c), 1e-7);
    s += min(c, vec3f(MEAN_MAX));
    atomicAdd(&hist[u32(clamp((log2(l) - LO2) * 4.0, 0.0, f32(BINS - 1u)))], 1u);
  }
  acc[li] = s;
  workgroupBarrier();
  for (var w = N / 2u; w > 0u; w /= 2u) {
    if (li < w) { acc[li] += acc[li + w]; }
    workgroupBarrier();
  }
  if (li != 0u) { return; }
  bExpo.mean = vec4f(acc[0] / f32(n.x * n.y), 0.0);
  // the brightest tenth: down from the top bin until a tenth of the texels lie above, then where in
  // that bin the tenth begins, as if its texels were spread evenly over it (ln)
  let tenth = f32(n.x * n.y) * 0.1;
  var above = 0.0;
  var b = BINS;
  var inBin = 0.0;
  while (b > 0u && above < tenth) {
    b -= 1u;
    inBin = f32(atomicLoad(&hist[b]));
    above += inBin;
  }
  let hi = (LO2 + (f32(b) + saturate((above - tenth) / max(inBin, 1.0))) * 0.25) * LN2;
  let g = clamp(exp(GAIN_Q * (HREF - hi)), 1.0, GAIN_MAX);
  // (the first frame starts adapted; time stopped, it holds)
  let rate = select(RATE_UP, RATE_DOWN, g < bExpo.gain);
  let k = select(1.0 - exp(-u.dt * rate), 1.0, u.snap > 0.5);
  let ga = exp(mix(log(max(bExpo.gain, 1.0)), log(g), k));
  bExpo.high = hi;
  bExpo.asked = g;
  bExpo.gain = ga;
  bExpo.exposure = u.base * ga;
}
