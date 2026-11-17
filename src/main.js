// Flying at Sunset: a folded paper bird gliding over a sea of clouds at golden hour. Everything is
// procedural: a physically based sky, raymarched clouds upsampled over time, an origami bird of
// translucent paper, a gentle glider.
//
// The start, the main loop (frameStep: input, flight, camera and the world's windows, then the
// frame), the steering hint, a lost device and window.__debug. The imports run in the order things
// are set up (CLAUDE.md §6): the world's worker starts first and grows the world around the start
// while the GPU device comes and the shaders compile. The first frame, and in the test mode every
// frame, waits for what it asked the world's worker for; in the test mode each also waits for the
// last frame's probe, so captures repeat exactly.

import { BENCH, params, TEST } from './core/params.js';
import { canvas, COARSE, fail, hintEl, refuse } from './core/page.js';
import { busy as worldBusy, keepPatch, patchAt, started } from './core/world.js';
import { device, gpuState, pipelinesReady, readBuffer, readTexture } from './render/gpu.js';
import { cloudTopAt, seaTopAt, towersNear } from './world/queries.js';
import { generateStatic, T } from './render/setup.js';
import { LEVELS, shiftWorld, TSVL, worldStats } from './render/stream.js';
import { R, resize } from './render/targets.js';
import { inCloud, probeBusy, probeData, updateInCloud } from './render/probe.js';
import { bird_, newBird, updateFlight } from './flight/flight.js';
import { input, updateInput } from './core/input.js';
import { cam, updateCamera } from './flight/camera.js';
import { placeBird } from './flight/presets.js';
import { frame, render } from './render/frame.js';
import { adaptResolution, DR } from './render/resolution.js';
import { updateBenchmark } from './core/benchmark.js';
import { afterFrame, beforeFrame } from './core/capture.js';
import { updateReadout } from './core/readout.js';

for (const why of params.errors) refuse(why);

// ---- hint & main loop
hintEl.innerHTML = COARSE ? 'Touch and drag to steer<small>dive to gather speed · climb to soar</small>'
  : 'Move the mouse to steer<small>dive to gather speed · climb to soar · arrow keys work too</small>';
let hintAt = -1, hintHidden = false;   // hintAt: when the hint came in

let last = -1, clock = 0;
const FIXED_DT = params.dt ?? 0.0166;   // (the test mode's time step)
let startWall = -1, stopped = false;   // startWall: when the canvas faded in (the hint's clock)
function loop(now) {
  if (stopped || window.__done) return;
  try { frameStep(now); }
  catch (e) {
    stopped = window.__done = true;
    if (!gpuState.lost) fail('Something went wrong while rendering — ' + (e && e.message || e));
  }
}
let held = false, dtMs = 0;   // held: a frame that waits for its world
function frameStep(now) {
  requestAnimationFrame(loop);
  // (tests: each frame waits for the probe of the last one, as if the GPU were always that quick)
  if (TEST && probeBusy()) return;
  // The first frame, and every frame in tests, waits for what it asked the world's worker for
  // (render/stream.js), then bakes all of it; later frames take what has come.
  if (held) {
    if (worldBusy()) return;
    held = false;
  } else {
    const t = now * 0.001;
    let dt = last < 0 ? 1 / 60 : Math.min(t - last, 0.1);
    dtMs = (t - last) * 1000;
    last = t;
    if (TEST) dt = FIXED_DT;
    clock += dt;
    if (!resize()) return;   // GPU memory ran out: retrying smaller next frame
    updateInput(dt, clock);
    keepPatch(bird_.pos[0], bird_.pos[2]);
    updateFlight(bird_, params.freeze ? 0 : dt, clock, input, probeData);
    updateCamera(dt, frame === 0, clock, R.w / R.h, inCloud);
    updateInCloud(dt);
    shiftWorld(cam.pos, frame);
    if ((TEST || frame === 0) && worldBusy()) { held = true; return; }
  }
  if (TEST) beforeFrame();
  render(clock);
  if (frame === 2 && startWall < 0) { canvas.classList.add('on'); startWall = now; }
  // hint, by the wall clock so it behaves the same at any frame rate: in 1.8 s after the bird
  // shows, out 8.2 s after it came in, or once the visitor has steered a while. Each clock starts
  // at what the visitor saw: the first frames bake the world, and on a slow device one of them
  // can take longer than the hint lasts.
  if (!TEST && !BENCH && startWall >= 0) {
    if (hintAt < 0 && now - startWall > 1800) { hintEl.classList.add('on'); hintAt = now; }
    if (hintAt >= 0 && !hintHidden && (now - hintAt > 8200 || input.activeTime > 3.2)) { hintEl.classList.remove('on'); hintHidden = true; }
  }
  if (frame > 3) adaptResolution(dtMs);
  if (BENCH) updateBenchmark(dtMs);
  updateReadout(dtMs);
  window.__frame = frame;
  if (TEST && afterFrame(clock)) stopped = true;
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
document.addEventListener('visibilitychange', () => { last = -1; });
window.__debug = {
  bird: bird_, cam, R, seaTopAt, cloudTopAt, towersNear, input, DR, LEVELS, TSVL, worldStats, device, T, readTexture,
  // (struct Probe and struct Ambient, chunks/probe.wgsl and chunks/ambient.wgsl)
  probe: async () => {
    const b = Array.from(await readBuffer(T.probe)), a = Array.from(await readBuffer(T.amb));
    return { sun: b.slice(0, 4), ambUp: b.slice(4, 7), ambDn: b.slice(8, 11), medium: b.slice(12, 16), mistL: b.slice(16, 19), floorD: b[20],
      amb: { up: a.slice(0, 3), sunSide: a.slice(4, 7), antiSun: a.slice(8, 11) } };
  },
};
// A promise that fails unheard would leave a blank or frozen page: say so instead.
addEventListener('unhandledrejection', e => {
  if (!gpuState.lost && !window.__error) fail('Something went wrong — ' + (e.reason && e.reason.message || e.reason));
});
// The start: the shaders compile in parallel without blocking the page, while the worker grows the
// world around the start and looks for ?preset's place; then the bird is placed, the domes around
// it are at hand (core/world.js), the static data is generated and the flight starts.
try { await pipelinesReady(); } catch (e) { fail('Shader error — ' + e.message); throw e; }
const start = await started;
if (start.pose?.refused) refuse(start.pose.refused);
Object.assign(bird_, newBird(start.sea0));
placeBird(bird_, start.pose?.refused ? null : start.pose, params.pose);
await patchAt(bird_.pos[0], bird_.pos[2]);
try { generateStatic(); } catch (e) { fail('Something went wrong while starting — ' + (e && e.message || e)); throw e; }
requestAnimationFrame(loop);
