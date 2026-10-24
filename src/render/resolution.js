// Dynamic resolution: keep the frame inside budget by scaling the cloud trace resolution.
// With GPU timers we solve for the trace budget directly; otherwise we watch frame times and aim
// for 60 fps, or for the rate the display or browser caps us at (50 Hz screens, power saving).

import { TEST } from '../params.js';
import { clamp } from '../math.js';
import { R } from './targets.js';
import { CPUPROF, gpuTimer } from './timing.js';

export const DR = { acc: [], cool: 0, ceiling: 0.75, gpuN: 0, gpuFresh: 0, gpuMiss: 0, slow: 0, warm: 0,
  cap: 0, probe: null, calm: 0, calmNeed: 12, settled: false, fastWait: 0, win: 0, raisedWin: -99 };
const GPU_BUDGET = 12.5; // ms: leaves headroom for the browser at 60 Hz
export function adaptResolution(dtMs) {
  if (TEST) { if (gpuTimer && !CPUPROF) { gpuTimer.poll(); window.__gpu = gpuTimer.ms; } return; }
  if (++DR.warm < 8) { if (gpuTimer) gpuTimer.poll(); return; }    // shader warm-up frames
  if (gpuTimer && DR.gpuMiss < 5) {
    DR.gpuFresh += Object.keys(gpuTimer.poll()).length;
    if (++DR.gpuN < 10) return;
    DR.gpuN = 0;
    const tot = gpuTimer.total(), tr = gpuTimer.ms.trace || 0;
    // no fresh results for a while (always disjoint, or never available): use frame times instead
    if (!DR.gpuFresh || !tot || !tr) { DR.gpuMiss++; DR.gpuFresh = 0; return; }
    DR.gpuMiss = 0; DR.gpuFresh = 0;
    const fixed = Math.max(tot - tr, 0);
    const budget = Math.max(GPU_BUDGET - fixed, 1.5);
    let k = Math.sqrt(budget / tr);
    k = tot > GPU_BUDGET ? clamp(k, 0.8, 0.98) : clamp(k, 1.0, 1.05);
    if (Math.abs(k - 1) > 0.015) R.scale = clamp(R.scale * k, 0.22, 0.75);
    // even the cheapest clouds don't fit: render fewer full-resolution pixels
    if (R.scale <= 0.23 && tot > GPU_BUDGET * 1.3) { if (++DR.slow > 6) downgradePixels(); } else DR.slow = 0;
    return;
  }
  if (dtMs > 250) return;                     // tab switch, hitch
  DR.acc.push(dtMs);
  const target = Math.max(16.7, DR.cap);      // the frame interval we aim for
  // far over budget (weak GPU, very heavy scene): react within a few frames instead of a full
  // window; once settled at most every 1.5 s, so a hitch can't collapse the resolution
  if (--DR.fastWait <= 0 && DR.acc.length >= 4 && R.scale > 0.23) {
    const last4 = DR.acc.slice(-4);
    if (last4.every(v => v > Math.max(45, target * 1.6))) {
      if (!DR.probe) DR.probe = { scale: R.scale, ceiling: DR.ceiling, med: Math.min(...last4), n: 1 };
      R.scale = Math.max(0.22, R.scale * 0.72); DR.ceiling = Math.max(0.24, R.scale * 1.1); DR.acc.length = 0;
      DR.fastWait = DR.settled ? 90 : 0;
      return;
    }
  }
  if (DR.acc.length < 24) return;
  const sorted = DR.acc.slice().sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1], quick = sorted[sorted.length >> 2];
  DR.acc.length = 0; DR.win++;
  if (DR.cap && quick < DR.cap * 0.8) { DR.cap = 0; DR.calmNeed = 12; }   // the cap was lifted
  if (DR.cool > 0) { DR.cool--; return; }
  if (med > target * 1.12) {                  // missing frames
    const pr = DR.probe || (DR.probe = { scale: R.scale, ceiling: DR.ceiling, med, n: 0 });
    if (pr.scale >= 0.3 && (R.scale < pr.scale * 0.6 || R.scale <= 0.23) && med > pr.med * 0.88) {
      // much cheaper frames did not come any faster: the display or the browser caps the frame
      // rate, not the GPU. Restore the resolution and aim for that rate instead.
      DR.cap = med; R.scale = pr.scale; DR.ceiling = pr.ceiling;
      DR.probe = null; DR.cool = 2; DR.slow = 0; DR.calm = 0; DR.calmNeed = 12;
      return;
    }
    // the cheapest clouds are still too slow: render fewer full-resolution pixels
    if (R.scale <= 0.23 && med > target * 1.4) { if (++DR.slow > 4) { downgradePixels(); return; } } else DR.slow = 0;
    const stuck = pr.n > 0 && med > pr.med * 0.97;   // no response to the last step: step faster
    R.scale = Math.max(0.22, R.scale * (stuck ? 0.8 : med > target * 1.55 ? 0.84 : 0.92));
    pr.n++;
    DR.ceiling = Math.max(0.24, R.scale * 1.04);
    DR.cool = 2; DR.calm = 0;
    if (DR.win - DR.raisedWin < 10) DR.calmNeed = Math.min(DR.calmNeed * 2, 96);
  } else {
    DR.probe = null; DR.slow = 0; DR.settled = true;
    // after a calm stretch the ceiling rises again: a hitch or a heavy moment must not lower the
    // quality for good (the stretch doubles whenever the raised resolution proves too slow)
    if (++DR.calm >= DR.calmNeed && DR.ceiling < 0.75) { DR.ceiling = Math.min(0.75, DR.ceiling * 1.03); DR.raisedWin = DR.win; }
    if (med < target * 0.75 || (med < target * 1.05 && R.scale < DR.ceiling)) {
      R.scale = Math.min(DR.ceiling, R.scale * 1.05);
      DR.cool = 2;
    }
  }
}
function downgradePixels() {
  DR.slow = 0; DR.probe = null;
  if (R.maxPixels <= 0.55e6) return;
  R.maxPixels = Math.max(0.55e6, R.maxPixels * 0.7);
  R.scale = 0.32; DR.ceiling = 0.75;
}
