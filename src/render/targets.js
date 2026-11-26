// The size-dependent render targets, and resize(): the canvas in device pixels (at most 2 per CSS
// pixel and R.maxPixels in all: 2.3 Mpx, 1.15 Mpx on touch devices; ?w × ?h in the test mode). R
// holds the sizes, the clouds' scale and the GPU memory (counted from the formats, render/gpu.js)
// of what never changes (R.keptBytes: the volumes and tables made before the first targets) and of
// the targets. Running out of GPU memory shows in an error scope after the fact: the next frame
// makes the targets again, smaller. Other modules' targets go in the same scope (sizedTargets:
// render/bird.js's).

import { params, TEST } from '../core/params.js';
import { canvas, COARSE } from '../core/page.js';
import { device, forgetBindGroups, gpuBytes, texture } from './gpu.js';
import { T } from './setup.js';

export const R = { w: 0, h: 0, lowW: 0, lowH: 0, lowMaxW: 0, lowMaxH: 0, scale: TEST ? (params.scale ?? 0.5) : 0.5, histFrames: 0, keptBytes: 0, sizedBytes: 0 };
const HALF4 = 'rgba16float';
export const bloomLevels = [];
const SIZED = ['cloudCol', 'cloudDepth', 'histA', 'histB', 'fogA', 'fogB', 'scene', 'rayA', 'rayB'];
// the size-dependent targets of other modules (render/bird.js): their keys in T, and how to make
// them for a canvas of w × h, in the same error scope as these
const others = [];
export function sizedTargets(keys, make) { SIZED.push(...keys); others.push(make); }
function freeRes() {
  for (const k of SIZED) if (T[k]) { T[k].tex.destroy(); T[k] = null; }
  for (const b of bloomLevels) b.tex.destroy();
  bloomLevels.length = 0;
  forgetBindGroups();
}
let allocGen = 0;
function allocate(w, h) {
  freeRes();
  R.w = w; R.h = h;
  R.lowMaxW = Math.ceil(w * 0.75); R.lowMaxH = Math.ceil(h * 0.75);
  // (running out of memory shows only later: an error scope reports it, and the next frame
  // allocates smaller)
  const before = gpuBytes();
  if (!R.keptBytes) R.keptBytes = before;
  device.pushErrorScope('out-of-memory');
  T.cloudCol = texture(R.lowMaxW, R.lowMaxH, HALF4);
  T.cloudDepth = texture(R.lowMaxW, R.lowMaxH, 'rg16float');   // (the clouds' depth, and the light through the camera's own cloud)
  T.histA = texture(w, h, HALF4);
  T.histB = texture(w, h, HALF4);
  T.fogA = texture(w, h, 'r8unorm');   // (the camera's own fog the history holds)
  T.fogB = texture(w, h, 'r8unorm');
  T.scene = texture(w, h, HALF4);
  for (const make of others) make(w, h);
  // bloom chain
  let bw = w, bh = h;
  for (let i = 0; i < 7; i++) {
    bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2));
    bloomLevels.push(texture(bw, bh, HALF4));
  }
  // sun rays (quarter res)
  const rw = Math.max(1, Math.ceil(w / 4)), rh = Math.max(1, Math.ceil(h / 4));
  T.rayA = texture(rw, rh, HALF4);
  T.rayB = texture(rw, rh, HALF4);
  R.rayW = rw; R.rayH = rh;
  R.histFrames = 0;
  R.sizedBytes = gpuBytes() - before;
  const gen = ++allocGen;
  device.popErrorScope().then(e => {
    if (gen !== allocGen) return;
    if (e) R.oom = true; else allocFails = 0;
  });
}

// the canvas's shape, width over height, before resize() has made it (the start's heading)
export const screenAspect = () => TEST ? (params.w ?? 960) / (params.h ?? 540) : canvas.clientWidth / Math.max(canvas.clientHeight, 1);

R.maxPixels = COARSE ? 1.15e6 : 2.3e6;
if (COARSE && !TEST) R.scale = 0.36;
let allocFails = 0;
export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (TEST) { w = params.w ?? 960; h = params.h ?? 540; }
  if (R.oom) {
    // out of GPU memory (typically on phones): try again smaller
    R.oom = false;
    if (++allocFails > 3) throw new Error('out of GPU memory');
    R.maxPixels = Math.max(0.3e6, Math.min(R.maxPixels, R.w * R.h) * 0.6);
    freeRes();
    R.w = R.h = 0;
  }
  const px = w * h;
  if (px > R.maxPixels) { const k = Math.sqrt(R.maxPixels / px); w = Math.round(w * k); h = Math.round(h * k); }
  if (w !== R.w || h !== R.h) {
    canvas.width = w; canvas.height = h;
    allocate(w, h);
  }
  return R.w > 0;
}
