// GPU timing (EXT_disjoint_timer_query_webgl2), which drives dynamic resolution when available;
// ?cpuprof times the passes on software GL

import { Q } from '../params.js';
import { extTimer, gl } from './gl.js';
import { FB } from './setup.js';

export const gpuTimer = (() => {
  if (!extTimer) return null;
  const pool = [], pending = [], ms = {};
  let cur = null;
  return {
    ms,
    begin(label) {
      if (cur || pending.length > 64) return;
      const q = pool.pop() || gl.createQuery();
      gl.beginQuery(extTimer.TIME_ELAPSED_EXT, q);
      cur = { label, q };
    },
    end() {
      if (!cur) return;
      gl.endQuery(extTimer.TIME_ELAPSED_EXT);
      pending.push(cur); cur = null;
    },
    poll() {
      const disjoint = gl.getParameter(extTimer.GPU_DISJOINT_EXT);
      const frameMs = {};
      while (pending.length) {
        const p = pending[0];
        if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
        pending.shift();
        if (!disjoint) {
          const v = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
          ms[p.label] = ms[p.label] === undefined ? v : ms[p.label] * 0.85 + v * 0.15;
          frameMs[p.label] = v;
        }
        pool.push(p.q);
      }
      return frameMs;
    },
    total() { let t = 0; for (const k in ms) t += ms[k]; return t; },
  };
})();
// ?cpuprof (testing on software GL): fence each pass group and measure wall time
export const CPUPROF = Q.has('cpuprof');
const cpuProf = {}; let cpuLabel = null, cpuT0 = 0;
const syncPx = new Float32Array(4);
function hardSync() { // readPixels blocks until all submitted GPU work is done
  const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.probe);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, syncPx);
  gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
}
export const tBegin = l => {
  if (CPUPROF) { hardSync(); cpuLabel = l; cpuT0 = performance.now(); return; }
  if (gpuTimer) gpuTimer.begin(l);
};
export const tEnd = () => {
  if (CPUPROF) { hardSync(); const v = performance.now() - cpuT0; cpuProf[cpuLabel] = (cpuProf[cpuLabel] || 0) + v; window.__gpu = cpuProf; return; }
  if (gpuTimer) gpuTimer.end();
};
