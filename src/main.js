// =====================================================================================
//  Paper Bird — a folded paper bird gliding over a sea of clouds at golden hour.
//  Everything is procedural: physically based sky, raymarched volumetric clouds with
//  temporal upsampling, an origami bird with translucent paper, and a gentle glider.
// =====================================================================================

import { DEBUG, Q, TEST } from './params.js';
import { canvas, COARSE, fail, hintEl } from './page.js';
import { DEG } from './math.js';
import { device, enc, gpuState, pipelinesReady, readTexture } from './render/gpu.js';
import { cloudTopAt, seaTopAt, towersNear } from './world/queries.js';
import { generateStatic, T } from './render/setup.js';
import { bakeQueue, LEVELS, TSVL, worldStats } from './render/stream.js';
import { R, resize } from './render/targets.js';
import { probeBusy, probeData, updateInCloud } from './render/probe.js';
import { bird_, updateFlight } from './flight.js';
import { input, updateInput } from './input.js';
import { cam, updateCamera } from './camera.js';
import './presets.js';
import { gpuTimer } from './render/timing.js';
import { captureNext, frame, render } from './render/frame.js';
import { adaptResolution, DR } from './render/resolution.js';

// ---- hint & main loop
hintEl.innerHTML = COARSE ? 'Touch and drag to steer<small>dive to gather speed · climb to soar</small>'
  : 'Move the mouse to steer<small>dive to gather speed · climb to soar · arrow keys work too</small>';
let hintShown = false, hintHidden = false;

let last = -1, clock = 0, fps = 0, fpsAcc = 0, fpsN = 0;
const statsEl = DEBUG && !TEST ? document.createElement('div') : null;
if (statsEl) { statsEl.id = 'stats'; document.body.appendChild(statsEl); }
const FIXED_DT = TEST ? parseFloat(Q.get('dt') || '0.0166') : 0;
const TEST_FRAMES = parseInt(Q.get('frames') || '24', 10);
const FREEZE = Q.has('freeze');

