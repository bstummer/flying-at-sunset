// How much longer (or shorter) the world's bakes take on this GPU than render/stream.js's bakeCost
// estimates: its constants are one NVIDIA laptop's. Where the browser has timestamp queries, each
// frame that baked hands over its estimate and what its bakes took (render/timing.js); the scale is
// the ratio of their sums, each fading by FADE a frame that baked, so a frame that baked much weighs
// much (the first frame's whole world, then a shift's blocks), and the GPU's clocks may drift.
// Bounded, so a frame measured wrong can neither stall the streaming nor flood a frame with bakes.
// Pure: tests/bakescale.test.js.

const FADE = 0.9, K_MIN = 0.25, K_MAX = 16;

export function bakeScale() {
  let took = 0, est = 0;
  return {
    k: 1,
    // a frame's bakes: est, estimated (ms), and ms, what they took on the GPU
    add(e, ms) {
      if (!(e > 0) || !(ms >= 0) || !Number.isFinite(ms)) return;
      took = took * FADE + ms; est = est * FADE + e;
      this.k = Math.min(K_MAX, Math.max(K_MIN, took / est));
    },
  };
}
