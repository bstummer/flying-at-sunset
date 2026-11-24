// GPU timing with timestamp queries, where the browser has them (gpuTimer, else null): it drives
// dynamic resolution (render/resolution.js), scales the world bakes' estimate (render/stream.js)
// and feeds the readout and the benchmark. Each group of passes (tBegin .. tEnd) writes two
// timestamps: at the start of its first pass and at the end of each pass (the last one stays); a
// group without passes this frame (the world, mostly) took no GPU time. They are read back once the
// GPU is done; tEnd(then): then(ms) gets the group's time when it is. Per frame, the groups' times
// summed and the span from its first pass's start to its last pass's end (where passes overlap,
// as on tile-based GPUs, the sum counts the overlap again): onFrame (the benchmark) and frames()
// (render/resolution.js, render/gputrust.js). ?cpuprof: their sums over a test run (window.__gpu,
// tools/screenshot.js --profile).

import { params } from '../core/params.js';
import { device, enc, hooks, TIMESTAMPS } from './gpu.js';

export const CPUPROF = params.cpuprof;
export const gpuTimer = TIMESTAMPS ? (() => {
  const N = 32;
  const querySet = device.createQuerySet({ type: 'timestamp', count: N });
  const resolveBuf = device.createBuffer({ size: N * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const free = [];
  let made = 0, pairs = 0, groups = [], cur = null, toMap = null, fresh = {}, frames = [];
  const ms = {}, sum = {}, maps = new Set();
  const record = (label, v) => {
    ms[label] = ms[label] === undefined ? v : ms[label] * 0.85 + v * 0.15;
    sum[label] = (sum[label] || 0) + v;
    fresh[label] = v;
  };
  hooks.timestamps = () => {
    if (!cur) return undefined;
    if (cur.q >= 0) return { querySet, endOfPassWriteIndex: cur.q + 1 };
    if (pairs * 2 + 2 > N) { cur = null; return undefined; }
    cur.q = 2 * pairs++;
    return { querySet, beginningOfPassWriteIndex: cur.q, endOfPassWriteIndex: cur.q + 1 };
  };
  const timer = {
    ms, sum,
    onFrame: null,   // called with each measured frame's GPU time, its groups summed, and its span (the benchmark)
    begin(label) { cur = { label, q: -1 }; },
    end(then) { if (cur) { cur.then = then; groups.push(cur); } cur = null; },
    // after the last pass of a frame: resolve its timestamps into a buffer to read
    resolve() {
      if (!groups.length) return;
      const buf = pairs ? free.pop() || (made < 4 ? (made++, device.createBuffer({ size: N * 8, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })) : null) : null;
      if (buf) {
        const e = enc();
        e.resolveQuerySet(querySet, 0, pairs * 2, resolveBuf, 0);
        e.copyBufferToBuffer(resolveBuf, 0, buf, 0, pairs * 16);
      }
      if (buf || !pairs) toMap = { buf, groups };
      groups = []; pairs = 0;
    },
    // after the frame is submitted: read them when the GPU is done
    map() {
      if (!toMap) return;
      const { buf, groups: gs } = toMap;
      toMap = null;
      if (!buf) { for (const g of gs) record(g.label, 0); return; }
      const m = buf.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigUint64Array(buf.getMappedRange());
        let frameMs = 0, lo = null, hi = null;
        for (const g of gs) {
          const v = g.q < 0 ? 0 : Number(t[g.q + 1] - t[g.q]) / 1e6;
          if (!(v >= 0 && v < 1e5)) continue;       // (not a valid pair)
          record(g.label, v); frameMs += v; if (g.then) g.then(v);
          if (g.q >= 0) { if (lo === null || t[g.q] < lo) lo = t[g.q]; if (hi === null || t[g.q + 1] > hi) hi = t[g.q + 1]; }
        }
        const span = lo === null ? 0 : Number(hi - lo) / 1e6;
        if (span < 1e5) {
          if (frames.length < 240) frames.push([frameMs, span]);
          if (timer.onFrame) timer.onFrame(frameMs, span);
        }
        buf.unmap();
        free.push(buf);
      }, () => {}).finally(() => maps.delete(m));
      maps.add(m);
    },
    poll() { const f = fresh; fresh = {}; return f; },     // the results read since the last poll
    frames() { const f = frames; frames = []; return f; },  // [sum, span] of each frame read since the last call
    total() { let t = 0; for (const k in ms) t += ms[k]; return t; },
    settled() { return Promise.all([...maps]); },
  };
  return timer;
})() : null;
export const tBegin = l => { if (gpuTimer) gpuTimer.begin(l); };
export const tEnd = then => { if (gpuTimer) gpuTimer.end(then); };