let startWall = -1, stopped = false;
function loop(now) {
  if (stopped || window.__done) return;
  try { frameStep(now); }
  catch (e) {
    stopped = window.__done = true;
    if (!gpuState.lost) fail('Something went wrong while rendering — ' + (e && e.message || e));
  }
}
function frameStep(now) {
  if (startWall < 0) startWall = now;
  requestAnimationFrame(loop);
  // (tests: each frame waits for the probe of the last one, as if the GPU were always that quick)
  if (TEST && probeBusy()) return;
  const t = now * 0.001;
  let dt = last < 0 ? 1 / 60 : Math.min(t - last, 0.1);
  const dtMs = (t - last) * 1000;
  last = t;
  if (TEST) dt = FIXED_DT;
  clock += dt;
  if (!resize()) return;   // GPU memory ran out: retrying smaller next frame
  updateInput(dt, clock);
  if (!FREEZE) updateFlight(dt, clock);
  else updateFlight(0, clock);
  updateCamera(dt, frame === 0, clock);
  updateInCloud(dt);
  if (TEST && frame >= TEST_FRAMES - 1) captureNext(captureImage);
  render(clock);
  if (frame === 2) canvas.classList.add('on');
  // hint (wall-clock timing so it behaves the same at any frame rate)
  if (!TEST) {
    const wall = (now - startWall) * 0.001;
    if (!hintShown && wall > 1.8) { hintEl.classList.add('on'); hintShown = true; }
    if (hintShown && !hintHidden && (wall > 10 || input.activeTime > 3.2)) { hintEl.classList.remove('on'); hintHidden = true; }
  }
  if (frame > 3) adaptResolution(dtMs);
  fpsAcc += dtMs; fpsN++;
  if (fpsN >= 30) {
    fps = 1000 / (fpsAcc / fpsN); fpsAcc = 0; fpsN = 0;
    if (statsEl) {
      const g = gpuTimer ? Object.entries(gpuTimer.ms).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  ') + `  = ${gpuTimer.total().toFixed(2)} ms` : 'no gpu timer';
      statsEl.textContent = `${fps.toFixed(1)} fps  ${R.w}x${R.h}  clouds ${R.lowW}x${R.lowH} (${R.scale.toFixed(2)})\n${g}\nalt ${bird_.pos[1].toFixed(0)} m  speed ${bird_.speed.toFixed(0)} m/s  sea ${seaTopAt(bird_.pos[0], bird_.pos[2]).toFixed(0)}  world jobs ${worldStats.jobs} queued ${bakeQueue.length}`;
    }
  }
  window.__frame = frame;
  if (TEST && Q.has('log')) {
    (window.__log = window.__log || []).push([+clock.toFixed(3), +bird_.pos[0].toFixed(1), +bird_.pos[1].toFixed(1), +bird_.pos[2].toFixed(1),
      +bird_.speed.toFixed(2), +(bird_.bank / DEG).toFixed(1), +(bird_.gamma / DEG).toFixed(2), +(bird_.yaw / DEG).toFixed(1),
      +seaTopAt(bird_.pos[0], bird_.pos[2]).toFixed(0), probeData ? +probeData[2].toFixed(0) : null, +(cam.roll / DEG).toFixed(1), +(cam.fov / DEG).toFixed(1)]);
  }
  if (TEST && frame >= TEST_FRAMES) stopped = true;
}
// tests: the last frame's image as PNG (window.__png), then window.__done once the GPU is done.
// (Encoded after the frame's last pass; the returned function runs once the frame is submitted.)
function captureImage(tex) {
  captureNext(null);
  const w = tex.width, h = tex.height, row = Math.ceil(w * 4 / 256) * 256;
  const buf = device.createBuffer({ size: row * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  enc().copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: row }, [w, h]);
  return () => buf.mapAsync(GPUMapMode.READ).then(async () => {
    const src = new Uint8Array(buf.getMappedRange()), px = new Uint8ClampedArray(w * h * 4);
    const bgra = tex.format.startsWith('bgra');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * row + x * 4, o = (y * w + x) * 4;
      px[o] = src[i + (bgra ? 2 : 0)]; px[o + 1] = src[i + 1]; px[o + 2] = src[i + (bgra ? 0 : 2)]; px[o + 3] = 255;
    }
    buf.unmap();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0);
    window.__png = c.toDataURL('image/png');
    if (gpuTimer) await gpuTimer.settled();
    await device.queue.onSubmittedWorkDone();
    window.__done = true;
  }, e => { window.__error = 'capture failed: ' + e.message; });
}

// GPU reset (driver update, sleep): rebuild everything by reloading, once a GPU is there again
device.lost.then(async info => {
  stopped = window.__done = true;
  if (info.reason === 'destroyed') return;
  const a = navigator.gpu && performance.now() > 10000 ? await navigator.gpu.requestAdapter().catch(() => null) : null;
  if (a) location.reload(); else fail('The graphics device stopped working. Please reload the page.');
});
// quiet extras: double-click or F toggles fullscreen
function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) { const pr = req.call(el); if (pr && pr.catch) pr.catch(() => {}); } }
}
canvas.addEventListener('dblclick', toggleFullscreen);
window.addEventListener('keydown', e => { if (e.code === 'KeyF' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) toggleFullscreen(); });
document.addEventListener('visibilitychange', () => { last = -1; });
// Boot: the shaders compile in parallel without blocking the page; then generate the static
// data and start flying.
window.__debug = {
  bird: bird_, cam, R, seaTopAt, cloudTopAt, towersNear, input, DR, LEVELS, TSVL, worldStats, device, T, readTexture,
  probe: async () => {
    const b = await readTexture(T.probe), amb = await readTexture(T.amb);
    return { sun: Array.from(b.slice(0, 4)), ambUp: Array.from(b.slice(4, 7)), ambDn: Array.from(b.slice(8, 11)), misc: Array.from(b.slice(12, 16)), mist: Array.from(b.slice(16, 19)), ambTex: Array.from(amb) };
  },
};
try { await pipelinesReady(); } catch (e) { fail('Shader error — ' + e.message); throw e; }
generateStatic();
requestAnimationFrame(loop);
