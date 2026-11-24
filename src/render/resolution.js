// Dynamic resolution: the clouds are traced at R.scale of the canvas (0.22–0.75; 0.5 at the start,
// 0.36 on touch devices), adapted so frames stay within budget. With GPU timestamps it keeps the GPU
// under 12.5 ms a frame, solving for the trace's share; without them, or where they say more GPU
// time a frame than the time between frames allows (render/gputrust.js: then from the start's
// scale again), it aims for 60 fps by frame times, or for the rate the display or the browser caps
// at (much cheaper frames coming no faster).
// The ceiling it may rise to recovers after hitches. If even the cheapest clouds are too slow, and
// the frames come late, the canvas gets fewer pixels (R.maxPixels). In the test mode it only hands over the GPU times
// (window.__gpu).

import { TEST } from '../core/params.js';
import { clamp } from '../math.js';
import { R } from './targets.js';
import { CPUPROF, gpuTimer } from './timing.js';
import { median, timestampTrust } from './gputrust.js';

export const DR = { acc: [], cool: 0, ceiling: 0.75, gpuN: 0, gpuFresh: 0, gpuMiss: 0, slow: 0, warm: 0,
  cap: 0, probe: null, calm: 0, calmNeed: 12, settled: false, fastWait: 0, win: 0, raisedWin: -99,
  trust: timestampTrust(), gaps: [], gpuFrames: [], gapMed: 0 };
const START = R.scale;
const GPU_BUDGET = 12.5; // ms: leaves headroom for the browser at 60 Hz
const TRUST_FRAMES = 30; // the while over which the timestamps are held to the frames (render/gputrust.js)
export function adaptResolution(dtMs) {
  if (TEST) { if (gpuTimer) { gpuTimer.poll(); window.__gpu = CPUPROF ? gpuTimer.sum : gpuTimer.ms; } return; }
  if (++DR.warm < 8) { if (gpuTimer) { gpuTimer.poll(); gpuTimer.frames(); } return; }    // shader warm-up frames
  if (gpuTimer && DR.gpuMiss < 5 && DR.trust.trusted) {
    DR.gpuFresh += Object.keys(gpuTimer.poll()).length;
    // timestamps that say more GPU time a frame than the frames allow: frame times from here on,
    // from the start's scale (what the timestamps lowered it to was their mistake)
    if (dtMs < 250) DR.gaps.push(dtMs);
    for (const f of gpuTimer.frames()) DR.gpuFrames.push(f[0]);
    if (DR.gaps.length >= TRUST_FRAMES) {
      DR.gapMed = median(DR.gaps);
      const trusted = DR.trust.add(median(DR.gpuFrames), DR.gapMed);
      DR.gaps.length = 0; DR.gpuFrames.length = 0;
      if (!trusted) { R.scale = START; DR.ceiling = 0.75; DR.slow = 0; return; }
    }
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
    // even the cheapest clouds don't fit, and the frames come late: render fewer full-resolution
    // pixels (frames on time say the GPU isn't what holds them back, whatever its timestamps say)
    if (R.scale <= 0.23 && tot > GPU_BUDGET * 1.3 && DR.gapMed > 16.7 * 1.12) { if (++DR.slow > 6) downgradePixels(); } else DR.slow = 0;
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
