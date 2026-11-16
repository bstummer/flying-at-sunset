// =====================================================================================
//  Paper Bird — a folded paper bird gliding over a sea of clouds at golden hour.
//  Everything is procedural: physically based sky, raymarched volumetric clouds with
//  temporal upsampling, an origami bird with translucent paper, and a gentle glider.
// =====================================================================================

import { BENCH, DEBUG, Q, TEST } from './params.js';
import { canvas, COARSE, fail, hintEl } from './page.js';
import { DEG } from './math.js';
import { device, enc, gpuState, pipelinesReady, readTexture } from './render/gpu.js';
import { cloudTopAt, seaTopAt, towersNear } from './world/queries.js';
import { generateStatic, T } from './render/setup.js';
import { bakeQueue, LEVELS, TSVL, worldStats } from './render/stream.js';
import { R, resize } from './render/targets.js';
import { inCloud, probeBusy, probeData, updateInCloud } from './render/probe.js';
import { bird_, updateFlight } from './flight.js';
import { input, updateInput } from './input.js';
import { cam, updateCamera } from './camera.js';
import './presets.js';
import { gpuTimer } from './render/timing.js';
import { captureNext, frame, render } from './render/frame.js';
import { adaptResolution, DR } from './render/resolution.js';
import { updateBenchmark } from './benchmark.js';

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
// tests hand over ?keep frames (default 1), ?every frames apart (default 1), from the `frames`th on
const KEEP = TEST ? Math.max(1, parseInt(Q.get('keep') || '1', 10)) : 1;
const EVERY = TEST ? Math.max(1, parseInt(Q.get('every') || '1', 10)) : 1;
const LAST = TEST_FRAMES - 1 + (KEEP - 1) * EVERY;   // the index of the last frame rendered

let startWall = -1, stopped = false;   // startWall: when the canvas faded in (the hint's clock)
function loop(now) {
  if (stopped || window.__done) return;
  try { frameStep(now); }
  catch (e) {
    stopped = window.__done = true;
    if (!gpuState.lost) fail('Something went wrong while rendering — ' + (e && e.message || e));
  }
}
function frameStep(now) {
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
  updateFlight(bird_, FREEZE ? 0 : dt, clock, input, probeData);
  updateCamera(dt, frame === 0, clock, R.w / R.h, inCloud);
  updateInCloud(dt);
  const kept = frame - (TEST_FRAMES - 1);
  if (TEST && kept >= 0 && kept % EVERY === 0 && kept / EVERY < KEEP) captureNext(captureImage);
  render(clock);
  if (frame === 2 && startWall < 0) { canvas.classList.add('on'); startWall = now; }
  // hint (wall-clock timing so it behaves the same at any frame rate, from when the bird shows:
  // the first frame bakes the world, which on a slow device takes longer than the hint lasts)
  if (!TEST && !BENCH && startWall >= 0) {
    const wall = (now - startWall) * 0.001;
    if (!hintShown && wall > 1.8) { hintEl.classList.add('on'); hintShown = true; }
    if (hintShown && !hintHidden && (wall > 10 || input.activeTime > 3.2)) { hintEl.classList.remove('on'); hintHidden = true; }
  }
  if (frame > 3) adaptResolution(dtMs);
  if (BENCH) updateBenchmark(dtMs);
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
  if (TEST && frame > LAST) stopped = true;
}
// tests: the frames handed over as PNG data URLs (window.__frames; the first also as window.__png),
// then window.__done once the GPU is done. (Encoded after the frame's last pass; the returned
// function runs once the frame is submitted.)
const handed = [];
function captureImage(tex) {
  captureNext(null);
  const n = handed.push(null) - 1;
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
    handed[n] = c.toDataURL('image/png');
    if (handed.length < KEEP || handed.includes(null)) return;
    window.__frames = handed;
    window.__png = handed[0];
    if (gpuTimer) await gpuTimer.settled();
    await device.queue.onSubmittedWorkDone();
    window.__done = true;
  }, e => { window.__error = 'capture failed: ' + e.message; });
}

// GPU reset (driver update, sleep): rebuild everything by reloading, once a GPU is there again.
// (Tests never reload: a lost device fails them.)
device.lost.then(async info => {
  stopped = true;
  if (TEST) window.__error = `the GPU device was lost (${info.reason}): ${info.message}`;
  window.__done = true;
  if (TEST || info.reason === 'destroyed') return;
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
// A promise that fails unheard would leave a blank or frozen page: say so instead.
addEventListener('unhandledrejection', e => {
  if (!gpuState.lost && !window.__error) fail('Something went wrong — ' + (e.reason && e.reason.message || e.reason));
});
try { await pipelinesReady(); } catch (e) { fail('Shader error — ' + e.message); throw e; }
try { generateStatic(); } catch (e) { fail('Something went wrong while starting — ' + (e && e.message || e)); throw e; }
requestAnimationFrame(loop);
