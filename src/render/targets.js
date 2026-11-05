// Size-dependent render targets: allocated for the canvas size, retried smaller when GPU memory runs out

import { Q, TEST } from '../params.js';
import { canvas, COARSE } from '../page.js';
import { device, forgetBindGroups, texture } from './gpu.js';
import { T } from './setup.js';

export const R = { w: 0, h: 0, lowW: 0, lowH: 0, lowMaxW: 0, lowMaxH: 0, scale: TEST ? parseFloat(Q.get('scale') || '0.5') : 0.5, histValid: 0 };
const HALF4 = 'rgba16float';
export const bloomLevels = [];
const SIZED = ['cloudCol', 'cloudDepth', 'histA', 'histB', 'scene', 'birdTex', 'birdMS', 'birdDepth', 'rayA', 'rayB'];
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
  device.pushErrorScope('out-of-memory');
  T.cloudCol = texture(R.lowMaxW, R.lowMaxH, HALF4);
  T.cloudDepth = texture(R.lowMaxW, R.lowMaxH, 'r16float');
  T.histA = texture(w, h, HALF4);
  T.histB = texture(w, h, HALF4);
  T.scene = texture(w, h, HALF4);
  // bird: 4x MSAA colour + depth, resolved into a texture
  T.birdTex = texture(w, h, HALF4);
  T.birdMS = texture(w, h, HALF4, { samples: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  T.birdDepth = texture(w, h, 'depth24plus', { samples: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
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
  R.histValid = 0;
  const gen = ++allocGen;
  device.popErrorScope().then(e => {
    if (gen !== allocGen) return;
    if (e) R.oom = true; else allocFails = 0;
  });
}

R.maxPixels = COARSE ? 1.15e6 : 2.3e6;
if (COARSE && !TEST) R.scale = 0.36;
let allocFails = 0;
export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (TEST) { w = parseInt(Q.get('w') || '960'); h = parseInt(Q.get('h') || '540'); }
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
