// Whether the GPU's timestamps may steer the resolution (render/resolution.js). A frame's GPU time
// can't be longer than the time between frames on average: the GPU finishes a frame for every frame
// shown, or the frames would come slower. The time a frame is the span from its first pass's start
// to its last pass's end (render/timing.js): on a tile-based GPU (a phone's Mali, leg 12) passes
// overlap, and their own times summed said 3.5 times what the frames took, while the span matched
// the mean time between frames within 10%. The span is held to that mean (the median time between
// frames can't judge: where the GPU falls behind, frames come in bursts, half 16.7 ms apart and
// the rest 50–130); over RATIO times it for WINDOWS whiles in a row (render/resolution.js: 30
// frames each), and the timestamps are distrusted for good (frame times steer). Pure:
// tests/gputrust.test.js.

const RATIO = 1.15, WINDOWS = 2;

export function timestampTrust() {
  let over = 0;
  return {
    trusted: true,
    seen: null,    // when distrusted: { gpu, frame } (ms), what the last while said
    // gpuMs: a frame's GPU time (the median span) over a while; frameMs: the mean time between
    // frames over it. Returns whether the timestamps are still trusted.
    add(gpuMs, frameMs) {
      if (!this.trusted || !(gpuMs > 0) || !(frameMs > 0)) return this.trusted;
      over = gpuMs > RATIO * frameMs ? over + 1 : 0;
      if (over >= WINDOWS) { this.trusted = false; this.seen = { gpu: gpuMs, frame: frameMs }; }
      return this.trusted;
    },
  };
}

// the median and the mean of a list of numbers (NaN when empty)
export function median(values) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[s.length >> 1];
}
export const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
