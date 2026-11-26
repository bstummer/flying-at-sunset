// The world's worker: the CPU world generator (src/world/) off the page's thread, so growing new
// cells of the world never stalls a frame. It answers the page's requests (core/world.js) in the
// order they came, each reply with its request's id:
//
//   start           { weather: the spawn draw's (world/cells.js, drawn as this worker loads: the page
//                   takes it), sea0: the sea's top at the start, pose: ?preset's pose
//                   (flight/presets.js) }; then, while the page's shaders compile, it grows the cells
//                   the first frame's volumes will ask for around the bird (warm), so those requests
//                   find them grown
//   fill (a block)  { col: its column data (world/columns.js), RGBA half floats per column }
//   gather (a box)  { nb, bub: the bubbles near a block, 12 floats each (world/columns.js) }
//   patch (a box)   { domes: every dome over it, in the order the world's queries meet them; lifts:
//                   the bubbles of living towers whose rising air reaches into it (world/queries.js) }
//   gc (x, z)       forgets the cells far from there; no reply
//
// Bundled into the page as a classic script (vite.config.js) and started with the page's query as
// its name, which core/params.js reads: its world is the page's (?seed, ?towers).

import { params } from './core/params.js';
import { toHalf } from './math.js';
import { CLIP_LEVELS } from './constants.js';
import { forEachDome, forEachSys, spawnDraw, weatherOf, worldGC } from './world/cells.js';
import { fillColumns, gatherBubbles } from './world/columns.js';
import { liftBubbles, seaTopAt } from './world/queries.js';
import { presetPose } from './flight/presets.js';

spawnDraw();
self.onmessage = ({ data: m }) => {
  if (m.kind === 'gc') { worldGC(m.x, m.z); return; }
  let reply = null, moved = [];
  if (m.kind === 'start') reply = { weather: weatherOf(), sea0: seaTopAt(0, 0), pose: params.preset ? presetPose(params.preset) : null };
  else if (m.kind === 'fill') {
    const col = new Float32Array(m.ni * m.nj * 4);
    fillColumns(m.cell, m.lod, m.gi, m.gj, m.ni, m.nj, col);
    reply = { col: toHalf(col) };
    moved = [reply.col.buffer];
  } else if (m.kind === 'gather') {
    const bub = new Float32Array(m.max * 12);
    const nb = gatherBubbles(m.x0, m.z0, m.x1, m.z1, m.pad, m.minBR, m.ox, m.oz, bub, m.max, m.coarse);
    reply = { nb, bub: bub.slice(0, nb * 12) };
    moved = [reply.bub.buffer];
  } else if (m.kind === 'patch') {
    const domes = [];
    forEachDome(m.x0, m.z0, m.x1, m.z1, d => domes.push(d));
    reply = { domes, lifts: liftBubbles(m.x0, m.z0, m.x1, m.z1) };
  } else throw new Error('the world\'s worker has no request "' + m.kind + '"');
  self.postMessage({ id: m.id, ...reply }, moved);
  if (m.kind === 'start') {
    const p = params.pose ? { x: params.pose[0], z: params.pose[2] } : reply.pose && !reply.pose.refused ? reply.pose : {};
    warm(p.x || 0, p.z || 0);
  }
};
// the cells every level's window around (x, z) asks for (half 128 cells, the bird a few off its
// centre, and the bubbles' pad), the coarsest level's first (across its 524 km they take seconds)
function warm(x, z) {
  for (let l = CLIP_LEVELS.length - 1; l >= 0; l--) {
    const L = CLIP_LEVELS[l], h = 132 * L.cell + L.maxD + 300;
    forEachSys(x - h, z - h, x + h, z + h, () => {}, l === CLIP_LEVELS.length - 1);
  }
}
