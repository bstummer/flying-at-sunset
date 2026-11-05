// GPU timing (timestamp queries), which drives dynamic resolution when available. Each group of
// passes (tBegin .. tEnd) writes two timestamps: at the start of its first pass and at the end
// of each pass (the last one stays); a group without passes this frame (the world, mostly) took
// no GPU time. ?cpuprof sums the times over a test run (tools/checks/profile.mjs).

import { Q } from '../params.js';
import { device, enc, hooks, TIMESTAMPS } from './gpu.js';

export const CPUPROF = Q.has('cpuprof');
export const gpuTimer = TIMESTAMPS ? (() => {
  const N = 32;
  const querySet = device.createQuerySet({ type: 'timestamp', count: N });
  const resolveBuf = device.createBuffer({ size: N * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const free = [];
  let made = 0, pairs = 0, groups = [], cur = null, toMap = null, fresh = {};
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
  return {
    ms, sum,
    begin(label) { cur = { label, q: -1 }; },
    end() { if (cur) groups.push(cur); cur = null; },
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
        for (const g of gs) {
          const v = g.q < 0 ? 0 : Number(t[g.q + 1] - t[g.q]) / 1e6;
          if (v >= 0 && v < 1e5) record(g.label, v);       // (else not a valid pair)
        }
        buf.unmap();
        free.push(buf);
      }, () => {}).finally(() => maps.delete(m));
      maps.add(m);
    },
    poll() { const f = fresh; fresh = {}; return f; },     // the results read since the last poll
    total() { let t = 0; for (const k in ms) t += ms[k]; return t; },
    settled() { return Promise.all([...maps]); },
  };
})() : null;
export const tBegin = l => { if (gpuTimer) gpuTimer.begin(l); };
export const tEnd = () => { if (gpuTimer) gpuTimer.end(); };
