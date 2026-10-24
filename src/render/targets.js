// Size-dependent render targets: allocated for the canvas size, retried smaller when GPU memory runs out

import { Q, TEST } from '../params.js';
import { canvas } from '../page.js';
import { framebuffer, gl, HALF, RGBA16F, texture2D } from './gl.js';
import { FB, T } from './setup.js';

export const R = { w: 0, h: 0, lowW: 0, lowH: 0, lowMaxW: 0, lowMaxH: 0, scale: TEST ? parseFloat(Q.get('scale') || '0.5') : 0.5, histValid: 0 };
// largest MSAA sample count (up to 4) that both bird attachment formats support
let msaaSamples = 0;
try {
  const c = gl.getInternalformatParameter(gl.RENDERBUFFER, RGBA16F, gl.SAMPLES) || [];
  const d = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) || [];
  for (const n of c) if (n <= 4 && Array.prototype.includes.call(d, n)) { msaaSamples = n; break; }
} catch (_) { msaaSamples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0); }
export const bloomLevels = [];
function freeRes() {
  for (const k of ['cloudCol', 'cloudDepth', 'histA', 'histB', 'scene', 'birdTex', 'rayA', 'rayB']) if (T[k]) { gl.deleteTexture(T[k].tex); T[k] = null; }
  for (const b of bloomLevels) { gl.deleteTexture(b.tex.tex); gl.deleteFramebuffer(b.fb); }
  bloomLevels.length = 0;
  for (const k of ['trace', 'taauA', 'taauB', 'scene', 'birdMS', 'birdResolve', 'rayA', 'rayB']) if (FB[k]) { gl.deleteFramebuffer(FB[k]); FB[k] = null; }
  if (R.rbColor) { gl.deleteRenderbuffer(R.rbColor); gl.deleteRenderbuffer(R.rbDepth); }
}
function allocate(w, h) {
  freeRes();
  R.w = w; R.h = h;
  R.lowMaxW = Math.ceil(w * 0.75); R.lowMaxH = Math.ceil(h * 0.75);
  T.cloudCol = texture2D(R.lowMaxW, R.lowMaxH, RGBA16F, gl.RGBA, HALF);
  T.cloudDepth = texture2D(R.lowMaxW, R.lowMaxH, gl.R16F, gl.RED, HALF, { filter: gl.NEAREST });
  FB.trace = framebuffer([T.cloudCol, T.cloudDepth]);
  T.histA = texture2D(w, h, RGBA16F, gl.RGBA, HALF);
  T.histB = texture2D(w, h, RGBA16F, gl.RGBA, HALF);
  T.scene = texture2D(w, h, RGBA16F, gl.RGBA, HALF);
  FB.taauA = framebuffer([T.histA, T.scene]);
  FB.taauB = framebuffer([T.histB, T.scene]);
  FB.scene = framebuffer([T.scene]);
  // bird: MSAA color + depth, resolved into a texture
  T.birdTex = texture2D(w, h, RGBA16F, gl.RGBA, HALF);
  FB.birdResolve = framebuffer([T.birdTex]);
  R.rbColor = gl.createRenderbuffer();
  R.rbDepth = gl.createRenderbuffer();
  const tryMS = s => {
    gl.bindRenderbuffer(gl.RENDERBUFFER, R.rbColor);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, RGBA16F, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, R.rbDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, gl.DEPTH_COMPONENT24, w, h);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, R.rbColor);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, R.rbDepth);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.deleteFramebuffer(fb); return null; }
    return fb;
  };
  FB.birdMS = tryMS(msaaSamples) || (msaaSamples = 0, tryMS(0));
  // bloom chain
  let bw = w, bh = h;
  for (let i = 0; i < 7; i++) {
    bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2));
    const tex = texture2D(bw, bh, RGBA16F, gl.RGBA, HALF);
    bloomLevels.push({ tex, fb: framebuffer([tex]), w: bw, h: bh });
  }
  // sun rays (quarter res)
  const rw = Math.max(1, Math.ceil(w / 4)), rh = Math.max(1, Math.ceil(h / 4));
  T.rayA = texture2D(rw, rh, RGBA16F, gl.RGBA, HALF);
  T.rayB = texture2D(rw, rh, RGBA16F, gl.RGBA, HALF);
  FB.rayA = framebuffer([T.rayA]);
  FB.rayB = framebuffer([T.rayB]);
  R.rayW = rw; R.rayH = rh;
  R.histValid = 0;
}

const COARSE = matchMedia('(pointer: coarse)').matches;
R.maxPixels = COARSE ? 1.15e6 : 2.3e6;
if (COARSE && !TEST) R.scale = 0.36;
let allocFails = 0;
export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (TEST) { w = parseInt(Q.get('w') || '960'); h = parseInt(Q.get('h') || '540'); }
  const px = w * h;
  if (px > R.maxPixels) { const k = Math.sqrt(R.maxPixels / px); w = Math.round(w * k); h = Math.round(h * k); }
  if (w !== R.w || h !== R.h) {
    canvas.width = w; canvas.height = h;
    try { allocate(w, h); allocFails = 0; }
    catch (e) {
      // out of GPU memory (typically on phones): try again smaller on the next frame
      R.w = R.h = 0;
      if (++allocFails > 3) throw e;
      R.maxPixels = Math.max(0.3e6, Math.min(R.maxPixels, w * h) * 0.6);
    }
  }
  return R.w > 0;
}
