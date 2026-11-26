// The test mode (?test, CLAUDE.md §7): what tools/screenshot.js, tools/flights.js and
// tools/checks.js rely on
//
// main.js steps the page at a fixed time step (?dt) and makes each frame wait for its world and for
// the last frame's probe, so renders repeat exactly. Here: the `frames`th frame is copied out of the
// canvas texture and handed over as a PNG data URL (window.__png); with ?keep=K&every=S, K frames S
// apart from it on (window.__frames, the first the same as __png); then window.__done once the GPU
// is done. ?log keeps a row per frame of the flight (window.__log, the columns at afterFrame);
// ?script steers by one of ROUTES (tools/flights.js, the flight check), and without ?live nothing
// else steers.

import { params, TEST } from './params.js';
import { refuse } from './page.js';
import { input } from './input.js';
import { DEG } from '../math.js';
import { device, enc } from '../render/gpu.js';
import { captureNext, frame } from '../render/frame.js';
import { probeData } from '../render/probe.js';
import { gpuTimer } from '../render/timing.js';
import { seaTopAt } from '../world/queries.js';
import { bird_ } from '../flight/flight.js';
import { cam } from '../flight/camera.js';

const FRAMES = params.frames ?? 24;
const KEEP = params.keep ?? 1, EVERY = params.every ?? 1;
const LAST = FRAMES - 1 + (KEEP - 1) * EVERY;   // the index of the last frame rendered

// The scripted flights (tools/flights.js, the flight check): steer(t) gives [right, up] in -1..1
// at t seconds. reach: on from the start into the first tower's rising air, until it is strong (or
// 25 s after it was first felt: a tower is broadest at its foot, and a climb begun at the first
// whiff circled out of its air), then a held climb in it, circling (its time to the flank and to
// the head: tools/flights.js).
let felt = null, whiff = null;
const ROUTES = {
  dive: (t) => [0, t > 1 && t < 9 ? -1 : 0],
  climb: (t) => [0, t > 1 && t < 12 ? 1 : 0],
  turn: (t) => [t > 1 && t < 12 ? 1 : 0, 0],
  weave: (t) => [Math.sin(t * 0.7), 0.4 * Math.sin(t * 0.45)],
  divedeep: (t) => [0, t > 0.5 ? -1 : 0],
  holddive: () => [0, -1],
  reach: (t) => {
    if (whiff === null && bird_.lift > 3) whiff = t;
    if (felt === null && (bird_.lift > 12 || (whiff !== null && t - whiff > 25))) felt = t;
    return felt === null ? [0, 0] : [0.35, 1];
  },
};
const still = () => [0, 0];
if (TEST && !params.live) {
  const route = params.script === null ? still : Object.hasOwn(ROUTES, params.script) ? ROUTES[params.script] : null;
  if (!route) refuse(`no route "${params.script}" (?script=${Object.keys(ROUTES).join('|')})`);
  input.script = route ?? still;
}

// Once a frame, before it renders: a frame to hand over is copied out as it is drawn.
export function beforeFrame() {
  const kept = frame - (FRAMES - 1);
  if (kept >= 0 && kept % EVERY === 0 && kept / EVERY < KEEP) captureNext(captureImage);
}

// Once a frame, after it rendered: the flight log's row (t, x, alt, z, speed, bank, γ, yaw, sea
// top, the probe's distance to the cloud at the bird, camera roll, fov, the rising air; angles in
// degrees). True once the last frame is rendered.
export function afterFrame(clock) {
  if (params.log) {
    (window.__log = window.__log || []).push([+clock.toFixed(3), +bird_.pos[0].toFixed(1), +bird_.pos[1].toFixed(1), +bird_.pos[2].toFixed(1),
      +bird_.speed.toFixed(2), +(bird_.bank / DEG).toFixed(1), +(bird_.gamma / DEG).toFixed(2), +(bird_.yaw / DEG).toFixed(1),
      +seaTopAt(bird_.pos[0], bird_.pos[2]).toFixed(0), probeData ? +probeData[2].toFixed(0) : null, +(cam.roll / DEG).toFixed(1), +(cam.fov / DEG).toFixed(1), +bird_.lift.toFixed(2)]);
  }
  return frame > LAST;
}

// The frames handed over, in order. (Encoded after the frame's last pass; the returned function
// runs once the frame is submitted.)
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
