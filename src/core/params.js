// URL parameters: every one the page reads, read here and nowhere else (CLAUDE.md §7).
//
// parseParams(search) is pure, for tests/params.test.js; `params` holds the page's own. A switch is
// true when it is there at all (?test, ?test=); any other parameter is null when it is missing or
// blank, and the module that reads it keeps its default (next to what it tunes, as below). A value
// that isn't of its kind (?seed=abc, ?frames=0) or a name the page doesn't know (?preest=tower) is
// left out and named in `params.errors`: main.js refuses the request (core/page.js), which in the
// test mode fails the capture, so a typo can't render something else in silence.
//
//   modes      test (the test mode, core/capture.js), bench (the benchmark, not with test:
//              core/benchmark.js), debug (the readout, not with test: core/readout.js)
//   the world  seed (7: world/noise.js), towers (1: the density of convective cells, world/cells.js)
//   the bird   preset (a test view: where the bird starts) and pose (x,y,z[,yaw,pitch,bank]): both
//              flight/presets.js
//   the look   view (0: what goes into the final image, 1..5), dbg (0: the cloud debug views,
//              1..7: render/setup.js), tm (1: the tone curve, 0 the other), con (1: contrast), haze
//              (2.8e-5), exp (14: exposure), rays (0.18), bloom (0.09), bloomw (0.6), bclamp (3000):
//              render/frame.js
//   benchmark  benchSeconds (8), benchWarmup (2): core/benchmark.js
//   test mode  dt (0.0166), frames (24), keep (1), every (1), freeze, log, live, script: main.js and
//              core/capture.js; w (960), h (540), scale (0.5): render/targets.js; closeup
//              (right,up,forward: flight/camera.js); cpuprof (render/timing.js)

const flag = { flag: true };
const text = { read: (raw) => raw, kind: 'text' };
const number = (min, max, { whole = false } = {}) => ({
  read: (raw) => {
    const v = Number(raw);
    return Number.isFinite(v) && (!whole || Number.isInteger(v)) && v >= min && v <= max ? v : undefined;
  },
  kind: `a ${whole ? 'whole ' : ''}number from ${min} to ${max}`,
});
const numbers = (least, most) => ({
  read: (raw) => {
    const v = raw.split(',').map((s) => (s.trim() === '' ? NaN : Number(s)));
    return v.length >= least && v.length <= most && v.every(Number.isFinite) ? v : undefined;
  },
  kind: `${least} to ${most} numbers, separated by commas`,
});

const INT32 = 2 ** 31;
export const PARAMS = {
  test: flag, bench: flag, debug: flag,
  seed: number(-INT32, INT32 - 1, { whole: true }), towers: number(0, 100),
  preset: text, pose: numbers(3, 6),
  view: number(0, 5, { whole: true }), dbg: number(0, 7, { whole: true }), tm: number(0, 1, { whole: true }),
  con: number(0, 10), haze: number(0, 1), exp: number(0, 1e6), rays: number(0, 100),
  bloom: number(0, 1), bloomw: number(0, 0.99), bclamp: number(0, 1e9),
  benchSeconds: number(0.05, 600), benchWarmup: number(0, 600),
  dt: number(0, 1), frames: number(1, 1e6, { whole: true }), keep: number(1, 1000, { whole: true }),
  every: number(1, 1000, { whole: true }), freeze: flag, log: flag, live: flag, script: text,
  w: number(1, 8192, { whole: true }), h: number(1, 8192, { whole: true }), scale: number(0.01, 1),
  closeup: numbers(3, 3), cpuprof: flag,
};

export function parseParams(search) {
  const q = new URLSearchParams(search);
  const out = { errors: [] };
  for (const [name, spec] of Object.entries(PARAMS)) {
    if (spec.flag) { out[name] = q.has(name); continue; }
    const raw = (q.get(name) ?? '').trim();
    const value = raw === '' ? null : spec.read(raw);
    if (value === undefined) out.errors.push(`?${name}=${raw}: must be ${spec.kind}`);
    out[name] = value ?? null;
  }
  for (const name of new Set(q.keys())) if (!Object.hasOwn(PARAMS, name)) out.errors.push(`?${name}: no such URL parameter`);
  out.bench &&= !out.test;
  out.debug &&= !out.test;
  return out;
}

// (Node has no location: there the tools set one, tools/world/load.js, or every value is missing.)
export const params = parseParams(globalThis.location?.search ?? '');
export const TEST = params.test, BENCH = params.bench;
