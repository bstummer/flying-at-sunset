// The benchmark (?bench, not with ?test): flies a fixed route from the start and measures, then
// shows a summary to paste into a session: how smoothly the piece runs on this machine, at what
// cloud resolution, on which GPU, browser and screen. It is how numbers from real computers and
// phones reach a session (PLAN.md, known issues).
//
// The piece runs as in normal use (dynamic resolution, real frame times), steered by the route,
// without the hint. Each leg (level, turn, dive, weave) settles first (?benchWarmup seconds and at
// least 10 frames), then measures for ?benchSeconds: frame times, the GPU's time a frame where the
// browser has timestamp queries (its passes' times summed, and the span from the first pass's start
// to the last's end: where passes overlap the sum counts it again), the clouds' scale
// (render/resolution.js) and hitches (frames over 50 ms); at the end, whether the timestamps
// steered the resolution (render/gputrust.js), how the world's bakes took against their estimate
// (render/bakescale.js), and the GPU memory the piece made (render/targets.js). Then the viewer steers again; window.__BENCH__ holds the result (tools/checks.js).

import { BENCH, params } from './params.js';
import { GPU_NAME } from '../render/gpu.js';
import { BAKES } from '../render/stream.js';
import { R } from '../render/targets.js';
import { DR } from '../render/resolution.js';
import { gpuTimer } from '../render/timing.js';
import { input } from './input.js';

const SECONDS = params.benchSeconds ?? 8;
const WARMUP = params.benchWarmup ?? 2;
const WARMUP_FRAMES = 10;   // so one long frame (the first bakes the whole world) can't end a warmup
const HITCH_MS = 50;
// the route, from the start; steer(t) gives [right, up] in -1..1 at t seconds into the leg
const LEGS = [
  { name: 'level', steer: () => [0, 0] },                                   // toward the sun, towers to the right
  { name: 'turn', steer: () => [1, 0] },                                    // every direction of the light
  { name: 'dive', steer: (t) => [0, t < 0.45 * (WARMUP + SECONDS) ? -1 : 0.8] },   // speed, near clouds rushing past
  { name: 'weave', steer: (t) => [Math.sin(t * 0.7), 0.4 * Math.sin(t * 0.45)] },
];

const legs = LEGS.map((leg) => ({ name: leg.name, frameMs: [], gpuMs: [], spanMs: [], scale: [] }));
let index = 0, legTime = 0, legFrames = 0, measuring = false, finished = false;
const panel = document.getElementById('bench');
const text = panel.querySelector('pre');
const copy = panel.querySelector('button');

if (BENCH) {
  input.script = () => LEGS[index].steer(legTime);
  if (gpuTimer) gpuTimer.onFrame = (ms, span) => { if (measuring) { legs[index].gpuMs.push(ms); legs[index].spanMs.push(span); } };
  panel.hidden = false;
  text.textContent = 'Benchmark: starting… keep this tab in front';
  copy.addEventListener('click', () => {
    const failed = () => { copy.textContent = 'Copy failed: select the text instead'; };
    if (!navigator.clipboard) return failed();
    navigator.clipboard.writeText(text.textContent).then(() => { copy.textContent = 'Copied'; }, failed);
  });
}

// once a frame (main.js), with the time since the last one
export function updateBenchmark(dtMs) {
  if (finished) return;
  legTime += dtMs / 1000;
  legFrames++;
  const leg = legs[index];
  if (!measuring) {
    text.textContent = `Benchmark: ${leg.name} (${index + 1} of ${legs.length})… keep this tab in front`;
    if (legTime >= WARMUP && legFrames >= WARMUP_FRAMES) { measuring = true; legTime = 0; }
    return;
  }
  leg.frameMs.push(dtMs);
  leg.scale.push(R.scale);
  if (legTime < SECONDS) return;
  measuring = false;
  legTime = legFrames = 0;
  if (++index < legs.length) return;
  finished = true;
  input.script = null;
  if (gpuTimer) gpuTimer.onFrame = null;
  const summary = formatBenchmark();
  text.textContent = summary;
  copy.hidden = false;
  console.log(summary);
  window.__BENCH__ = { done: true, summary, legs };
}

function quantile(values, q) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function formatBenchmark() {
  const widths = [10, 7, 6, 7, 6, 7, 6, 6, 7, 8];
  const line = (cells) => cells.map((c, i) => (i ? String(c).padStart(widths[i]) : String(c).padEnd(widths[i]))).join(' ').trimEnd();
  const fixed = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : 'n/a');
  const row = (name, frameMs, gpuMs, spanMs, scale) => {
    const mean = frameMs.reduce((a, b) => a + b, 0) / frameMs.length;
    return line([name, fixed(quantile(frameMs, 0.5), 1), fixed(quantile(frameMs, 0.95), 1), fixed(Math.max(...frameMs), 1), fixed(1000 / mean, 1),
      fixed(quantile(gpuMs, 0.5), 2), fixed(quantile(gpuMs, 0.95), 2), fixed(quantile(spanMs, 0.5), 1), fixed(quantile(scale, 0.5), 2), frameMs.filter((ms) => ms > HITCH_MS).length]);
  };
  const seen = DR.trust.seen;
  const all = (key) => legs.flatMap((l) => l[key]);
  return [
    'Flying at Sunset benchmark',
    `build      ${typeof __BUILD__ === 'undefined' ? 'unknown' : __BUILD__}`,
    `gpu        ${GPU_NAME}${gpuTimer ? '' : ' (no GPU timer)'}`,
    `browser    ${navigator.userAgent}`,
    `screen     ${innerWidth}×${innerHeight} CSS px × ${devicePixelRatio} → canvas ${R.w}×${R.h}, clouds up to ${R.lowMaxW}×${R.lowMaxH}`,
    `memory     ${(R.keptBytes / 1e6).toFixed(0)} MB of volumes and tables, ${(R.sizedBytes / 1e6).toFixed(0)} MB of targets at this canvas (from their formats)`,
    `measured   ${SECONDS} s per leg after ${WARMUP} s to settle`,
    `gpu timer  ${!gpuTimer ? 'none: frame times steer the resolution' : seen ? `overstates (${seen.gpu.toFixed(1)} ms a frame, frames every ${seen.frame.toFixed(1)} ms): frame times steer the resolution` : 'steers the resolution'}`,
    `bakes      ${gpuTimer ? `${BAKES.k.toFixed(2)}× the estimate (one NVIDIA laptop's)` : 'not measured (no GPU timer)'}`,
    '',
    line(['', 'frame ms', '', '', '', 'GPU ms', '', '', 'clouds', '']),
    line(['leg', 'median', 'p95', 'max', 'fps', 'median', 'p95', 'span', 'scale', 'hitches']),
    ...legs.map((l) => row(l.name, l.frameMs, l.gpuMs, l.spanMs, l.scale)),
    row('all legs', all('frameMs'), all('gpuMs'), all('spanMs'), all('scale')),
    '',
    `Hitches: frames over ${HITCH_MS} ms.`,
    'GPU ms: its passes\' times summed (median, p95), and the median span from the first pass\'s start',
    'to the last\'s end (on GPUs whose passes overlap, the sum counts the overlap again).',
    'Frame times can\'t drop below the display\'s refresh interval; GPU ms shows the headroom,',
    'and the clouds\' scale (0.22 to 0.75 of the canvas) where dynamic resolution settled.',
  ].join('\n');
}
