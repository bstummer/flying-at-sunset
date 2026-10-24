// =====================================================================================
//  Paper Bird — a folded paper bird gliding over a sea of clouds at golden hour.
//  Everything is procedural: physically based sky, raymarched volumetric clouds with
//  temporal upsampling, an origami bird with translucent paper, and a gentle glider.
// =====================================================================================

import { DEBUG, Q, TEST } from './params.js';
import { canvas, fail, hintEl } from './page.js';
import { DEG } from './math.js';
import { checkPrograms, extParallel, gl, programs } from './render/gl.js';
import { cloudTopAt, seaTopAt, towersNear } from './world/queries.js';
import { FB, generateStatic } from './render/setup.js';
import { bakeQueue, LEVELS, TSVL, worldStats } from './render/stream.js';
import { R, resize } from './render/targets.js';
import { probeData, updateInCloud } from './render/probe.js';
import { bird_, updateFlight } from './flight.js';
import { input, updateInput } from './input.js';
import { cam, updateCamera } from './camera.js';
import './presets.js';
import { gpuTimer } from './render/timing.js';
import { frame, render } from './render/frame.js';
import { adaptResolution, DR } from './render/resolution.js';

// ---- hint & main loop
const isTouch = matchMedia('(pointer: coarse)').matches;   // primary pointer is a finger
hintEl.innerHTML = isTouch ? 'Touch and drag to steer<small>dive to gather speed · climb to soar</small>'
  : 'Move the mouse to steer<small>dive to gather speed · climb to soar · arrow keys work too</small>';
let hintShown = false, hintHidden = false;

let last = -1, clock = 0, fpsAcc = 0, fpsN = 0;
const statsEl = DEBUG && !TEST ? document.createElement('div') : null;
if (statsEl) { statsEl.id = 'stats'; document.body.appendChild(statsEl); }
const FIXED_DT = TEST ? parseFloat(Q.get('dt') || '0.0166') : 0;
const TEST_FRAMES = parseInt(Q.get('frames') || '24', 10);
const FREEZE = Q.has('freeze');
const stats = { fps: 0 };

let startWall = -1;
function loop(now) {
  if (window.__done) return;
  try { frameStep(now); }
  catch (e) {
    window.__done = true;
    if (!gl.isContextLost()) fail('Something went wrong while rendering — ' + (e && e.message || e));
  }
}
function frameStep(now) {
  if (startWall < 0) startWall = now;
  requestAnimationFrame(loop);
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
  render(clock, dt);
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
    stats.fps = 1000 / (fpsAcc / fpsN); fpsAcc = 0; fpsN = 0;
    if (statsEl) {
      const g = gpuTimer ? Object.entries(gpuTimer.ms).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  ') + `  = ${gpuTimer.total().toFixed(2)} ms` : 'no gpu timer';
      statsEl.textContent = `${stats.fps.toFixed(1)} fps  ${R.w}x${R.h}  clouds ${R.lowW}x${R.lowH} (${R.scale.toFixed(2)})\n${g}\nalt ${bird_.pos[1].toFixed(0)} m  speed ${bird_.speed.toFixed(0)} m/s  sea ${seaTopAt(bird_.pos[0], bird_.pos[2]).toFixed(0)}  world jobs ${worldStats.jobs} queued ${bakeQueue.length}`;
    }
  }
  window.__frame = frame;
  if (TEST && Q.has('log')) {
    (window.__log = window.__log || []).push([+clock.toFixed(3), +bird_.pos[0].toFixed(1), +bird_.pos[1].toFixed(1), +bird_.pos[2].toFixed(1),
      +bird_.speed.toFixed(2), +(bird_.bank / DEG).toFixed(1), +(bird_.gamma / DEG).toFixed(2), +(bird_.yaw / DEG).toFixed(1),
      +seaTopAt(bird_.pos[0], bird_.pos[2]).toFixed(0), probeData ? +probeData[2].toFixed(0) : null, +(cam.roll / DEG).toFixed(1), +(cam.fov / DEG).toFixed(1)]);
  }
  if (TEST && frame >= TEST_FRAMES) { gl.finish(); window.__done = true; }
}

// GPU reset (driver update, sleep, too many contexts): rebuild everything by reloading
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); window.__done = true; });
canvas.addEventListener('webglcontextrestored', () => location.reload());
// quiet extras: double-click or F toggles fullscreen
function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) { const pr = req.call(el); if (pr && pr.catch) pr.catch(() => {}); } }
}
canvas.addEventListener('dblclick', toggleFullscreen);
window.addEventListener('keydown', e => { if (e.code === 'KeyF' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) toggleFullscreen(); });
document.addEventListener('visibilitychange', () => { last = -1; });
// Boot: let the driver compile all shaders in parallel without blocking the page, then
// generate the static data and start flying.
function programsReady() {
  if (!extParallel) return true;
  for (const p of programs) if (!gl.getProgramParameter(p.p, extParallel.COMPLETION_STATUS_KHR)) return false;
  return true;
}
function boot() {
  if (gl.isContextLost()) return;   // reloads on restore
  if (!programsReady()) { requestAnimationFrame(boot); return; }
  try { checkPrograms(); } catch (e) { fail('Shader error — ' + e.message); return; }
  generateStatic();
  requestAnimationFrame(loop);
}
boot();
window.__debug = {
  bird: bird_, cam, R, seaTopAt, cloudTopAt, towersNear, input, DR, LEVELS, TSVL, worldStats,
  probe: () => {
    const b = new Float32Array(32);
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.probe);
    gl.readPixels(0, 0, 8, 1, gl.RGBA, gl.FLOAT, b);
    const amb = new Float32Array(16);
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.amb);
    gl.readPixels(0, 0, 4, 1, gl.RGBA, gl.FLOAT, amb);
    return { sun: Array.from(b.slice(0, 4)), ambUp: Array.from(b.slice(4, 7)), ambDn: Array.from(b.slice(8, 11)), misc: Array.from(b.slice(12, 16)), mist: Array.from(b.slice(16, 19)), ambTex: Array.from(amb) };
  },
};
