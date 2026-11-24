// Whether the GPU's timestamps may steer the resolution (render/resolution.js). A frame's GPU time
// can't be longer than the time between frames: the GPU finishes a frame for every frame shown, or
// the frames would come slower. Where the timestamps say more, they overstate: on a tile-based GPU
// (a phone's Mali, leg 12) passes overlap, each pass's timestamps span others' work, and their sum
// said 38–60 ms a frame where frames came every 16.6 ms; steered by that, the resolution fell to
// its floor. So: the median GPU time a frame over a while (render/resolution.js: 30 frames)
// against the median time between frames over the same while; over RATIO times it for WINDOWS
// whiles in a row, and the timestamps are distrusted for good (frame times steer). Pure:
// tests/gputrust.test.js.

const RATIO = 1.15, WINDOWS = 2;

export function timestampTrust() {
  let over = 0;
  return {
    trusted: true,
    seen: null,    // when distrusted: { gpu, frame } (ms), what the last while said
    // gpuMs, frameMs: the medians over a while; returns whether the timestamps are still trusted
    add(gpuMs, frameMs) {
      if (!this.trusted || !(gpuMs > 0) || !(frameMs > 0)) return this.trusted;
      over = gpuMs > RATIO * frameMs ? over + 1 : 0;
      if (over >= WINDOWS) { this.trusted = false; this.seen = { gpu: gpuMs, frame: frameMs }; }
      return this.trusted;
    },
  };
}

// the median of a list of numbers (NaN when empty)
export function median(values) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[s.length >> 1];
}
