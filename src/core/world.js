// The world's worker from the page's side (src/worker.js): starting it, its requests and replies,
// and the domes and rising air around the bird for the flight
//
// request(msg) posts a request and returns its record, whose `reply` is filled in when the reply
// comes (they come in order); busy() counts those still out (main.js waits on it); `started` awaits
// the start's reply. The flight asks for the sea's surface and the rising air at the bird every
// frame (world/queries.js): they are answered from a patch of domes and living towers' bubbles the
// worker sends, 24 km across, the next asked for once the bird is within 6 km of its edge (half a
// minute ahead at top speed). They are the world's domes in the world's order, so the surface is
// the same to the last bit, and the air too. Outside a patch this thread grows
// the world's cells itself, as the Node tools do: a stall. patchStats says how it went (the
// top-speed check, tools/checks.js).

import WorldWorker from '../worker.js?worker&inline';
import { fail } from './page.js';
import { forEachDome, setWeather } from '../world/cells.js';
import { liftBubbles, setDomeSource, setLiftSource } from '../world/queries.js';

// (the page's query as the worker's name: its URL parameters, core/params.js)
const worker = new WorldWorker({ name: location.search });
worker.onerror = e => fail('Something went wrong while making the world — ' + (e.message || 'its worker stopped'));
const out = [];      // the requests still out, in order
let lastId = 0;
worker.onmessage = ({ data }) => {
  const r = out.shift();
  if (!r || r.id !== data.id) { fail('Something went wrong while making the world — a reply came out of order'); return; }
  r.reply = data;
  if (r.done) r.done(data);
};
export function request(msg) {
  const r = { id: ++lastId, reply: null, done: null };
  out.push(r);
  worker.postMessage({ ...msg, id: r.id });
  return r;
}
const ask = msg => new Promise(done => { request(msg).done = done; });
export const busy = () => out.length;
export const forgetFar = (x, z) => worker.postMessage({ kind: 'gc', x, z });

// The start: { weather, sea0, pose } (src/worker.js), asked for as the page loads (the worker grows
// the world around the start, and looks for ?preset's place, while the shaders compile). This
// thread's world takes the worker's weather: the spawn draw runs there alone.
export const started = ask({ kind: 'start' }).then(r => { setWeather(r.weather); return r; });

// ---- the patch of domes around the bird
const HALF = 12000, EDGE = 6000;   // m
let patch = null, next = null;
const inside = (box, x, z, m) => x > box[0] + m && x < box[2] - m && z > box[1] + m && z < box[3] - m;
// how far before the edge the next patch is asked for (m), the patches asked for, the longest one
// took to come (ms), the nearest the bird came to the edge of the patch it had (m; below 0: past it);
// the lookups this thread answered by growing cells itself
export const patchStats = { edge: EDGE, asked: 0, maxWait: 0, minLead: Infinity, grown: 0, grownMs: 0 };
function askPatch(x, z) {
  const box = [x - HALF, z - HALF, x + HALF, z + HALF];
  next = request({ kind: 'patch', x0: box[0], z0: box[1], x1: box[2], z1: box[3] });
  next.box = box; next.t = performance.now();
  patchStats.asked++;
  return next;
}
// once a frame, at the bird: take a patch that has come, ask for the next when near the edge
export function keepPatch(x, z) {
  if (patch) { const b = patch.box; patchStats.minLead = Math.min(patchStats.minLead, x - b[0], b[2] - x, z - b[1], b[3] - z); }
  if (next && next.reply) {
    patchStats.maxWait = Math.max(patchStats.maxWait, performance.now() - next.t);
    patch = { box: next.box, domes: next.reply.domes, lifts: next.reply.lifts }; next = null;
  }
  if (!next && (!patch || !inside(patch.box, x, z, EDGE))) askPatch(x, z);
}
// (the first, before the first frame)
export function patchAt(x, z) {
  const r = askPatch(x, z);
  return new Promise(done => { r.done = () => { keepPatch(x, z); done(); }; });
}
setDomeSource((x, z, each) => {
  if (!patch || !inside(patch.box, x, z, 0)) {
    const t0 = performance.now();
    forEachDome(x, z, x, z, each);
    patchStats.grown++; patchStats.grownMs += performance.now() - t0;
    return;
  }
  for (const d of patch.domes) if (d.x + d.reach > x && d.x - d.reach < x && d.z + d.reach > z && d.z - d.reach < z) each(d);
});
// (the rising air around towers, as the domes)
setLiftSource((x, z, each) => {
  if (!patch || !inside(patch.box, x, z, 0)) {
    const t0 = performance.now();
    for (const b of liftBubbles(x, z, x, z)) each(b);
    patchStats.grown++; patchStats.grownMs += performance.now() - t0;
    return;
  }
  for (const b of patch.lifts) each(b);
});
